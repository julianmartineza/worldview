import type { Feature, MultiPolygon, Polygon } from "geojson";

export type LonLat = [number, number];
export type Geo = Feature<Polygon | MultiPolygon>;

export interface Dimensions {
  /** Extensión este–oeste del territorio principal, km */
  width: number;
  /** Extensión norte–sur del territorio principal, km */
  height: number;
  /** Mayor distancia entre dos puntos del territorio principal, km */
  diameter: number;
  /** Longitud de costas y fronteras a la resolución del mapa, km */
  perimeter: number;
}

export interface Country {
  key: string;
  iso3: string | null;
  name: string;
  officialName: string | null;
  flag: string;
  capital: string | null;
  region: string | null;
  /** Área oficial (incluye aguas interiores), km² */
  officialArea: number | null;
  /** Área del polígono calculada sobre la esfera, km² */
  area: number;
  feature: Geo;
  /** Partes grandes o cercanas al núcleo; excluye territorios lejanos pequeños */
  main: Geo;
  /** Centroide de la parte más grande: punto de agarre al moverlo */
  anchor: LonLat;
  bounds: [LonLat, LonLat];
  search: string;
}

export interface Ghost {
  id: number;
  key: string;
  color: string;
  target: LonLat;
  moved: Geo;
}
