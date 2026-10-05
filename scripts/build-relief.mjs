// Genera public/data/relief/: imagen equirectangular de relieve sombreado de tierra y mar
// a partir de ETOPO 2022 (NOAA NCEI, dominio público).
// Uso: ETOPO_FILE=<ETOPO_2022_v1_60s_N90W180_surface.nc> npm run relief
// Descarga: https://www.ngdc.noaa.gov/thredds/fileServer/global/ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc
import { mkdir, readFile, writeFile } from "node:fs/promises";
import h5wasm from "h5wasm/node";
import jpeg from "jpeg-js";
import { feature } from "topojson-client";

const SRC = process.env.ETOPO_FILE;
if (!SRC) throw new Error("Falta ETOPO_FILE (ver cabecera del script)");
const OUT = new URL("../public/data/relief/", import.meta.url);
const W = 4096;
const H = 2048;
const R = 6371008.8;

// Escalas de color (m → color), apagadas para que los contornos de encima se lean
const LAND = [
  [0, [112, 152, 96]],
  [300, [146, 172, 108]],
  [800, [190, 190, 140]],
  [1500, [196, 165, 118]],
  [2500, [160, 126, 96]],
  [3500, [138, 112, 98]],
  [4800, [214, 208, 200]],
  [6500, [250, 250, 250]],
];
const SEA = [
  [0, [178, 218, 232]],
  [-150, [150, 202, 224]],
  [-1000, [96, 160, 200]],
  [-3000, [52, 116, 166]],
  [-5000, [32, 82, 128]],
  [-7000, [20, 58, 96]],
  [-11000, [10, 34, 64]],
];
// Realce del sombreado: el relieve real es casi plano a esta resolución (~10 km por píxel).
// Solo afecta a la luz, nunca a la geometría del globo.
const Z_LAND = 22;
const Z_SEA = 10;

function ramp(stops, v) {
  const asc = stops[0][0] < stops[1][0];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (asc ? v <= b : v >= b) {
      const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
      return ca.map((c, k) => c + (cb[k] - c) * t);
    }
  }
  return stops.at(-1)[1];
}

// 1. Elevación promediada en la rejilla de salida (fila 0 = norte)
await h5wasm.ready;
const file = new h5wasm.File(SRC, "r");
const zds = file.get("z");
const [Hs, Ws] = zds.shape;
const lats = file.get("lat").value;
const northFirst = lats[0] > lats[lats.length - 1];
console.log(`ETOPO ${Ws}×${Hs}, ${northFirst ? "norte" : "sur"} primero`);
const sum = new Float64Array(W * H);
const cnt = new Uint32Array(W * H);
const colOf = new Uint32Array(Ws).map((_, c) => Math.min(W - 1, Math.floor((c * W) / Ws)));
const BAND = 540;
for (let r0 = 0; r0 < Hs; r0 += BAND) {
  const r1 = Math.min(Hs, r0 + BAND);
  const band = zds.slice([[r0, r1], [0, Ws]]);
  for (let r = r0; r < r1; r++) {
    const rn = northFirst ? r : Hs - 1 - r;
    const j = Math.min(H - 1, Math.floor((rn * H) / Hs));
    const off = (r - r0) * Ws;
    for (let c = 0; c < Ws; c++) {
      const k = j * W + colOf[c];
      sum[k] += band[off + c];
      cnt[k]++;
    }
  }
  process.stdout.write(`\r  leyendo ${Math.round((r1 / Hs) * 100)} %`);
}
file.close();
const elev = new Float32Array(W * H);
for (let k = 0; k < elev.length; k++) elev[k] = sum[k] / cnt[k];
console.log("");

