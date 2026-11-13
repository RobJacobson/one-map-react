import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
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
      1000 + (x >= 80 && x < 120 ? (x - 80) * 3000 : 0)
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

const configureStart = harness.indexOf(
  "const configureShade = async (shade) => {"
);
const configureEnd = harness.indexOf(
  "        await configureShade(false);",
  configureStart
);
assert(configureStart >= 0 && configureEnd > configureStart);
const configureShade = harness.slice(configureStart, configureEnd);

/** Executes the runner's real settling gate before a fake capture boundary. */
const reachPixels = async (engine, idle, committed = {}) => {
  let reads = 0;
  let captures = 0;
  const result = runInNewContext(
    `(async () => {
      const settled = [];
      ${configureShade}
      await configureShade(false);
      return decodeCapture();
    })()`,
    {
      engine,
      page: undefined,
      action: async (name) => {
        if (name === "configure") return true;
        assert.equal(name, "read");
        reads += 1;
        return {
          idle: reads === 1 ? 0 : idle,
          committed: {
            shade: false,
            dem: true,
            terrain: false,
            projection: "mercator",
            ...committed,
          },
        };
      },
      until: async (observe) => {
        for (let attempt = 0; attempt < 3; attempt += 1)
          if (await observe()) return;
        throw new Error("Settling gate did not advance.");
      },
      decodeCapture: () => {
        captures += 1;
        return "actual pixel assertions follow";
      },
    }
  );
  await result;
  assert.equal(captures, 1);
};

await reachPixels("maplibre", 0);
await assert.rejects(reachPixels("mapbox", 0), /did not advance/);
await reachPixels("mapbox", 1);
for (const engine of ["maplibre", "mapbox"])
  for (const invalid of [
    { shade: true },
    { dem: false },
    { terrain: true },
    { projection: "globe" },
  ])
    await assert.rejects(reachPixels(engine, 1, invalid), /did not advance/);
console.log(
  "PASS actual native hillshade settling gate: MapLibre reaches pixels without unsupported idle; Mapbox waits for idle; both reject uncommitted configuration."
);

const boundsStart = harness.indexOf(
  '    if (executionScope === "camera-bounds") {'
);
const boundsEnd = harness.indexOf(
  '    if (executionScope === "camera-bounds-gesture") {',
  boundsStart
);
assert(boundsStart >= 0 && boundsEnd > boundsStart);
const boundsBranch = harness.slice(boundsStart, boundsEnd);
for (const platform of ["web", "ios", "android"])
  for (const engine of ["mapbox", "maplibre"])
    for (const executionScope of [
      "camera-bounds",
      "camera-bounds-gesture",
      "rendering",
    ]) {
      const outcomes = [];
      let calls = 0;
      await runInNewContext(`(async () => { ${boundsBranch} })()`, {
        platform,
        engine,
        executionScope,
        outcomes,
        action: () => {},
        scenario: async (name, run) =>
          outcomes.push({ name, status: "passed", observation: await run() }),
        runCameraBoundsAcceptance: async () => {
          calls += 1;
          return "renderer command checks";
        },
      });
      const requested = executionScope === "camera-bounds";
      const excluded = platform === "ios" && engine === "maplibre";
      assert.equal(calls, requested && !excluded ? 1 : 0);
      assert.equal(outcomes.length, requested ? 1 : 0);
      if (requested && excluded) {
        assert.equal(outcomes[0].status, "skipped");
        assert.match(outcomes[0].reason, /user panning/);
        assert.match(outcomes[0].reason, /imperative camera commands/);
        assert.equal(outcomes[0].requiredScope, "camera-bounds-gesture");
      } else if (requested) assert.equal(outcomes[0].status, "passed");
    }
console.log(
  "PASS actual command-bounds branch: only MapLibre iOS is explicitly inapplicable and requires separate physical-panning acceptance; other targets and scopes retain their checks."
);
