import type { Position } from "geojson";
import type { Geo, LonLat } from "../types";

const RAD = Math.PI / 180;

export const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat));
export const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * Rotación de la esfera que lleva `from` a `to` manteniendo el norte arriba:
 * primero desplaza la latitud a lo largo del meridiano y luego gira alrededor
 * del eje polar. Conserva forma y área: el país no se deforma, solo cambia de sitio.
 */
export function mover(from: LonLat, to: LonLat): (p: Position) => Position {
  const theta = (to[1] - from[1]) * RAD;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return ([lon, lat]) => {
    const l = (lon - from[0]) * RAD;
    const p = lat * RAD;
    const x = Math.cos(p) * Math.cos(l);
    const y = Math.cos(p) * Math.sin(l);
    const z = Math.sin(p);
    const x2 = x * cosT - z * sinT;
    const z2 = x * sinT + z * cosT;
    return [
      wrapLon(Math.atan2(y, x2) / RAD + to[0]),
      Math.asin(Math.max(-1, Math.min(1, z2))) / RAD,
    ];
  };
}

export function moveFeature(f: Geo, from: LonLat, to: LonLat): Geo {
  const m = mover(from, to);
  const ring = (r: Position[]) => r.map(m);
  const g = f.geometry;
  return {
    ...f,
    geometry:
      g.type === "Polygon"
        ? { type: "Polygon", coordinates: g.coordinates.map(ring) }
        : { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(ring)) },
  };
}
