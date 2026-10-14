import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { transformSync } from "@babel/core";

import inlineSmokeTarget from "./inline-smoke-target.cjs";

const filename = new URL("./shared/smoke-target.ts", import.meta.url);
const source = readFileSync(filename, "utf8");
const originalTarget = process.env.ONE_MAP_SMOKE;
const originalBase = process.env.TF06_BASE;
const cases = [
  [undefined, "tf03"],
  ["unknown", "tf03"],
  ["tf04", "tf04"],
  ["tf05", "tf05"],
  ["tf06", "tf06"],
  ["tf07", "tf07"],
  ["tf08", "tf08"],
  ["tf06-lifetimes", "tf06-lifetimes"],
];

try {
  for (const [requested, expected] of cases) {
    if (requested === undefined) {
      delete process.env.ONE_MAP_SMOKE;
    } else {
      process.env.ONE_MAP_SMOKE = requested;
    }

    const transformed = transformSync(source, {
      filename: filename.pathname,
      babelrc: false,
      configFile: false,
      presets: ["module:@react-native/babel-preset"],
      plugins: [inlineSmokeTarget],
    });
    const exports = {};

    // The device has no shell environment. Check the compiled selector there.
    runInNewContext(transformed.code, { exports, process: { env: {} } });

    if (exports.smokeTarget !== expected) {
      throw new Error(
        `Native smoke ${requested}: expected ${expected}, got ${exports.smokeTarget}`
      );
    }
  }

  console.log("PASS native Babel smoke selection: 7 cases");
  process.env.TF06_BASE = "http://192.0.2.1:8798";
  const baseFilename = new URL("./shared/tf06-base.ts", import.meta.url);
  const baseResult = transformSync(readFileSync(baseFilename, "utf8"), {
    filename: baseFilename.pathname,
    babelrc: false,
    configFile: false,
    presets: ["module:@react-native/babel-preset"],
    plugins: [inlineSmokeTarget],
  });
  const baseExports = {};
  runInNewContext(baseResult.code, {
    exports: baseExports,
    process: { env: {} },
  });
  if (baseExports.tf06Base !== process.env.TF06_BASE) {
    throw new Error("Native TF06 fixture base was not inlined");
  }
  console.log("PASS native Babel TF06 fixture base");
} finally {
  if (originalBase === undefined) {
    delete process.env.TF06_BASE;
  } else {
    process.env.TF06_BASE = originalBase;
  }
  if (originalTarget === undefined) {
    delete process.env.ONE_MAP_SMOKE;
  } else {
    process.env.ONE_MAP_SMOKE = originalTarget;
  }
}
