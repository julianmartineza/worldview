import { feature, merge, mesh } from "topojson-client";
import type { FeatureCollection, MultiLineString } from "geojson";
import type { GeometryCollection, GeometryObject, Topology } from "topojson-specification";
import type { Country, Geo } from "../types";
import { makeCountry, type World } from "./load";
import { geoArea } from "d3";
import { esName, isPeople } from "./historyNames";

interface Props {
  /** NAME original */
  n: string;
  /** Potencia a la que pertenece (SUBJECTO normalizado), o null si es independiente */
  s: string | null;
  /** BORDERPRECISION */
  p: number;
}
type Obj = GeometryObject;
const P = (g: Obj) => (g as unknown as { properties: Props }).properties;

/** Capa que dibujan las vistas: la actual o la de un año histórico. */
export interface Layer {
  year: number | null;
  /** Lo que se selecciona al tocar el mapa: países, o imperios completos */
  countries: Country[];
  /** Partes de imperios, seleccionables desde la ficha y el buscador */
  parts: Country[];
  collection: FeatureCollection;
  borders: MultiLineString;
  /** Fronteras marcadas como aproximadas en el dataset */
  approx: MultiLineString | null;
}

const PALETTE = ["#c8553d", "#2e86ab", "#d4a017", "#5b8e7d", "#8e5bd6", "#c2577f", "#4f7cac", "#9a8c3a", "#3f9c9c", "#b5703a"];

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const groupOf = (g: Obj) => P(g).s ?? P(g).n;
const isArea = (g: Obj) => g.type === "Polygon" || g.type === "MultiPolygon";

/** La simplificación puede invertir algún anillo; d3 lo leería como "toda la Tierra menos el polígono". */
function rewind(f: Geo): Geo {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const p of polys)
    if (geoArea({ type: "Polygon", coordinates: p }) > 2 * Math.PI) p.forEach((ring) => ring.reverse());
  return f;
}

function asFeature(topo: Topology, gs: Obj[]): Geo {
  if (gs.length === 1) return rewind(feature(topo, gs[0] as any) as unknown as Geo);
  return rewind({ type: "Feature", properties: {}, geometry: merge(topo, gs as any) });
}

export function buildYear(topo: Topology, year: number): Layer {
  const obj = topo.objects.entities as GeometryCollection;
  const geoms = (obj.geometries as Obj[]).filter(isArea);
  const groups = new Map<string, Obj[]>();
  for (const g of geoms) {
    const k = groupOf(g);
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }

  const countries: Country[] = [];
  const parts: Country[] = [];
  for (const [gk, list] of groups) {
    const key = `h${year}:${gk}`;
    const color = colorFor(gk);
    const byName = new Map<string, Obj[]>();
    for (const g of list) byName.set(P(g).n, [...(byName.get(P(g).n) ?? []), g]);
    const hasParts = byName.size > 1;
    const precision = Math.min(...list.map((g) => P(g).p));

    const memberKeys: Country[] = [];
    if (hasParts)
      for (const [n, gs] of byName) {
        const part = makeCountry(
          `${key}:${n}`,
          asFeature(topo, gs),
          { iso3: null, name: esName(n, year, false), area: null, flag: "" },
          n,
          { year, color, parent: key, people: isPeople(n), precision: Math.min(...gs.map((g) => P(g).p)) },
        );
        memberKeys.push(part);
      }
    memberKeys.sort((a, b) => b.area - a.area);
    parts.push(...memberKeys);

    countries.push(
      makeCountry(key, asFeature(topo, list), { iso3: null, name: esName(gk, year, hasParts), area: null, flag: "" }, gk, {
        year,
        color: isPeople(gk) ? "#8a8f98" : color,
        people: isPeople(gk),
        precision,
        parts: hasParts ? memberKeys.map((p) => p.key) : undefined,
      }),
    );
  }
  countries.sort((a, b) => b.area - a.area);

  const precise = (g: Obj) => P(g).p > 1;
  const between = (a: Obj, b: Obj) => a !== b && groupOf(a) !== groupOf(b);
  return {
    year,
    countries,
    parts,
    collection: { type: "FeatureCollection", features: countries.map((c) => c.feature) },
    borders: mesh(topo, obj as any, (a: any, b: any) => between(a, b) && precise(a) && precise(b)),
    approx: mesh(topo, obj as any, (a: any, b: any) => between(a, b) && !(precise(a) && precise(b))),
  };
}

let years: number[] | null = null;
const cache = new Map<number, Promise<Layer>>();
const base = () => `${import.meta.env.BASE_URL}data/history/`;

export async function historyYears(): Promise<number[]> {
  if (!years) years = (await fetch(`${base()}index.json`).then((r) => r.json())).years as number[];
  return years;
}

/** Carga un año una sola vez y registra sus entidades para que el resto de la app las encuentre por key. */
export function loadYear(world: World, year: number): Promise<Layer> {
  let p = cache.get(year);
  if (!p) {
    p = fetch(`${base()}world_${year}.json`)
      .then((r) => r.json())
      .then((topo: Topology) => {
        const layer = buildYear(topo, year);
        for (const c of [...layer.countries, ...layer.parts]) world.byKey.set(c.key, c);
        return layer;
      });
    cache.set(year, p);
  }
  return p;
}

export function modernLayer(world: World): Layer {
  return { year: null, countries: world.countries, parts: [], collection: world.collection, borders: world.borders, approx: null };
}
