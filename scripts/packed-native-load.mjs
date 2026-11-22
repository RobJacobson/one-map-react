import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Loads the packed ESM graph with native host substitutes matching the installed SDK. */
export const checkNativeLoad = (consumer, entry, peer, run) => {
  // RNMapbox's index re-exports ./Mapbox, which Metro resolves to Mapbox.native.js.
  const sdkFile = entry === "mapbox-native" ? "Mapbox.native.js" : "index.js";
  const sdkEntry = join(consumer, "node_modules", peer, "lib/module", sdkFile);
  const symbols = JSON.parse(
    run(
      "bun",
      [
        "-e",
        `
    const { outputs } = await Bun.build({ entrypoints: [process.argv[1]], packages: "external" });
    console.log(JSON.stringify(new Bun.Transpiler().scan(await outputs[0].text()).exports));
  `,
        sdkEntry,
      ],
      consumer
    )
  );
  const mockUrls = [
    [peer, symbols],
    ["react-native", ["AppState", "Platform", "View"]],
    ["react-native-teleport", ["Portal", "PortalHost", "PortalProvider"]],
  ].map(([name, exports]) => {
    const source = exports
      .map((symbol) =>
        symbol === "default"
          ? "export default () => null;"
          : `export const ${symbol} = () => null;`
      )
      .join("\n");
    return [name, `data:text/javascript,${encodeURIComponent(source)}`];
  });

  const file = join(consumer, "native-runtime.mjs");
  writeFileSync(
    file,
    `
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
const mocks = new Map(${JSON.stringify(mockUrls)});
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = mocks.get(specifier);
    return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
  }
});
const concrete = await import("one-map-react/${entry}");
const alias = await import("one-map-react/${entry.replace("-native", "")}");
assert.equal(concrete.adapter.backend, ${JSON.stringify(entry)});
assert.equal(concrete, alias);
assert.equal(concrete.default, concrete.Map);
for (const symbol of ["Map", "Source", "Layer", "Marker", "useMap"]) {
  assert.ok(concrete[symbol], "Missing native export " + symbol);
}
assert.equal(typeof concrete.MapProvider, "function");
`
  );
  run("node", ["--conditions=react-native", file], consumer);
};
