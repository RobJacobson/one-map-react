import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { transformSync } from "@babel/core";

import inlineFixtureBase from "./inline-fixture-base.cjs";

for (const [variable, file, exportName] of [
  ["TF05_BASE", "tf05-base.ts", "tf05Base"],
  ["TF06_BASE", "tf06-base.ts", "tf06Base"],
]) {
  const previous = process.env[variable];
  try {
    for (const value of [undefined, "http://192.0.2.1:12798"]) {
      if (value === undefined) delete process.env[variable];
      else process.env[variable] = value;
      const filename = new URL(
        `../packages/example-map/src/scenarios/${file}`,
        import.meta.url
      );
      const result = transformSync(readFileSync(filename, "utf8"), {
        filename: filename.pathname,
        babelrc: false,
        configFile: false,
        presets: ["module:@react-native/babel-preset"],
        plugins: [inlineFixtureBase],
      });
      const exports = {};
      runInNewContext(result.code, { exports, process: { env: {} } });
      assert.equal(exports[exportName], value ?? "http://127.0.0.1:8798");
    }
  } finally {
    if (previous === undefined) delete process.env[variable];
    else process.env[variable] = previous;
  }
}
console.log(
  "PASS native fixture bases: default and assigned ports compile into both shared fixtures without a device shell environment."
);
