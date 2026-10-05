import { esc } from "../format";

/** Un país actual (código ISO3) o una entidad histórica destacada (su key). */
export type Ref = string;

export interface Preset {
  /** ghost: lleva `from` encima de `to` en el mapa; compare: los abre en Comparar */
  kind?: "ghost" | "compare";
  from: Ref;
  to: Ref;
  title: string;
  text: string;
}

export const PRESETS: Preset[] = [
  {
    from: "GRL",
    to: "COD",
    title: "Groenlandia sobre África",
    text: "En los mapas comunes parece tan grande como África. Cabe 14 veces en ella.",
  },
  {
    from: "RUS",
    to: "CAF",
    title: "Rusia sobre África",
    text: "El país más grande del mundo ocupa poco más de la mitad de África.",
  },
  {
    from: "COL",
    to: "DEU",
    title: "Colombia sobre Europa",
    text: "Es más grande que Francia y Alemania juntas.",
  },
  {
    from: "BRA",
    to: "USA",
    title: "Brasil sobre Estados Unidos",
    text: "Brasil supera a los 48 estados contiguos de EE. UU.",
  },
  {
    from: "AUS",
    to: "POL",
    title: "Australia sobre Europa",
    text: "Casi el doble de la Unión Europea.",
  },
  {
    from: "IDN",
    to: "DEU",
    title: "Indonesia sobre Europa",
    text: "De punta a punta mide más que de Lisboa a Moscú.",
  },
];

// Cifras calculadas con historical-basemaps (ver tests/history.test.ts)
export const EMPIRE_PRESETS: Preset[] = [
  {
    kind: "compare",
    from: "h1279:Mongol Empire",
    to: "RUS",
    title: "Imperio mongol frente a Rusia",
    text: "En 1279 ocupaba 1,6 veces la Rusia actual.",
  },
  {
    kind: "ghost",
    from: "h100:Roman Empire",
    to: "USA",
    title: "Imperio romano sobre Estados Unidos",
    text: "En el año 100 abarcaba la mitad de lo que hoy mide EE. UU.",
  },
  {
    kind: "ghost",
    from: "h1530:Inca Empire",
    to: "DEU",
    title: "Imperio inca sobre Europa",
    text: "Casi 4.000 km de punta a punta, más que de Lisboa a Moscú.",
  },
  {
    kind: "compare",
    from: "h1783:Spain",
    to: "ESP",
    title: "Imperio español frente a España",
    text: "En 1783 medía 26 veces la España actual.",
  },
  {
    kind: "compare",
    from: "h1783:Spain:Viceroyalty of New Granada",
    to: "COL",
    title: "Nueva Granada frente a Colombia",
    text: "El virreinato de 1783 casi triplicaba la Colombia actual.",
  },
  {
    kind: "compare",
    from: "h1960:USSR",
    to: "RUS",
    title: "La URSS frente a Rusia",
    text: "Rusia conserva casi el 80 % del territorio soviético.",
  },
  {
    kind: "compare",
    from: "h-323:Empire of Alexander",
    to: "BRA",
    title: "Alejandro Magno frente a Brasil",
    text: "Su imperio ocupaba poco más de la mitad de Brasil.",
  },
];

export function renderPresets(el: HTMLElement, list: Preset[], onPick: (p: Preset) => void) {
  el.innerHTML = list.map(
    (p, i) => `<li><button data-i="${i}"><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span></button></li>`,
  ).join("");
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
    if (b) onPick(list[Number(b.dataset.i)]);
  });
}
