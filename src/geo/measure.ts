import {
  geoArea,
  geoAzimuthalEqualArea,
  geoCentroid,
  geoDistance,
  geoLength,
  geoPath,
  polygonHull,
} from "d3";
import type { MultiPolygon, Polygon, Position } from "geojson";
import type { Dimensions, Geo, LonLat } from "../types";

/** Radio medio de la Tierra (IUGG), km */
export const EARTH_RADIUS_KM = 6371.0088;
/** Superficie de tierra emergida del planeta, km² */
export const LAND_AREA_KM2 = 148_940_000;
const R = EARTH_RADIUS_KM;

export function areaKm2(g: Geo | Polygon | MultiPolygon): number {
  return geoArea(g) * R * R;
}

export function parts(f: Geo): Polygon[] {
  const g = f.geometry;
  return g.type === "Polygon"
    ? [g]
    : g.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
}

export function anchorOf(f: Geo): LonLat {
  let best = parts(f)[0];
  let bestArea = -1;
  for (const p of parts(f)) {
    const a = geoArea(p);
    if (a > bestArea) [best, bestArea] = [p, a];
  }
  return geoCentroid(best) as LonLat;
}

/** Partes con al menos 20 % del área de la mayor, o a menos de 3.000 km del núcleo. */
export function mainTerritory(f: Geo, anchor: LonLat): Geo {
  const ps = parts(f);
  if (ps.length === 1) return f;
  const areas = ps.map((p) => geoArea(p));
  const max = Math.max(...areas);
  const keep = ps.filter(
    (p, i) => areas[i] >= 0.2 * max || geoDistance(geoCentroid(p), anchor) * R <= 3000,
  );
  return {
    type: "Feature",
    properties: f.properties,
    geometry: { type: "MultiPolygon", coordinates: keep.map((p) => p.coordinates) },
  };
}

/** Proyección azimutal de áreas iguales centrada en el país, con unidades en km. */
export function localProjection(anchor: LonLat) {
  return geoAzimuthalEqualArea()
    .rotate([-anchor[0], -anchor[1]])
    .scale(R)
    .translate([0, 0]);
}

function outerRingPoints(f: Geo): Position[] {
  return parts(f).flatMap((p) => p.coordinates[0]);
}

export function dimensions(main: Geo, anchor: LonLat): Dimensions {
  const proj = localProjection(anchor);
  const [[x0, y0], [x1, y1]] = geoPath(proj).bounds(main);
  const xy = outerRingPoints(main)
    .map((p) => proj(p as LonLat))
    .filter((p): p is [number, number] => !!p);
  const hull = (polygonHull(xy) ?? xy).map((p) => proj.invert!(p) as LonLat);
  let diameter = 0;
  for (let i = 0; i < hull.length; i++)
    for (let j = i + 1; j < hull.length; j++)
      diameter = Math.max(diameter, geoDistance(hull[i], hull[j]));
  return {
    width: x1 - x0,
    height: y1 - y0,
    diameter: diameter * R,
    perimeter: geoLength(main) * R,
  };
}

/** Cuánto agranda Mercator el área a esta latitud, respecto al ecuador. */
export function mercatorFactor(lat: number): number {
  const c = Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180);
  return 1 / (c * c);
}
