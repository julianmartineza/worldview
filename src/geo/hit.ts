import { geoContains } from "d3";
import type { Country, LonLat } from "../types";

function inBounds([[x0, y0], [x1, y1]]: [LonLat, LonLat], [x, y]: LonLat) {
  if (y < y0 || y > y1) return false;
  return x0 <= x1 ? x >= x0 && x <= x1 : x >= x0 || x <= x1;
}

export function countryAt(countries: Country[], p: LonLat | null | undefined): Country | null {
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  for (const c of countries) if (inBounds(c.bounds, p) && geoContains(c.feature, p)) return c;
  return null;
}
