import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3";
import type { World } from "../geo/load";
import { countryAt } from "../geo/hit";
import { activeLayer } from "../layer";
import { drawLayer } from "./layerDraw";
import { setState, state, subscribe } from "../state";
import type { Country, LonLat } from "../types";
import { makeCanvas, palette, reducedMotion, scheduler } from "./canvas";
import { attachGestures } from "./gestures";
import { drawGhosts, ghostAt, ghostDrag } from "./truesize";
import type { Tooltip } from "../ui/tooltip";

export function createGlobe(el: HTMLElement, world: World, tooltip: Tooltip) {
  const proj = geoOrthographic().clipAngle(90).precision(0.4);
  const graticule = geoGraticule10();
  let rotation: [number, number] = [72, -8];
  let zoom = 1;
  let spinning = !reducedMotion;
  let hovered: Country | null = null;
  let drag: ((p: LonLat | null | undefined) => void) | null = null;
  let activeGhost: number | null = null;
  let flight = 0;

  const { canvas, ctx, size } = makeCanvas(el, () => request());
  const path = geoPath(proj, ctx);
  const request = scheduler(draw);
  const center = (): LonLat => [-rotation[0], -rotation[1]];
  const visible = (p: LonLat) => geoDistance(p, center()) < Math.PI / 2 - 0.05;

  function draw() {
    const { w, h } = size;
    if (!w) return;
    const r = (Math.min(w, h) / 2) * 0.92 * zoom;
    proj.scale(r).translate([w / 2, h / 2]).rotate([rotation[0], rotation[1], 0]);
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

    drawLayer(ctx, path, world, pal, hovered, zoom);

    drawGhosts(ctx, path, proj, world, pal, { visible, active: activeGhost });

    // Sombreado para dar volumen
    const [cx, cy] = proj.translate();
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, pal.shade);
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = pal.grat;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function spin() {
    if (!spinning) return;
    if (state.view === "globe") {
      rotation = [rotation[0] + 0.08, rotation[1]];
      draw();
    }
    requestAnimationFrame(spin);
  }
  requestAnimationFrame(spin);

  function flyTo(target: LonLat) {
    spinning = false;
    const from = center();
    const interp = geoInterpolate(from, target);
    const dur = reducedMotion ? 0 : Math.min(1400, 300 + geoDistance(from, target) * 500);
    const id = ++flight;
    const t0 = performance.now();
    const step = (now: number) => {
      if (id !== flight) return;
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const [lon, lat] = interp(e);
      rotation = [-lon, -lat];
      draw();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  attachGestures(canvas, {
    down(p) {
      spinning = false;
      flight++;
      const ll = proj.invert!(p) as LonLat;
      const g = ghostAt(ll);
      drag = g ? ghostDrag(world, g, ll) : null;
      activeGhost = g?.id ?? null;
      tooltip.hide();
    },
    move(p, dx, dy) {
      if (drag) return drag(proj.invert!(p) as LonLat);
      const k = 180 / Math.PI / proj.scale();
      rotation = [rotation[0] + dx * k, Math.max(-89, Math.min(89, rotation[1] - dy * k))];
      request();
    },
    up(p, moved) {
      if (!moved && !drag) {
        const c = countryAt(activeLayer().countries, proj.invert!(p) as LonLat);
        setState({ selected: c?.key ?? null });
      }
      drag = null;
      activeGhost = null;
      request();
    },
    zoom(f) {
      zoom = Math.max(0.6, Math.min(12, zoom * f));
      request();
    },
    hover(p) {
      const ll = p ? (proj.invert!(p) as LonLat) : null;
      const onGhost = ghostAt(ll);
      const c = p && !onGhost ? countryAt(activeLayer().countries, ll) : null;
      canvas.style.cursor = onGhost ? "grab" : c ? "pointer" : "default";
      if (c !== hovered) {
        hovered = c;
        request();
      }
      if (p && c) tooltip.show(c, p);
      else tooltip.hide();
    },
  });

  let lastSelected = state.selected;
  subscribe(() => {
    if (state.selected !== lastSelected) {
      lastSelected = state.selected;
      const c = state.selected ? world.byKey.get(state.selected) : null;
      if (c && state.view === "globe") flyTo(c.anchor);
    }
    if (state.view === "globe") request();
  });

  return { request, flyTo };
}
