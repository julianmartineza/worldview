import { geoOrthographic } from "d3";
import { describe, expect, it } from "vitest";
import { orthoInvert } from "../src/geo/orthoInvert";

describe("relieve alineado con el globo", () => {
  it.each([
    [[72, -8]],
    [[-120, 35]],
    [[180, -60]],
    [[0, 89]],
  ] as [[number, number]][])("la inversa coincide con d3 para rotate %j", (rot) => {
    const proj = geoOrthographic().clipAngle(90).scale(300).translate([400, 320]).rotate([rot[0], rot[1], 0]);
    for (let i = 0; i < 400; i++) {
      const px = 100 + ((i * 37) % 600);
      const py = 20 + ((i * 53) % 600);
      const ours = orthoInvert(px, py, 300, [400, 320], rot);
      if (!ours) {
        expect(Math.hypot(px - 400, py - 320)).toBeGreaterThan(299.99);
        continue;
      }
      const ref = proj.invert!([px, py])!;
      const dLon = Math.abs(((ours[0] - ref[0] + 540) % 360) - 180);
      // Cerca de los polos la longitud pierde sentido; se compara la posición sobre la esfera
      expect(dLon * Math.cos((ref[1] * Math.PI) / 180)).toBeLessThan(1e-6);
      expect(Math.abs(ours[1] - ref[1])).toBeLessThan(1e-6);
    }
  });
});

import { readFileSync, statSync } from "node:fs";

/** Lee ancho y alto del marcador SOF de un JPEG. */
function jpegSize(buf: Buffer) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}

describe("imágenes de relieve", () => {
  it.each([
    ["relief-4096.jpg", 4096, 3.5],
    ["relief-2048.jpg", 2048, 1],
  ] as const)("%s mide %s×mitad y pesa menos de %s MB", (name, w, maxMB) => {
    const path = new URL(`../public/data/relief/${name}`, import.meta.url);
    expect(jpegSize(readFileSync(path))).toEqual([w, w / 2]);
    expect(statSync(path).size / 1e6).toBeLessThan(maxMB);
  });
});
