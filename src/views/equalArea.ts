import {
  geoCircle,
  geoEqualEarth,
  geoEqualEarthRaw,
  geoGraticule10,
  geoMercator,
  geoMercatorRaw,
  geoPath,
  geoProjection,
  type GeoProjection,
} from "d3";
import type { World } from "../geo/load";
import { countryAt } from "../geo/hit";
import { setState, state, subscribe } from "../state";
import type { Country, LonLat } from "../types";
import type { Tooltip } from "../ui/tooltip";
import { makeCanvas, palette, reducedMotion, scheduler } from "./canvas";
import { attachGestures } from "./gestures";
import { drawGhosts, ghostAt, ghostDrag } from "./truesize";

// Semiancho y semialto de Equal Earth en unidades de la proyección cruda
const EE_X = 2.7064;
const EE_Y = 1.3174;
const MAX_LAT = (85 * Math.PI) / 180;
const TISSOT_DEG = 2.5;
// Rango vertical de Mercator que se encuadra: de 60° S al norte de Groenlandia (84° N)
const M_TOP = Math.log(Math.tan(Math.PI / 4 + (84 * Math.PI) / 360));
const M_BOTTOM = Math.log(Math.tan(Math.PI / 4 - (60 * Math.PI) / 360));

/** t = 0 → Equal Earth, t = 1 → Mercator; intermedios solo durante la animación. */
function projectionAt(t: number): GeoProjection {
  if (t <= 0) return geoEqualEarth();
  if (t >= 1) return geoMercator();
  return geoProjection((l: number, p: number) => {
    const a = geoEqualEarthRaw(l, p);
    const b = geoMercatorRaw(l, Math.max(-MAX_LAT, Math.min(MAX_LAT, p)));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  });
}

const tissot = (() => {
  const circles = [];
  for (let lat = -75; lat <= 75; lat += 15)
    for (let lon = -165; lon <= 165; lon += 30)
      circles.push(geoCircle().center([lon, lat]).radius(TISSOT_DEG)());
  return { type: "GeometryCollection", geometries: circles } as const;
})();

