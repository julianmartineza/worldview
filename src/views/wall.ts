import { geoPath } from "d3";
import { km2Short } from "../format";
import type { World } from "../geo/load";
import { localProjection } from "../geo/measure";
import { activeLayer } from "../layer";
import { setState, state, subscribe } from "../state";
import type { Country } from "../types";
import type { Tooltip } from "../ui/tooltip";
import { makeCanvas, palette, reducedMotion, scheduler } from "./canvas";
import { attachGestures } from "./gestures";

type Order = "area" | "region" | "name";

const REGIONS = ["Asia", "Africa", "Americas", "Europe", "Oceania", "Antarctic", "Otros"] as const;
const REGION_NAME: Record<string, string> = {
  Asia: "Asia",
  Africa: "África",
  Americas: "América",
  Europe: "Europa",
  Oceania: "Oceanía",
  Antarctic: "Antártida",
  Otros: "Otros territorios",
};
const REGION_COLOR: Record<string, string> = {
  Asia: "#e4572e",
  Africa: "#d4a017",
  Americas: "#2e86de",
  Europe: "#8e5bd6",
  Oceania: "#17a398",
  Antarctic: "#8a96a6",
  Otros: "#8a96a6",
};
// Por debajo de este tamaño en pantalla (px) un país no se distingue
const TINY_PX = 2;

interface Shape {
  c: Country;
  region: string;
  path: Path2D;
  /** Esquina superior izquierda del contorno en km, en su proyección local */
  x0: number;
  y0: number;
  w: number;
  h: number;
}

interface Tile extends Shape {
  /** Posición en el muro, km */
  x: number;
  y: number;
}

interface Layout {
  tiles: Tile[];
  headers: { text: string; y: number }[];
  width: number;
  height: number;
}

/** Filas de izquierda a derecha, alineadas por la base como un horizonte. */
function pack(shapes: Shape[], rowWidth: number, gap: number, top: number): { tiles: Tile[]; bottom: number } {
  const rows: Shape[][] = [[]];
  let x = 0;
  for (const s of shapes) {
    if (x > 0 && x + s.w > rowWidth) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push(s);
    x += s.w + gap;
  }
  const tiles: Tile[] = [];
  let y = top;
  for (const row of rows) {
    if (!row.length) continue;
    const rowH = Math.max(...row.map((s) => s.h));
    let rx = 0;
    for (const s of row) {
      tiles.push({ ...s, x: rx, y: y + rowH - s.h });
      rx += s.w + gap;
    }
    y += rowH + gap;
  }
  return { tiles, bottom: y };
}

/** Prueba varios anchos de fila y se queda con el que más agranda el muro en pantalla. */
function layout(shapes: Shape[], order: Order, viewW: number, viewH: number): Layout {
  const box = shapes.reduce((sum, s) => sum + s.w * s.h, 0);
  const gap = Math.sqrt(box) * 0.015;
  const padded = shapes.reduce((sum, s) => sum + (s.w + gap) * (s.h + gap), 0);
  const base = Math.sqrt(padded * (viewW / viewH));
  const minW = Math.max(...shapes.map((s) => s.w));
  let best: Layout | null = null;
  let bestK = 0;
  for (let m = 0.8; m <= 3; m += 0.1) {
    const l = layoutWith(shapes, order, Math.max(minW, base * m), gap);
    const k = Math.min(viewW / l.width, viewH / l.height);
    if (k > bestK) [best, bestK] = [l, k];
  }
  return best!;
}

