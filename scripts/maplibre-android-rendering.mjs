import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { run as runAndroid } from "./android-rendering.mjs";

/** Runs the fixed maplibre Android target with the existing output-directory CLI. */
export const run = (output) => runAndroid(output, "maplibre");

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await run(process.argv[2]);
