import { geoContains, type GeoPath, type GeoProjection } from "d3";
import { km2Short, label } from "../format";
import type { World } from "../geo/load";
import { mercatorFactor } from "../geo/measure";
import { clampLat, moveFeature, wrapLon } from "../geo/rotate";
import { setState, state } from "../state";
import type { Ghost, LonLat } from "../types";
import type { Palette } from "./canvas";

const COLORS = ["#e4572e", "#2e86de", "#17a398", "#d4a017", "#8e5bd6", "#d63384"];
let nextId = 1;

export function addGhost(world: World, key: string, target?: LonLat): Ghost {
  const c = world.byKey.get(key)!;
  const used = new Set(state.ghosts.map((g) => g.color));
  const color = COLORS.find((col) => !used.has(col)) ?? COLORS[nextId % COLORS.length];
  const t = target ?? c.anchor;
  const ghost: Ghost = { id: nextId++, key, color, target: t, moved: moveFeature(c.feature, c.anchor, t) };
  setState({ ghosts: [...state.ghosts, ghost] });
  return ghost;
}

export function moveGhost(world: World, id: number, target: LonLat) {
  const t: LonLat = [wrapLon(target[0]), clampLat(target[1])];
  setState({
    ghosts: state.ghosts.map((g) => {
      if (g.id !== id) return g;
      const c = world.byKey.get(g.key)!;
      return { ...g, target: t, moved: moveFeature(c.feature, c.anchor, t) };
    }),
  });
}

export function resetGhost(world: World, id: number) {
  const g = state.ghosts.find((x) => x.id === id);
  if (g) moveGhost(world, id, world.byKey.get(g.key)!.anchor);
}

export function removeGhost(id: number) {
  setState({ ghosts: state.ghosts.filter((g) => g.id !== id) });
}

export function ghostAt(p: LonLat | null | undefined): Ghost | null {
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  for (let i = state.ghosts.length - 1; i >= 0; i--)
    if (geoContains(state.ghosts[i].moved, p)) return state.ghosts[i];
  return null;
}

/** Arrastre de una silueta conservando el punto donde se agarró. */
export function ghostDrag(world: World, ghost: Ghost, grabbed: LonLat) {
  const off: LonLat = [wrapLon(grabbed[0] - ghost.target[0]), grabbed[1] - ghost.target[1]];
  return (p: LonLat | null | undefined) => {
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    moveGhost(world, ghost.id, [p[0] - off[0], p[1] - off[1]]);
  };
}

export function drawGhosts(
  ctx: CanvasRenderingContext2D,
  path: GeoPath<any, any>,
  proj: GeoProjection,
  world: World,
  pal: Palette,
  opts: { visible?: (p: LonLat) => boolean; mercator?: boolean; active?: number | null },
) {
  for (const g of state.ghosts) {
    ctx.beginPath();
    path(g.moved);
    ctx.globalAlpha = g.id === opts.active ? 0.8 : 0.62;
    ctx.fillStyle = g.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const g of state.ghosts) {
    if (opts.visible && !opts.visible(g.target)) continue;
    const xy = proj(g.target);
    if (!xy) continue;
    // Etiqueta encima de la silueta para no taparla
    const top = path.bounds(g.moved)[0][1];
    const labelY = Number.isFinite(top) && top > 60 ? top - 8 : xy[1];
    const c = world.byKey.get(g.key)!;
    const lines = [label(c), km2Short(c.area)];
    if (opts.mercator) lines.push(`aquí aparenta ${km2Short(c.area * mercatorFactor(g.target[1]))}`);
    lines.forEach((text, i) => {
      ctx.font = i === 0 ? "600 13px system-ui, sans-serif" : "12px system-ui, sans-serif";
      const y = labelY === xy[1] ? xy[1] + (i - (lines.length - 1) / 2) * 15 + 4 : labelY - (lines.length - 1 - i) * 15;
      ctx.strokeStyle = pal.halo;
      ctx.lineWidth = 3.5;
      ctx.strokeText(text, xy[0], y);
      ctx.fillStyle = pal.text;
      ctx.fillText(text, xy[0], y);
    });
  }
}