function layoutWith(shapes: Shape[], order: Order, width: number, gap: number): Layout {
  const byArea = (a: Shape, b: Shape) => b.c.area - a.c.area;

  if (order !== "region") {
    const sorted = [...shapes].sort(order === "area" ? byArea : (a, b) => a.c.name.localeCompare(b.c.name, "es"));
    const { tiles, bottom } = pack(sorted, width, gap, 0);
    return { tiles, headers: [], width, height: bottom - gap };
  }

  const tiles: Tile[] = [];
  const headers: Layout["headers"] = [];
  const headerSpace = gap * 4;
  let y = 0;
  for (const r of REGIONS) {
    const group = shapes.filter((s) => s.region === r).sort(byArea);
    if (!group.length) continue;
    headers.push({ text: REGION_NAME[r], y: y + headerSpace * 0.7 });
    const res = pack(group, width, gap, y + headerSpace);
    tiles.push(...res.tiles);
    y = res.bottom + gap;
  }
  return { tiles, headers, width, height: y - 2 * gap };
}

export function createWall(el: HTMLElement, world: World, tooltip: Tooltip) {
  el.insertAdjacentHTML(
    "beforeend",
    `<div class="map-tools">
      <div class="seg" role="radiogroup" aria-label="Orden">
        <button role="radio" data-order="area">Por tamaño</button>
        <button role="radio" data-order="region">Por continente</button>
        <button role="radio" data-order="name">A–Z</button>
      </div>
      <label class="check">Mostrar
        <select data-region aria-label="Filtrar por continente">
          <option value="">todo el mundo</option>
          ${REGIONS.slice(0, 6).map((r) => `<option value="${r}">${REGION_NAME[r]}</option>`).join("")}
        </select>
      </label>
      <button class="ghost-btn" data-reset>Recentrar</button>
      <div class="legend">${REGIONS.slice(0, 6)
        .map((r) => `<span><i style="background:${REGION_COLOR[r]}"></i>${REGION_NAME[r]}</span>`)
        .join("")}</div>
    </div>
    <p class="map-hint"></p>`,
  );
  const hint = el.querySelector<HTMLElement>(".map-hint")!;
  const regionSelect = el.querySelector<HTMLSelectElement>("[data-region]")!;

  const cache = new Map<number | null, Shape[]>();
  /** Siluetas de la época activa; los pueblos sin estado no entran en el muro. */
  function shapesNow(): Shape[] {
    const L = activeLayer();
    let list = cache.get(L.year);
    if (!list) {
      list = L.countries
        .filter((c) => !c.people)
        .map((c) => {
          const p = geoPath(localProjection(c.anchor));
          const [[x0, y0], [x1, y1]] = p.bounds(c.main);
          return {
            c,
            region: c.region && c.region in REGION_NAME ? c.region : "Otros",
            path: new Path2D(p(c.main) ?? ""),
            x0,
            y0,
            w: x1 - x0,
            h: y1 - y0,
          };
        });
      cache.set(L.year, list);
    }
    return list;
  }

  let order: Order = "area";
  let region = "";
  let lay: Layout = { tiles: [], headers: [], width: 1, height: 1 };
  let k = 1;
  let k0 = 1;
  let tx = 0;
  let ty = 0;
  let hovered: Tile | null = null;
  let flight = 0;
  let lastHint = "";

  const { canvas, ctx, size } = makeCanvas(el, () => {
    relayout();
    fit();
  });
  const request = scheduler(draw);
  const tools = el.querySelector<HTMLElement>(".map-tools")!;
  let TOP = 64; // espacio para los controles superiores
  let BOTTOM = 56; // espacio para la nota inferior

  let dirty = false;

  function relayout() {
    // Oculto no tiene tamaño: se recalcula al volver a mostrarse
    if (!size.w || state.view !== "wall") {
      dirty = true;
      return;
    }
    dirty = false;
    TOP = tools.offsetTop + tools.offsetHeight + 16;
    // Se reservan tres líneas de nota aunque ahora ocupe menos: su texto cambia con el zoom
    BOTTOM = size.h - (hint.offsetTop + hint.offsetHeight) + 3 * 19 + 20;
    const shapes = shapesNow();
    const historic = activeLayer().year !== null;
    const visible = region && !historic ? shapes.filter((s) => s.region === region) : shapes;
    lay = layout(visible, historic && order === "region" ? "area" : order, size.w - 32, Math.max(100, size.h - TOP - BOTTOM));
  }

  function fitTransform() {
    const kFit = Math.min((size.w - 32) / lay.width, (size.h - TOP - BOTTOM) / lay.height);
    return {
      k: kFit,
      tx: (size.w - lay.width * kFit) / 2,
      ty: TOP + (size.h - TOP - BOTTOM - lay.height * kFit) / 2,
    };
  }

  function fit() {
    if (dirty) return;
    ({ k, tx, ty } = fitTransform());
    k0 = k;
    request();
  }

  function animateTo(target: { k: number; tx: number; ty: number }) {
    const from = { k, tx, ty };
    const id = ++flight;
    const dur = reducedMotion ? 0 : 700;
    const t0 = performance.now();
    const step = (now: number) => {
      if (id !== flight) return;
      const u = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      // El zoom se interpola en escala logarítmica para que se sienta uniforme
      k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
      const s = (k - from.k) / (target.k - from.k || 1);
      tx = from.tx + (target.tx - from.tx) * (target.k === from.k ? e : s);
      ty = from.ty + (target.ty - from.ty) * (target.k === from.k ? e : s);
      draw();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function focus(c: Country) {
    let tile = lay.tiles.find((t) => t.c === c);
    if (!tile && region) {
      // El país está fuera del filtro: se muestra todo el mundo
      region = "";
      regionSelect.value = "";
      relayout();
      fit();
      tile = lay.tiles.find((t) => t.c === c);
    }
    if (!tile) return;
    const view = Math.min(size.w, size.h - TOP - BOTTOM);
    const nk = Math.max(k0, Math.min(kMax(), (view * 0.4) / Math.max(tile.w, tile.h)));
    const cx = tile.x + tile.w / 2;
    const cy = tile.y + tile.h / 2;
    animateTo({ k: nk, tx: size.w / 2 - cx * nk, ty: TOP + (size.h - TOP - BOTTOM) / 2 - cy * nk });
  }

  // Suficiente para ver el Vaticano (menos de 1 km de ancho)
  const kMax = () => 60;

  function tileAt([px, py]: [number, number]): Tile | null {
    const lx = (px - tx) / k;
    const ly = (py - ty) / k;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let hit: Tile | null = null;
    for (const t of lay.tiles) {
      // Margen de 4 px para poder atinar a los países diminutos
      const m = 4 / k;
      if (lx < t.x - m || lx > t.x + t.w + m || ly < t.y - m || ly > t.y + t.h + m) continue;
      const tiny = Math.max(t.w, t.h) * k < 8;
      if (tiny || ctx.isPointInPath(t.path, lx - t.x + t.x0, ly - t.y + t.y0)) {
        hit = t;
        break;
      }
    }
    ctx.restore();
    return hit;
  }

  function draw() {
    const { w, h } = size;
    if (!w) return;
    const dpr = window.devicePixelRatio || 1;
    const pal = palette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let tiny = 0;
    for (const t of lay.tiles) {
      const sx = tx + t.x * k;
      const sy = ty + t.y * k;
      if (sx > w || sy > h || sx + t.w * k < 0 || sy + t.h * k < 0) continue;
      if (Math.max(t.w, t.h) * k < TINY_PX) tiny++;
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (sx - t.x0 * k), dpr * (sy - t.y0 * k));
      const selected = t.c.key === state.selected;
      ctx.globalAlpha = selected || t === hovered ? 1 : 0.82;
      ctx.fillStyle = selected ? pal.select : t.c.color ?? REGION_COLOR[t.region];
      ctx.fill(t.path);
      ctx.globalAlpha = 1;
      if (selected || t === hovered) {
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = pal.text;
        ctx.stroke(t.path);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.textAlign = "left";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillStyle = pal.text;
    for (const hd of lay.headers) ctx.fillText(hd.text, tx, ty + hd.y * k);

    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (const t of lay.tiles) {
      const sw = t.w * k;
      const sh = t.h * k;
      if (sw < 56 || sh < 22) continue;
      const cx = tx + (t.x + t.w / 2) * k;
      const cy = ty + (t.y + t.h / 2) * k;
      if (cx < -100 || cx > w + 100 || cy < -40 || cy > h + 40) continue;
      const lines = sh > 44 ? [t.c.name, km2Short(t.c.officialArea ?? t.c.area)] : [t.c.name];
      ctx.font = "600 12px system-ui, sans-serif";
      if (ctx.measureText(t.c.name).width > sw * 2) continue;
      lines.forEach((text, i) => {
        ctx.font = i === 0 ? "600 12px system-ui, sans-serif" : "11px system-ui, sans-serif";
        const y = cy + (i - (lines.length - 1) / 2) * 14 + 4;
        ctx.strokeStyle = pal.halo;
        ctx.lineWidth = 3;
        ctx.strokeText(text, cx, y);
        ctx.fillStyle = pal.text;
        ctx.fillText(text, cx, y);
      });
    }

    const text =
      (activeLayer().year === null
        ? "Todos los países a la misma escala y sin distorsión (territorio principal)."
        : "Todos los estados de esa época a la misma escala; no incluye pueblos sin estado. Fronteras aproximadas.") +
      " Rueda o pellizco para acercar." +
      (tiny ? ` ${tiny} ${tiny === 1 ? "país es demasiado pequeño" : "países son demasiado pequeños"} para verse a esta escala.` : "");
    if (text !== lastHint) hint.textContent = lastHint = text;
  }

  attachGestures(canvas, {
    down() {
      flight++;
      tooltip.hide();
    },
    move(_p, dx, dy) {
      tx += dx;
      ty += dy;
      request();
    },
    up(p, moved) {
      if (!moved) setState({ selected: tileAt(p)?.c.key ?? null });
    },
    zoom(f, [px, py]) {
      flight++;
      const nk = Math.max(k0 * 0.8, Math.min(kMax(), k * f));
      tx = px - ((px - tx) * nk) / k;
      ty = py - ((py - ty) * nk) / k;
      k = nk;
      request();
    },
    hover(p) {
      const t = p ? tileAt(p) : null;
      canvas.style.cursor = t ? "pointer" : "grab";
      if (t !== hovered) {
        hovered = t;
        request();
      }
      if (p && t) tooltip.show(t.c, p);
      else tooltip.hide();
    },
  });

  el.querySelectorAll<HTMLButtonElement>("[data-order]").forEach((b) =>
    b.addEventListener("click", () => {
      order = b.dataset.order as Order;
      syncControls();
      relayout();
      fit();
    }),
  );
  regionSelect.addEventListener("change", () => {
    region = regionSelect.value;
    relayout();
    fit();
  });
  el.querySelector("[data-reset]")!.addEventListener("click", () => animateTo(fitTransform()));

  function syncControls() {
    const historic = activeLayer().year !== null;
    el.querySelectorAll<HTMLButtonElement>("[data-order]").forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.order === order || (historic && order === "region" && b.dataset.order === "area")));
      if (b.dataset.order === "region") b.hidden = historic;
    });
    // Los continentes solo aplican a los países actuales
    regionSelect.closest("label")!.hidden = historic;
    el.querySelector<HTMLElement>(".legend")!.hidden = historic;
  }
  syncControls();

  let lastSelected = state.selected;
  let lastView = state.view;
  let lastYear = state.year;
  subscribe(() => {
    if (state.year !== lastYear) {
      lastYear = state.year;
      syncControls();
      relayout();
      fit();
    }
    const entered = state.view === "wall" && lastView !== "wall";
    const changed = state.selected !== lastSelected;
    lastView = state.view;
    lastSelected = state.selected;
    if (state.view !== "wall") return;
    if (entered && dirty) {
      relayout();
      fit();
    }
    const c = state.selected ? world.byKey.get(state.selected) : null;
    // Al entrar se espera un cuadro para que el canvas tenga tamaño
    if (c && (changed || entered)) requestAnimationFrame(() => focus(c));
    request();
  });
}
