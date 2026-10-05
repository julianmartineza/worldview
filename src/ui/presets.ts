import { esc } from "../format";

export interface Preset {
  from: string;
  to: string;
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

export function renderPresets(el: HTMLElement, onPick: (p: Preset) => void) {
  el.innerHTML = PRESETS.map(
    (p, i) => `<li><button data-i="${i}"><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span></button></li>`,
  ).join("");
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
    if (b) onPick(PRESETS[Number(b.dataset.i)]);
  });
}
