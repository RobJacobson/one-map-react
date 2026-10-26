import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf08-services-smoke.mjs", import.meta.url),
  "utf8"
);
const actionStart = source.indexOf("const action = async");
const actionEnd = source.indexOf("\nconst configure =", actionStart);
const untilStart = source.indexOf("const until = async");
const untilEnd = source.indexOf("\nconst start =", untilStart);
const scenarioLabel = source.indexOf(
  '"selected SDK rejects an invalid independent snapshot style"'
);
const scenarioStart = source.lastIndexOf("  await scenario(", scenarioLabel);
const scenarioEnd = source.indexOf(
  '  if (platform === "android")',
  scenarioLabel
);
assert(actionStart >= 0 && actionEnd > actionStart);
assert(untilStart >= 0 && untilEnd > untilStart);
assert(scenarioStart >= 0 && scenarioEnd > scenarioStart);

const observeInvalidStyle = (reply, overrides = {}, scenario = true) => {
  let elapsedMs = 0;
  const replies = new Map(reply ? [["snapshot-command", reply]] : []);
  const operation = scenario
    ? `(async () => { ${source.slice(scenarioStart, scenarioEnd)} })()`
    : 'action("snapshot")';
  return runInNewContext(
    `${source.slice(actionStart, actionEnd)}\n${source.slice(untilStart, untilEnd)}\n${operation}`,
    {
      assert,
      page: undefined,
      randomUUID: () => "snapshot-command",
      currentCommand: undefined,
      engine: "mapbox",
      platform: "ios",
      fixtureUrl: "http://fixture.test",
      replies,
      Date: { now: () => elapsedMs },
      delay: async (ms) => {
        elapsedMs += ms;
      },
      scenario: async (_name, run) => run(),
      ...overrides,
    }
  );
};

await assert.rejects(
  observeInvalidStyle(undefined),
  /TF08 observation timed out|Tf08CommandError/
);
await observeInvalidStyle({
  ok: false,
  error: "Error",
  message: "SDK invalid style",
});
await assert.rejects(
  observeInvalidStyle({ ok: true, value: "unexpected image" })
);
await assert.rejects(
  observeInvalidStyle(undefined, {
    delay: async () => {
      throw new Error("Unrelated transport failure");
    },
  }),
  /Unrelated transport failure|Tf08CommandError/
);
for (const reply of [
  { ok: false, error: "SDKError", message: "Original SDK diagnostic" },
  { ok: false, error: "Fallback SDK diagnostic" },
]) {
  await assert.rejects(observeInvalidStyle(reply, {}, false), (error) => {
    assert.equal(error.name, "Tf08CommandError");
    assert.equal(error.message, reply.message ?? reply.error);
    return true;
  });
}
console.log(
  "PASS snapshot style errors require an acknowledged native failure; transport timeout and successful output cannot pass."
);
