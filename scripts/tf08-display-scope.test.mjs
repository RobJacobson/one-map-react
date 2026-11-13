import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("scripts/tf08-services-smoke.mjs", "utf8");
const helpers = source.slice(
  source.indexOf("const independentDisplayScenario ="),
  source.indexOf("const pendingNativeScenarios =")
);
for (const defect of [
  undefined,
  "wrong-scale",
  "wrong-snapshot",
  "wrong-file",
  "wrong-density-capture",
]) {
  const results = [];
  const device = {
    scale: defect === "wrong-scale" ? 3 : 2,
    mapFrame: { width: 375, height: 600 },
  };
  let snapshot = 0;
  const context = vm.createContext({
    assert,
    platform: "ios",
    scope: "display",
    scenario: async (name, run) => {
      results.push({ name, observation: await run() });
    },
    action: async (name) => {
      if (name === "device-info") return device;
      if (name === "capture")
        return {
          uri: {
            width: defect === "wrong-density-capture" ? 375 : 750,
            height: 1200,
            red: 300,
            navy: 50000,
            green: 0,
          },
        };
      snapshot += 1;
      return {
        uri: {
          width:
            (defect === "wrong-snapshot" && snapshot === 1) ||
            (defect === "wrong-file" && snapshot === 2)
              ? 127
              : 128,
          height: 80,
          red: 30,
          navy: 2000,
        },
      };
    },
    imagePixels: (uri) => uri,
    readNativeImage: async (uri) => uri,
  });
  const run = vm.runInContext(
    `${helpers}\n(async () => { await independentDisplayScenario(); await currentMapFileScenario(); })`,
    context
  );
  if (defect) await assert.rejects(run);
  else {
    await run();
    assert.equal(results.length, 2);
    assert.equal(results[1].observation.device.scale, 2);
  }
}
console.log(
  "Display scope checks data-URL/file dimensions, real 2x scale and selected native SDK map-image density."
);
