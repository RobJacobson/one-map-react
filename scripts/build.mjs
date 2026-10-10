import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

rmSync("packages/one-map-react/dist", { recursive: true, force: true });
const result = spawnSync(
  resolve("node_modules/.bin/tsc"),
  ["-p", "tsconfig.build.json"],
  { stdio: "inherit" }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
