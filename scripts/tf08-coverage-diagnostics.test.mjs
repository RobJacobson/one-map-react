import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf08-services-smoke.mjs", import.meta.url),
  "utf8"
);
const start = source.indexOf("const coverageImages = async");
const end = source.indexOf("\nconst captureCoverageScenarios", start);
assert(start >= 0 && end > start);
const exported = Buffer.from("exported");
const live = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const written = new Map();
const context = {
  action: async (name) => {
    assert.equal(name, "capture");
    return { uri: `data:image/png;base64,${exported.toString("base64")}` };
  },
  page: { send: async () => ({ data: live.toString("base64") }) },
  platform: "web",
  Buffer,
  PNG: {
    sync: {
      read: (bytes) => ({
        width: 120,
        height: 80,
        blue: bytes.equals(exported) ? 7 : 9,
      }),
    },
  },
  observeCoveragePixels: (pixels) => ({ blue: pixels.blue }),
  observeFixturePixels: () => ({ red: 21 }),
  assert,
  process: { env: { TF08_CAPTURE_OUTPUT: "/private/tmp/coverage" } },
  writeFileSync: (path, bytes) => written.set(path, bytes),
};
const capture = runInNewContext(
  `${source.slice(start, end)}; coverageImages;`,
  context
);
const observation = await capture();
assert.equal(observation.exported.blue, 7);
assert.equal(observation.live.blue, 9);
assert.equal(context.lastCoverageObservation, observation);
assert(written.get("/private/tmp/coverage.exported.png").equals(exported));
assert(written.get("/private/tmp/coverage.live.png").equals(live));
await capture();
assert.equal(written.size, 2, "Diagnostics retain only the latest image pair.");
await capture(true);
assert.equal(
  written.size,
  4,
  "Keep one baseline pair separately from the latest pair."
);
assert(written.get("/private/tmp/coverage.baseline.live.png").equals(live));
assert(
  written.get("/private/tmp/coverage.baseline.exported.png").equals(exported)
);
delete context.process.env.TF08_CAPTURE_OUTPUT;
written.clear();
await capture();
assert.equal(
  written.size,
  0,
  "Raw image retention requires the explicit diagnostic path."
);
console.log(
  "PASS latest coverage counts and optional bounded live/exported image diagnostics."
);
