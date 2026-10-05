const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export const km2 = (n: number) => `${nf0.format(n)} km²`;
export const km = (n: number) => `${nf0.format(n)} km`;
export const num1 = (n: number) => nf1.format(n);

export function km2Short(n: number) {
  if (n >= 1e6) return `${nf2.format(n / 1e6)} M km²`;
  if (n >= 1e4) return `${nf0.format(n / 1e3)} mil km²`;
  return km2(n);
}

export function pct(n: number) {
  return `${n < 0.1 ? nf2.format(n) : nf1.format(n)} %`;
}

export function lat(n: number) {
  return `${nf1.format(Math.abs(n))}° ${n >= 0 ? "N" : "S"}`;
}

export function times(n: number) {
  return `${n < 10 ? nf1.format(n) : nf0.format(n)}×`;
}

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function formatYear(y: number) {
  return y < 0 ? `${-y} a. C.` : String(y);
}

/** Nombre con el año para entidades históricas: "Imperio mongol (1279)". */
export function label(c: { name: string; year?: number }) {
  return c.year === undefined ? c.name : `${c.name} (${formatYear(c.year)})`;
}
