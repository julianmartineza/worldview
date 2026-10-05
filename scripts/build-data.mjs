// Genera public/data/: geometría (Natural Earth vía world-atlas) y metadatos
// (mledoze/countries, la fuente de REST Countries). Ejecutar una vez: npm run data
import { readFile, writeFile, mkdir } from "node:fs/promises";

const META_URL = "https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json";
const OUT = new URL("../public/data/", import.meta.url);

// Rasgos de world-atlas sin código ISO numérico
const NO_ID = {
  Kosovo: { cca3: "UNK" },
  Somaliland: { name: "Somalilandia", region: "Africa" },
  "N. Cyprus": { name: "Chipre del Norte", region: "Asia" },
  "Indian Ocean Ter.": { name: "Territorio del Océano Índico", region: "Asia" },
  "Siachen Glacier": { name: "Glaciar de Siachen", region: "Asia" },
};

const topo = JSON.parse(
  await readFile(new URL("../node_modules/world-atlas/countries-50m.json", import.meta.url), "utf8"),
);
const res = await fetch(META_URL);
if (!res.ok) throw new Error(`metadatos: HTTP ${res.status}`);
const all = await res.json();
const byNum = new Map(all.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));
const byA3 = new Map(all.map((c) => [c.cca3, c]));

const meta = {};
for (const g of topo.objects.countries.geometries) {
  const fallback = NO_ID[g.properties.name] ?? {};
  const c = g.id ? byNum.get(g.id) : fallback.cca3 ? byA3.get(fallback.cca3) : undefined;
  const key = g.id ?? g.properties.name;
  meta[key] = c
    ? {
        iso3: c.cca3,
        name: c.translations?.spa?.common ?? c.name.common,
        officialName: c.translations?.spa?.official ?? c.name.official,
        area: c.area ?? null,
        capital: c.capital?.[0] ?? null,
        region: c.region,
        subregion: c.subregion ?? null,
        flag: c.flag ?? "",
      }
    : { iso3: null, name: fallback.name ?? g.properties.name, area: null, region: fallback.region ?? null, flag: "" };
}

await mkdir(OUT, { recursive: true });
await writeFile(new URL("countries-50m.json", OUT), JSON.stringify(topo));
await writeFile(new URL("countries-meta.json", OUT), JSON.stringify(meta));
console.log(`OK: ${Object.keys(meta).length} países`);
