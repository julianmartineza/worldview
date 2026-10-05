import { dimensions, parts } from "../geo/measure";
import type { Country, Dimensions } from "../types";

const cache = new Map<string, Dimensions>();

export function dims(c: Country): Dimensions {
  let d = cache.get(c.key);
  if (!d) cache.set(c.key, (d = dimensions(c.main, c.anchor)));
  return d;
}

/** Área de referencia: la oficial si existe, si no la del polígono. */
export const areaOf = (c: Country) => c.officialArea ?? c.area;

export const hasRemoteParts = (c: Country) => parts(c.main).length < parts(c.feature).length;