export function createMap(el: HTMLElement, world: World, tooltip: Tooltip) {
  el.insertAdjacentHTML(
    "beforeend",
    `<div class="map-tools">
      <div class="seg" role="radiogroup" aria-label="Proyección">
        <button role="radio" data-proj="equal">Áreas reales</button>
        <button role="radio" data-proj="mercator">Mercator</button>
      </div>
      <label class="check"><input type="checkbox" data-tissot> Círculos de distorsión</label>
      <button class="ghost-btn" data-reset title="Volver a la vista completa">Recentrar</button>
    </div>
    <p class="map-hint"></p>`,
  );
  const hint = el.querySelector<HTMLElement>(".map-hint")!;
  el.querySelectorAll<HTMLButtonElement>("[data-proj]").forEach((b) =>
    b.addEventListener("click", () => setState({ projection: b.dataset.proj as "equal" | "mercator" })),
  );
  el.querySelector<HTMLInputElement>("[data-tissot]")!.addEventListener("change", (e) =>
    setState({ tissot: (e.target as HTMLInputElement).checked }),
  );
  el.querySelector("[data-reset]")!.addEventListener("click", () => {
    k = 1;
    pan = [0, 0];
    request();
  });

  const graticule = geoGraticule10();
  let t = state.projection === "mercator" ? 1 : 0;
  let proj = projectionAt(t);
  let k = 1;
  let pan: [number, number] = [0, 0];
  let animating = 0;
  let hovered: Country | null = null;
  let drag: ((p: LonLat | null | undefined) => void) | null = null;
  let activeGhost: number | null = null;

  const { canvas, ctx, size } = makeCanvas(el, () => request());
  const request = scheduler(draw);
  const invert = (p: [number, number]) => (proj.invert ? (proj.invert(p) as LonLat) : null);

  function layout() {
    const { w, h } = size;
    const sEE = Math.min(w / (2 * EE_X), h / (2 * EE_Y)) * 0.96;
    const sM = Math.min(w / (2 * Math.PI), (h * 0.96) / (M_TOP - M_BOTTOM));
    const s = (sEE + (sM - sEE) * t) * k;
    // En Mercator se centra el rango 60° S–84° N en vez del ecuador
    const shift = ((M_TOP + M_BOTTOM) / 2) * s * t;
    proj.scale(s).translate([w / 2 + pan[0], h / 2 + shift + pan[1]]);
  }

  function draw() {
    const { w, h } = size;
    if (!w) return;
    layout();
    const path = geoPath(proj, ctx);
    const pal = palette();
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = pal.ocean;
    ctx.fill();

    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = pal.grat;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    ctx.beginPath();
    path(world.collection);
    ctx.fillStyle = pal.land;
    ctx.fill();

    for (const [c, color] of [
      [hovered, pal.hover],
      [state.selected ? world.byKey.get(state.selected) : null, pal.select],
    ] as const) {
      if (!c) continue;
      ctx.beginPath();
      path(c.feature);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.beginPath();
    path(world.borders);
    ctx.strokeStyle = pal.landStroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (state.tissot) {
      ctx.beginPath();
      path(tissot);
      ctx.fillStyle = pal.tissot;
      ctx.fill();
    }

    drawGhosts(ctx, path, proj, world, pal, { mercator: t === 1, active: activeGhost });
  }

  function animateTo(target: number) {
    const from = t;
    const id = ++animating;
    const dur = reducedMotion ? 0 : 900;
    const t0 = performance.now();
    const step = (now: number) => {
      if (id !== animating) return;
      const u = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      t = u === 1 ? target : from + (target - from) * e;
      proj = projectionAt(t);
      draw();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  attachGestures(canvas, {
    down(p) {
      const ll = invert(p);
      const g = ghostAt(ll);
      drag = g && ll ? ghostDrag(world, g, ll) : null;
      activeGhost = g?.id ?? null;
      tooltip.hide();
    },
    move(p, dx, dy) {
      if (drag) return drag(invert(p));
      pan = [pan[0] + dx, pan[1] + dy];
      request();
    },
    up(p, moved) {
      if (!moved && !drag) {
        const c = countryAt(world.countries, invert(p));
        setState({ selected: c?.key ?? null });
      }
      drag = null;
      activeGhost = null;
      request();
    },
    zoom(f, [px, py]) {
      const nk = Math.max(1, Math.min(24, k * f));
      const ff = nk / k;
      const cx = size.w / 2;
      const cy = size.h / 2;
      pan = [px - cx - ff * (px - cx - pan[0]), py - cy - ff * (py - cy - pan[1])];
      if (nk === 1) pan = [0, 0];
      k = nk;
      request();
    },
    hover(p) {
      const ll = p ? invert(p) : null;
      const onGhost = ghostAt(ll);
      const c = p && !onGhost ? countryAt(world.countries, ll) : null;
      canvas.style.cursor = onGhost ? "grab" : c ? "pointer" : "default";
      if (c !== hovered) {
        hovered = c;
        request();
      }
      if (p && c) tooltip.show(c, p);
      else tooltip.hide();
    },
  });

  function syncControls() {
    el.querySelectorAll<HTMLButtonElement>("[data-proj]").forEach((b) =>
      b.setAttribute("aria-checked", String(b.dataset.proj === state.projection)),
    );
    el.querySelector<HTMLInputElement>("[data-tissot]")!.checked = state.tissot;
    const tissotNote = state.tissot
      ? ` Todos los círculos miden lo mismo en la realidad (${TISSOT_DEG}° de radio, unos 278 km).`
      : "";
    hint.textContent =
      (state.projection === "mercator"
        ? "Así se ven Google Maps y casi todos los mapas escolares: cuanto más lejos del ecuador, más se infla. Arrastra un país hacia el ecuador y mira cómo se encoge."
        : "Proyección Equal Earth: cada país ocupa en pantalla un área proporcional a la real. Busca un país y pulsa «Mover» para llevarlo encima de otro.") +
      tissotNote;
  }

  let lastProjection = state.projection;
  subscribe(() => {
    if (state.projection !== lastProjection) {
      lastProjection = state.projection;
      animateTo(state.projection === "mercator" ? 1 : 0);
    }
    syncControls();
    if (state.view === "map") request();
  });
  syncControls();

  return { request };
}
