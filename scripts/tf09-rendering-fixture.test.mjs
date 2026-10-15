import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { terrainPng } from "./tf09-rendering-fixture.mjs";

const png = terrainPng();
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
let offset = 8;
let header;
let pixels;
while (offset < png.length) {
  const length = png.readUInt32BE(offset);
  const type = png.toString("ascii", offset + 4, offset + 8);
  const bytes = png.subarray(offset + 8, offset + 8 + length);
  if (type === "IHDR") header = bytes;
  if (type === "IDAT") pixels = inflateSync(bytes);
  offset += length + 12;
}
assert.equal(header.readUInt32BE(), 256);
assert.equal(header.readUInt32BE(4), 256);
assert.equal(pixels.length, 256 * 769);
for (let y = 0; y < 256; y += 1) {
  assert.equal(pixels[y * 769], 0);
  for (let x = 0; x < 256; x += 1) {
    const index = y * 769 + 1 + x * 3;
    assert.equal(
      -10000 +
        (pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2]) *
          0.1,
      1000 + (x >= 80 && x < 120 ? (x - 80) * 30 : 0)
    );
  }
}
const harness = readFileSync(
  new URL("./tf09-rendering-smoke.mjs", import.meta.url),
  "utf8"
);
for (const required of [
  "TF09_LIBRARY_SHA256",
  "TF09_NATIVE_IDENTITY",
  "known rendered feature",
  "delayed DEM",
  "orangePixels",
  "unsupported",
])
  assert(harness.includes(required));
console.log(
  "PASS local DEM fixture: known terrain pixels encode 1000m plus a slope patch; targeted harness retains artifact, native identity and independent observations."
);
