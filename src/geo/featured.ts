import type { World } from "./load";
import { loadYear } from "./history";
import type { Country } from "../types";

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
  { year: -500, group: "Achaemenid Empire", name: "Imperio aqueménida (Persia)" },
  { year: -323, group: "Empire of Alexander", name: "Imperio de Alejandro Magno" },
  { year: 100, group: "Roman Empire", name: "Imperio romano" },
  { year: 100, group: "Han", name: "Imperio Han (China)" },
  { year: 1279, group: "Mongol Empire", name: "Imperio mongol" },
  { year: 1500, group: "Aztec Empire", name: "Imperio azteca" },
  { year: 1530, group: "Inca Empire", name: "Imperio inca" },
  { year: 1600, group: "Ottoman Empire", name: "Imperio otomano" },
  { year: 1700, group: "Mughal Empire", name: "Imperio mogol" },
  { year: 1783, group: "Spain", name: "Imperio español" },
  { year: 1783, group: "Spain", part: "Viceroyalty of New Granada", name: "Virreinato de la Nueva Granada" },
  { year: 1783, group: "Spain", part: "Viceroyalty of New Spain", name: "Virreinato de Nueva España" },
  { year: 1783, group: "Spain", part: "Viceroyalty of Peru", name: "Virreinato del Perú" },
  { year: 1783, group: "Qing Empire", name: "Imperio Qing (China)" },
  { year: 1914, group: "United Kingdom", name: "Imperio británico" },
  { year: 1914, group: "Russia", name: "Imperio ruso" },
  { year: 1960, group: "USSR", name: "URSS" },
];

export const featuredKey = (f: Featured) => `h${f.year}:${f.group}${f.part ? `:${f.part}` : ""}`;

export async function resolveFeatured(world: World, f: Featured): Promise<Country | undefined> {
  await loadYear(world, f.year);
  return world.byKey.get(featuredKey(f));
}
