import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { run, verifyCode } from "./ios-rendering.mjs";

export { run, verifyCode };

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await run(process.argv[2]);
