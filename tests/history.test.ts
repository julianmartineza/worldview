import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { geoArea } from "d3";
import { buildYear } from "../src/geo/history";

const dir = new URL("../public/data/history/", import.meta.url);
const years: number[] = JSON.parse(readFileSync(new URL("index.json", dir), "utf8")).years;
const layer = (y: number) => buildYear(JSON.parse(readFileSync(new URL(`world_${y}.json`, dir), "utf8")), y);
const find = (y: number, name: string) => {
  const l = layer(y);
  return [...l.countries, ...l.parts].find((c) => c.name === name)!;
};

describe("fronteras históricas", () => {
  it("incluye del 2000 a. C. al 2010", () => {
    expect(years[0]).toBe(-2000);
    expect(years.at(-1)).toBe(2010);
    expect(years).toContain(1279);
  });

  it("ningún polígono de ningún año cubre más de media Tierra (giro correcto)", { timeout: 30_000 }, () => {
    for (const y of years) {
      const l = layer(y);
      for (const c of [...l.countries, ...l.parts])
        expect(geoArea(c.feature), `${y} ${c.name}`).toBeLessThan(2 * Math.PI);
    }
  });

  it("los kanatos de 1279 forman un solo Imperio mongol", () => {
    const m = find(1279, "Imperio mongol");
    expect(m.parts?.length).toBeGreaterThanOrEqual(4);
    // ~24 M km² según las estimaciones habituales; el dataset incluye vasallos
    expect(m.area / 1e6).toBeGreaterThan(20);
    expect(m.area / 1e6).toBeLessThan(30);
  });

  it.each([
    [100, "Imperio romano", 4, 6],
    [-323, "Imperio de Alejandro Magno", 4, 6],
    [1914, "Imperio ruso", 19, 24],
  ])("%s %s mide entre %s y %s M km²", (y, name, lo, hi) => {
    const c = find(y, name);
    expect(c.area / 1e6).toBeGreaterThan(lo);
    expect(c.area / 1e6).toBeLessThan(hi);
  });

  it("el Virreinato de la Nueva Granada es una parte del Imperio español en 1783", () => {
    const ng = find(1783, "Virreinato de la Nueva Granada");
    expect(ng.parent).toBe("h1783:Spain");
  });

  it("los pueblos sin estado quedan marcados", () => {
    expect(layer(100).countries.find((c) => c.name === "Khoisan")?.people).toBe(true);
    expect(find(100, "Imperio romano").people).toBe(false);
  });
});

import { FEATURED, featuredKey } from "../src/geo/featured";

describe("imperios destacados", () => {
  it.each(FEATURED.map((f) => [f.name, f] as const))("%s existe en su año", (_n, f) => {
    const l = layer(f.year);
    const c = [...l.countries, ...l.parts].find((x) => x.key === featuredKey(f));
    expect(c, featuredKey(f)).toBeDefined();
    expect(c!.people).toBe(false);
  });
});
