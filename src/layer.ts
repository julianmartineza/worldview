import { loadYear, modernLayer, type Layer } from "./geo/history";
import type { World } from "./geo/load";
import { setState, state } from "./state";

let current: Layer | null = null;
let world: World;
let request = 0;

export function initLayer(w: World) {
  world = w;
  current = modernLayer(w);
}

export function activeLayer(): Layer {
  return current!;
}

/** Cambia de época; el estado solo se actualiza cuando el año ya está cargado. */
export async function setYear(year: number | null) {
  const id = ++request;
  const layer = year === null ? modernLayer(world) : await loadYear(world, year);
  if (id !== request) return;
  current = layer;
  const sel = state.selected ? world.byKey.get(state.selected) : null;
  // Una entidad de otra época no tiene sentido resaltada sobre este mapa
  const keep = !sel || sel.year === undefined || sel.year === year;
  setState({ year, selected: keep ? state.selected : null });
}
