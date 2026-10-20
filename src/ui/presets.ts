import { esc } from "../format";
import { tr } from "../i18n";

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
    title: tr("Groenlandia sobre África", "Greenland over Africa"),
    text: tr("En los mapas comunes parece tan grande como África. Cabe 14 veces en ella.", "On common maps it looks as big as Africa. It fits inside it 14 times."),
  },
  {
    from: "RUS",
    to: "CAF",
    title: tr("Rusia sobre África", "Russia over Africa"),
    text: tr("El país más grande del mundo ocupa poco más de la mitad de África.", "The world's largest country covers just over half of Africa."),
  },
  {
    from: "COL",
    to: "DEU",
    title: tr("Colombia sobre Europa", "Colombia over Europe"),
    text: tr("Es más grande que Francia y Alemania juntas.", "It is larger than France and Germany combined."),
  },
  {
    from: "BRA",
    to: "USA",
    title: tr("Brasil sobre Estados Unidos", "Brazil over the United States"),
    text: tr("Brasil supera a los 48 estados contiguos de EE. UU.", "Brazil is larger than the 48 contiguous US states."),
  },
  {
    from: "AUS",
    to: "POL",
    title: tr("Australia sobre Europa", "Australia over Europe"),
    text: tr("Casi el doble de la Unión Europea.", "Almost twice the European Union."),
  },
  {
    from: "IDN",
    to: "DEU",
    title: tr("Indonesia sobre Europa", "Indonesia over Europe"),
    text: tr("De punta a punta mide más que de Lisboa a Moscú.", "End to end it spans more than Lisbon to Moscow."),
  },
];

// Cifras calculadas con historical-basemaps (ver tests/history.test.ts)
export const EMPIRE_PRESETS: Preset[] = [
  {
    kind: "compare",
    from: "h1279:Mongol Empire",
    to: "RUS",
    title: tr("Imperio mongol frente a Rusia", "Mongol Empire vs. Russia"),
    text: tr("En 1279 ocupaba 1,6 veces la Rusia actual.", "In 1279 it covered 1.6 times present-day Russia."),
  },
  {
    kind: "ghost",
    from: "h100:Roman Empire",
    to: "USA",
    title: tr("Imperio romano sobre Estados Unidos", "Roman Empire over the United States"),
    text: tr("En el año 100 abarcaba la mitad de lo que hoy mide EE. UU.", "In the year 100 it spanned half the size of today's US."),
  },
  {
    kind: "ghost",
    from: "h1530:Inca Empire",
    to: "DEU",
    title: tr("Imperio inca sobre Europa", "Inca Empire over Europe"),
    text: tr("Casi 4.000 km de punta a punta, más que de Lisboa a Moscú.", "Almost 4,000 km end to end, more than Lisbon to Moscow."),
  },
  {
    kind: "compare",
    from: "h1783:Spain",
    to: "ESP",
    title: tr("Imperio español frente a España", "Spanish Empire vs. Spain"),
    text: tr("En 1783 medía 26 veces la España actual.", "In 1783 it was 26 times the size of present-day Spain."),
  },
  {
    kind: "compare",
    from: "h1783:Spain:Viceroyalty of New Granada",
    to: "COL",
    title: tr("Nueva Granada frente a Colombia", "New Granada vs. Colombia"),
    text: tr("El virreinato de 1783 casi triplicaba la Colombia actual.", "The 1783 viceroyalty was almost three times present-day Colombia."),
  },
  {
    kind: "compare",
    from: "h1960:USSR",
    to: "RUS",
    title: tr("La URSS frente a Rusia", "The USSR vs. Russia"),
    text: tr("Rusia conserva casi el 80 % del territorio soviético.", "Russia keeps almost 80% of the Soviet territory."),
  },
  {
    kind: "compare",
    from: "h-323:Empire of Alexander",
    to: "BRA",
    title: tr("Alejandro Magno frente a Brasil", "Alexander the Great vs. Brazil"),
    text: tr("Su imperio ocupaba poco más de la mitad de Brasil.", "His empire covered just over half of Brazil."),
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
