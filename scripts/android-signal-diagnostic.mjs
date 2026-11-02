import { run } from "./android-rendering.mjs";

await run(process.argv[2], "mapbox", "signal-diagnostic");
