// Genera public/data/history/: fronteras históricas de historical-basemaps
// (A. Ourednik, GPL-3.0), en TopoJSON simplificado, un archivo por año.
// Ejecutar: npm run history  (HISTORY_CACHE=<dir> reutiliza descargas)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { geoArea } from "d3";
import { quantize } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify, sphericalTriangleArea } from "topojson-simplify";

const BASE = "https://raw.githubusercontent.com/aourednik/historical-basemaps/master";
const OUT = new URL("../public/data/history/", import.meta.url);
const CACHE = process.env.HISTORY_CACHE;

// Valores de SUBJECTO que no son un estado (pueblos, notas, errores) y no deben agrupar
const NOT_A_STATE = new Set(["1", "3", "Slavic tribes", "Gros Ventre", "Bega", "Suom", "Papu", "(Russian and Japanese claim)"]);
// Grafías distintas de la misma potencia
const ALIAS = {
  UK: "United Kingdom",
  "Great Britain": "United Kingdom",
  "United Kingdom of Great Britain and Ireland": "United Kingdom",
  Danemark: "Denmark",
  Neterlands: "Netherlands",
  "United States": "USA",
  "Spanish Habsburg": "Spain",
};

async function get(path) {
  const cached = CACHE && join(CACHE, path.split("/").pop());
  if (cached && existsSync(cached)) return JSON.parse(await readFile(cached, "utf8"));
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/** d3 espera el anillo exterior en sentido horario; si un polígono cubre más de media esfera está invertido. */
function rewind(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const p of polys)
    if (geoArea({ type: "Polygon", coordinates: p }) > 2 * Math.PI) p.forEach((ring) => ring.reverse());
}

const index = await get("index.json");
// Antes de 2000 a. C. el dataset muestra culturas y especies, no estados
const entries = index.years.filter((e) => e.year >= -2000).sort((a, b) => a.year - b.year);
const years = entries.map((e) => e.year);

await mkdir(OUT, { recursive: true });
let total = 0;
for (const { year, filename } of entries) {
  const fc = await get(`geojson/${filename}`);
  const features = [];
  for (const f of fc.features) {
    if (!f.geometry || !f.properties?.NAME) continue;
    rewind(f.geometry);
    const sub = f.properties.SUBJECTO;
    const s = sub && !NOT_A_STATE.has(sub) ? ALIAS[sub] ?? sub : null;
    features.push({
      type: "Feature",
      properties: { n: f.properties.NAME, s: s && s !== f.properties.NAME ? s : null, p: f.properties.BORDERPRECISION ?? 1 },
      geometry: f.geometry,
    });
  }
  let topo = topology({ entities: { type: "FeatureCollection", features } });
  topo = presimplify(topo, sphericalTriangleArea);
  topo = simplify(topo, quantile(topo, 0.8));
  // Re-cuantizar descarta los pesos de simplificación y codifica en deltas
  topo = quantize(topo, 2e4);
  const json = JSON.stringify(topo);
  total += json.length;
  await writeFile(new URL(`world_${year}.json`, OUT), json);
  console.log(`${year}: ${features.length} entidades, ${(json.length / 1024).toFixed(0)} KB`);
}
await writeFile(new URL("index.json", OUT), JSON.stringify({ years }));
console.log(`OK: ${years.length} años, ${(total / 1e6).toFixed(1)} MB`);
