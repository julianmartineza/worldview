/**
 * Inversa de la proyección ortográfica de d3 con rotate([λ, φ]), escrita sin d3
 * para que el shader de relieve (src/views/reliefGL.ts) pueda replicarla línea a línea.
 * Devuelve [lon, lat] en grados, o null si el píxel cae fuera del disco.
 */
export function orthoInvert(
  px: number,
  py: number,
  scale: number,
  [tx, ty]: [number, number],
  [lambda, phi]: [number, number],
): [number, number] | null {
  const x = (px - tx) / scale;
  const y = (ty - py) / scale;
  const r2 = x * x + y * y;
  if (r2 > 1) return null;
  const z = Math.sqrt(1 - r2);
  // Punto en el marco rotado: (cos φ' cos λ', cos φ' sin λ', sin φ') = (z, x, y)
  const p = (phi * Math.PI) / 180;
  const cx = z * Math.cos(p) + y * Math.sin(p);
  const cz = -z * Math.sin(p) + y * Math.cos(p);
  const lon = (Math.atan2(x, cx) * 180) / Math.PI - lambda;
  const lat = (Math.asin(Math.max(-1, Math.min(1, cz))) * 180) / Math.PI;
  return [((((lon + 180) % 360) + 360) % 360) - 180, lat];
}
