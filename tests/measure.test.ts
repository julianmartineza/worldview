import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWorld } from "../src/geo/load";
import { areaKm2, dimensions, mercatorFactor } from "../src/geo/measure";
import { moveFeature } from "../src/geo/rotate";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const world = buildWorld(read("countries-50m.json"), read("countries-meta.json"));
const get = (iso3: string) => world.byIso3.get(iso3)!;

describe("áreas", () => {
  it.each(["RUS", "BRA", "COL", "GRL", "USA", "AUS", "ESP", "MEX", "ARG", "CAN"])(
    "%s: el área calculada está a menos de 3 por ciento de la oficial",
    (iso3) => {
      const c = get(iso3);
      expect(Math.abs(c.area - c.officialArea!) / c.officialArea!).toBeLessThan(0.03);
    },
  );

  it("Groenlandia es unas 14 veces menor que África", () => {
    const africa = world.countries
      .filter((c) => c.region === "Africa")
      .reduce((s, c) => s + c.area, 0);
    const ratio = africa / get("GRL").area;
    expect(ratio).toBeGreaterThan(13);
    expect(ratio).toBeLessThan(15);
  });
});

describe("mover un país sobre la esfera", () => {
  it.each(["GRL", "RUS", "COL", "ATA", "FJI"])("%s conserva su área al llevarlo al ecuador", (iso3) => {
    const c = get(iso3);
    const moved = moveFeature(c.feature, c.anchor, [20, 0]);
    expect(Math.abs(areaKm2(moved) - c.area) / c.area).toBeLessThan(0.001);
  });

  it("el punto de agarre llega exactamente al destino", () => {
    const c = get("GRL");
    const moved = moveFeature(
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[c.anchor, c.anchor, c.anchor, c.anchor]] } },
      c.anchor,
      [-60, -10],
    );
    const [lon, lat] = (moved.geometry as GeoJSON.Polygon).coordinates[0][0];
    expect(lon).toBeCloseTo(-60, 6);
    expect(lat).toBeCloseTo(-10, 6);
  });
});

describe("dimensiones", () => {
  it("Colombia mide unos 1.800 km de norte a sur", () => {
    const c = get("COL");
    const d = dimensions(c.main, c.anchor);
    expect(d.height).toBeGreaterThan(1600);
    expect(d.height).toBeLessThan(2000);
  });

  it("Mercator infla ~4 veces a 60° de latitud", () => {
    expect(mercatorFactor(60)).toBeCloseTo(4, 5);
  });
});
