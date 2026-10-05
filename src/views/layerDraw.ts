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
  /** Con relieve debajo, la tierra no se rellena y los contornos llevan halo */
  relief = false,
) {
  const L = activeLayer();
  if (!relief) {
    ctx.beginPath();
    path(world.collection);
    ctx.fillStyle = pal.land;
    if (L.year !== null) ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (L.year !== null)
    for (const c of L.countries) {
      ctx.beginPath();
      path(c.feature);
      ctx.globalAlpha = relief ? (c.people ? 0.1 : 0.34) : c.people ? 0.25 : 0.72;
      ctx.fillStyle = c.color!;
      ctx.fill();
    }
  ctx.globalAlpha = 1;

  const selected = state.selected ? world.byKey.get(state.selected) : null;
  const marks = [
    [hovered, pal.hover],
    [selected, pal.select],
  ] as const;
  // Sin relieve se rellena; con relieve un relleno azul se confundiría con el mar,
  // así que la selección se marca con contorno (se dibuja después de las fronteras)
  if (!relief)
    for (const [c, color] of marks) {
      if (!c) continue;
      ctx.beginPath();
      path(c.feature);
      ctx.fillStyle = color;
      ctx.fill();
    }

  ctx.beginPath();
  path(L.borders);
  if (relief) {
    // Halo oscuro y línea clara: se leen sobre montañas, llanuras y mar
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 0.8;
  } else {
    ctx.strokeStyle = pal.landStroke;
    ctx.lineWidth = L.year === null ? 0.5 : 0.8;
  }
  ctx.stroke();
  if (L.approx) {
    ctx.beginPath();
    path(L.approx);
    ctx.setLineDash([3 / zoom ** 0.2, 3 / zoom ** 0.2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (relief)
    for (const [c, color] of marks) {
      if (!c) continue;
      ctx.beginPath();
      path(c.feature);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = c === selected ? 4.5 : 3;
      ctx.stroke();
      ctx.strokeStyle = c === selected ? color : "rgba(255,255,255,0.95)";
      ctx.lineWidth = c === selected ? 2.4 : 1.4;
      ctx.stroke();
    }
}
