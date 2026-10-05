import type { GeoPath } from "d3";
import type { World } from "../geo/load";
import { activeLayer } from "../layer";
import { state } from "../state";
import type { Country } from "../types";
import type { Palette } from "./canvas";

/** Tierra, entidades, resaltados y fronteras de la época activa. */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  path: GeoPath<any, any>,
  world: World,
  pal: Palette,
  hovered: Country | null,
  zoom = 1,
) {
  const L = activeLayer();
  ctx.beginPath();
  path(world.collection);
  ctx.fillStyle = pal.land;
  if (L.year !== null) ctx.globalAlpha = 0.45;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (L.year !== null)
    for (const c of L.countries) {
      ctx.beginPath();
      path(c.feature);
      ctx.globalAlpha = c.people ? 0.25 : 0.72;
      ctx.fillStyle = c.color!;
      ctx.fill();
    }
  ctx.globalAlpha = 1;

  const selected = state.selected ? world.byKey.get(state.selected) : null;
  for (const [c, color] of [
    [hovered, pal.hover],
    [selected, pal.select],
  ] as const) {
    if (!c) continue;
    ctx.beginPath();
    path(c.feature);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.beginPath();
  path(L.borders);
  ctx.strokeStyle = pal.landStroke;
  ctx.lineWidth = L.year === null ? 0.5 : 0.8;
  ctx.stroke();
  if (L.approx) {
    ctx.beginPath();
    path(L.approx);
    ctx.setLineDash([3 / zoom ** 0.2, 3 / zoom ** 0.2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
