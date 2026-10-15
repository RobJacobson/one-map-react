import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// A mistaken scope must fail before any device connection or destructive call.
for (const [scope, platform, isolated, message] of [
  ["pending", "ios", "", "require an isolated application sandbox"],
  ["pending-reset", "android", "0", "require an isolated application sandbox"],
  ["pending-merge", "web", "1", "requires a native platform"],
  ["pending-repair", "android", "0", "require an isolated application sandbox"],
  ["pending-storage", "ios", "0", "require an isolated application sandbox"],
  ["pending-storage", "web", "1", "requires a native platform"],
]) {
  const result = spawnSync(
    process.execPath,
    ["scripts/tf08-services-smoke.mjs", platform, "mapbox"],
    {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        TF08_SCOPE: scope,
        TF08_ISOLATED_SANDBOX: isolated,
      },
      encoding: "utf8",
    }
  );
  assert.notEqual(result.status, 0);
  assert(result.stderr.includes(message), result.stderr);
}
console.log("TF08 pending scope isolation guards passed.");
