import { geoBounds } from "d3";
import { feature, mesh } from "topojson-client";
import type { FeatureCollection, MultiLineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Country, Geo, LonLat } from "../types";
import { anchorOf, areaKm2, mainTerritory } from "./measure";

export interface CountryMeta {
  iso3: string | null;
  name: string;
  officialName?: string;
  area: number | null;
  capital?: string | null;
  region?: string | null;
  flag: string;
}

export interface World {
  countries: Country[];
  byKey: Map<string, Country>;
  byIso3: Map<string, Country>;
  collection: FeatureCollection;
  borders: MultiLineString;
}

// Arrecife diminuto que comparte código ISO con Australia
const SKIP = new Set(["Ashmore and Cartier Is."]);

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function buildWorld(topo: Topology, meta: Record<string, CountryMeta>): World {
  const obj = topo.objects.countries as GeometryCollection;
  const fc = feature(topo, obj) as unknown as FeatureCollection;
  const countries: Country[] = [];
  for (const f of fc.features as Geo[]) {
    const name = (f.properties as { name: string }).name;
    if (SKIP.has(name)) continue;
    const key = String(f.id ?? name);
    const m = meta[key] ?? { iso3: null, name, area: null, flag: "" };
    const anchor = anchorOf(f);
    countries.push({
      key,
      iso3: m.iso3,
      name: m.name,
      officialName: m.officialName ?? null,
      flag: m.flag,
      capital: m.capital ?? null,
      region: m.region ?? null,
      officialArea: m.area,
      area: areaKm2(f),
      feature: f,
      main: mainTerritory(f, anchor),
      anchor,
      bounds: geoBounds(f) as [LonLat, LonLat],
      search: normalize(`${m.name} ${m.officialName ?? ""} ${name} ${m.iso3 ?? ""}`),
    });
  }
  countries.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    countries,
    byKey: new Map(countries.map((c) => [c.key, c])),
    byIso3: new Map(countries.filter((c) => c.iso3).map((c) => [c.iso3!, c])),
    collection: { type: "FeatureCollection", features: countries.map((c) => c.feature) },
    borders: mesh(topo, obj, (a, b) => a !== b),
  };
}

export async function loadWorld(): Promise<World> {
  const base = import.meta.env.BASE_URL;
  const [topo, meta] = await Promise.all([
    fetch(`${base}data/countries-50m.json`).then((r) => r.json()),
    fetch(`${base}data/countries-meta.json`).then((r) => r.json()),
  ]);
  return buildWorld(topo, meta);
}
