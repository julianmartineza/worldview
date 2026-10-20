import type { World } from "./load";
import { loadYear } from "./history";
import type { Country } from "../types";
import { tr } from "../i18n";

/** Entidades históricas que el buscador ofrece aunque su año aún no esté cargado. */
export interface Featured {
  year: number;
  /** Nombre del grupo en el dataset (SUBJECTO normalizado o NAME) */
  group: string;
  /** Nombre de una parte del grupo, si se quiere solo esa parte */
  part?: string;
  name: string;
}

export const FEATURED: Featured[] = [
  { year: -500, group: "Achaemenid Empire", name: tr("Imperio aqueménida (Persia)", "Achaemenid Empire (Persia)") },
  { year: -323, group: "Empire of Alexander", name: tr("Imperio de Alejandro Magno", "Empire of Alexander the Great") },
  { year: 100, group: "Roman Empire", name: tr("Imperio romano", "Roman Empire") },
  { year: 100, group: "Han", name: tr("Imperio Han (China)", "Han Empire (China)") },
  { year: 1279, group: "Mongol Empire", name: tr("Imperio mongol", "Mongol Empire") },
  { year: 1500, group: "Aztec Empire", name: tr("Imperio azteca", "Aztec Empire") },
  { year: 1530, group: "Inca Empire", name: tr("Imperio inca", "Inca Empire") },
  { year: 1600, group: "Ottoman Empire", name: tr("Imperio otomano", "Ottoman Empire") },
  { year: 1700, group: "Mughal Empire", name: tr("Imperio mogol", "Mughal Empire") },
  { year: 1783, group: "Spain", name: tr("Imperio español", "Spanish Empire") },
  { year: 1783, group: "Spain", part: "Viceroyalty of New Granada", name: tr("Virreinato de la Nueva Granada", "Viceroyalty of New Granada") },
  { year: 1783, group: "Spain", part: "Viceroyalty of New Spain", name: tr("Virreinato de Nueva España", "Viceroyalty of New Spain") },
  { year: 1783, group: "Spain", part: "Viceroyalty of Peru", name: tr("Virreinato del Perú", "Viceroyalty of Peru") },
  { year: 1783, group: "Qing Empire", name: tr("Imperio Qing (China)", "Qing Empire (China)") },
  { year: 1914, group: "United Kingdom", name: tr("Imperio británico", "British Empire") },
  { year: 1914, group: "Russia", name: tr("Imperio ruso", "Russian Empire") },
  { year: 1960, group: "USSR", name: tr("URSS", "USSR") },
];

export const featuredKey = (f: Featured) => `h${f.year}:${f.group}${f.part ? `:${f.part}` : ""}`;

export async function resolveFeatured(world: World, f: Featured): Promise<Country | undefined> {
  await loadYear(world, f.year);
  return world.byKey.get(featuredKey(f));
}