// 2. Máscara de tierra con las mismas costas de Natural Earth que dibuja la app
const landTopo = JSON.parse(await readFile(new URL("../node_modules/world-atlas/land-50m.json", import.meta.url), "utf8"));
const land = feature(landTopo, landTopo.objects.land);
// Cada anillo se "desenrolla" para que no salte de +180° a −180°: esa arista cruzaría
// todo el mapa e invertiría la máscara en esas filas. Luego se rellena anillo por anillo
// con XOR (los huecos se restan solos) y envolviendo las columnas en el borde.
const rings = [];
for (const f of land.features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys)
    for (const ring of poly) {
      let shift = 0;
      const pts = ring.map(([x, y], i) => {
        if (i > 0) {
          const d = x + shift - (ring[i - 1][0] + shift);
          if (d > 180) shift -= 360;
          else if (d < -180) shift += 360;
        }
        return [x + shift, y];
      });
      // Un anillo que rodea el polo (la Antártida) da la vuelta completa sin cerrarse en el plano:
      // se cierra bajando al polo y volviendo por él
      if (shift !== 0) {
        const pole = pts.reduce((sum, p) => sum + p[1], 0) < 0 ? -90 : 90;
        pts.push([pts.at(-1)[0], pole], [pts[0][0], pole], pts[0]);
      }
      rings.push({ pts, minY: Math.min(...pts.map((p) => p[1])), maxY: Math.max(...pts.map((p) => p[1])) });
    }
}
const mask = new Uint8Array(W * H);
for (let j = 0; j < H; j++) {
  const lat = 90 - ((j + 0.5) * 180) / H;
  for (const { pts, minY, maxY } of rings) {
    if (lat < minY || lat > maxY) continue;
    const xs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      if (y0 !== y1 && y0 <= lat !== y1 <= lat) xs.push(x0 + ((lat - y0) * (x1 - x0)) / (y1 - y0));
    }
    xs.sort((a, b) => a - b);
    for (let p = 0; p + 1 < xs.length; p += 2) {
      const i0 = Math.ceil(((xs[p] + 180) * W) / 360 - 0.5);
      const i1 = Math.floor(((xs[p + 1] + 180) * W) / 360 - 0.5);
      for (let i = i0; i <= i1; i++) mask[j * W + (((i % W) + W) % W)] ^= 1;
    }
  }
}

// 3. Color por altitud o profundidad y sombreado con luz del noroeste
const az = (315 * Math.PI) / 180;
const alt = (45 * Math.PI) / 180;
const L = [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
const rgb = new Uint8Array(W * H * 3);
const dy = (Math.PI * R) / H;
for (let j = 0; j < H; j++) {
  const lat = 90 - ((j + 0.5) * 180) / H;
  const dx = Math.max(1000, ((2 * Math.PI * R) / W) * Math.cos((lat * Math.PI) / 180));
  const jn = Math.max(0, j - 1);
  const js = Math.min(H - 1, j + 1);
  for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const isLand = mask[k] === 1;
    const zf = isLand ? Z_LAND : Z_SEA;
    const e = (ie, je) => elev[je * W + ((ie + W) % W)];
    const dzdx = ((e(i + 1, j) - e(i - 1, j)) / (2 * dx)) * zf;
    const dzdy = ((e(i, jn) - e(i, js)) / ((js - jn) * dy)) * zf;
    const n = [-dzdx, -dzdy, 1];
    const len = Math.hypot(...n);
    const shade = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len) / L[2];
    const z = elev[k];
    const base = isLand ? ramp(LAND, Math.max(0, z)) : ramp(SEA, Math.min(0, z));
    const strength = isLand ? 0.8 : 0.6;
    const f = 1 + (Math.max(0.3, Math.min(1.4, shade)) - 1) * strength;
    for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.max(0, Math.min(255, Math.round(base[c] * f)));
  }
}

// 4. Dos tamaños: pantallas grandes y móviles
function encode(w, h, src, sw) {
  const step = sw / w;
  const data = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let a = 0; a < step; a++) for (let b = 0; b < step; b++) s += src[((j * step + a) * sw + i * step + b) * 3 + c];
        data[(j * w + i) * 4 + c] = s / (step * step);
        data[(j * w + i) * 4 + 3] = 255;
      }
  return jpeg.encode({ data, width: w, height: h }, 84).data;
}
await mkdir(OUT, { recursive: true });
for (const [w, name] of [
  [4096, "relief-4096.jpg"],
  [2048, "relief-2048.jpg"],
]) {
  const jpg = encode(w, w / 2, rgb, W);
  await writeFile(new URL(name, OUT), jpg);
  console.log(`${name}: ${(jpg.length / 1e6).toFixed(2)} MB`);
}
