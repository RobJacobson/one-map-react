import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf08-services-smoke.mjs", import.meta.url),
  "utf8"
);
const start = source.indexOf("const configure = async");
const end = source.indexOf("\nconst serveFixtures", start);
assert(start >= 0 && end > start);
let loads = 3;
let attached = false;
let mounting = false;
let polls = 0;
const modes = [];
const configure = runInNewContext(`${source.slice(start, end)}; configure;`, {
  action: async (name, value) => {
    if (name === "configure") {
      modes.push(value.mode);
      attached = false;
      mounting = true;
      polls = 0;
      return null;
    }
    if (name === "observations") {
      if (mounting && ++polls === 2) {
        loads += 1;
        attached = true;
        mounting = false;
      }
      return { loads };
    }
    assert.equal(name, "read");
    assert(attached, "Camera read preceded replacement map load.");
    return { loads, features: [{ id: 8008 }] };
  },
  until: async (ready) => {
    for (let attempt = 0; attempt < 5; attempt += 1) if (await ready()) return;
    throw new Error("Replacement load was not observed.");
  },
});
await configure("injected");
assert.equal(modes.at(-1), "injected");
assert(loads > 3);
console.log("PASS detached remount waits for a new load before camera reads.");
