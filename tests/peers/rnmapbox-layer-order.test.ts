import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

import { getKotlinRunner } from "./kotlin-regression.ts";

const fixtures = join(import.meta.dirname, "fixtures");
const libraryRequire = createRequire(
  resolve(import.meta.dirname, "../../packages/one-map-react/package.json")
);
const peer = resolve(
  process.argv[2] ??
    dirname(libraryRequire.resolve("@rnmapbox/maps/package.json"))
);

const layerSources =
  "android/src/main/java/com/rnmapbox/rnmbx/components/styles/layers";

const testSwift = (temporary: string) => {
  if (process.platform !== "darwin") {
    console.log(
      "SKIP RNMapbox iOS layer reset regression: requires macOS Swift."
    );
    return;
  }
  const bridge = readFileSync(join(peer, "ios/RNMBX/RNMBXLayer.swift"), "utf8")
    .replace(/^@_spi.*\n/m, "")
    .replace(/@objc(?:\(RNMBXLayer\))?\s+/g, "");
  const main = join(temporary, "LayerOrder.swift");
  // The pristine peer must compile and reach the original reset failure.
  const imageValidity = bridge.includes("func makeStyler")
    ? "return layer.makeStyler(style).isLayerImageCurrent"
    : 'fatalError("Missing layer image ownership check")';
  const fixture = readFileSync(
    join(fixtures, "rnmapbox-layer-order.swift"),
    "utf8"
  )
    .replace("// Insert peer layer implementation here.", () => bridge)
    .replace(
      "// Insert image validity probe here.",
      `func imageValidity(for layer: RNMBXLayer, style: Style) -> (String, Any) -> Bool {
        ${imageValidity}
      }`
    );
  writeFileSync(main, fixture);
  const result = spawnSync("swift", [main], {
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);
  const fabric = readFileSync(
    join(peer, "ios/RNMBX/RNMBXFabricHelpers.h"),
    "utf8"
  );
  for (const field of [
    "filter",
    "reactStyle",
    "minZoomLevel",
    "maxZoomLevel",
  ]) {
    assert.match(
      fabric,
      new RegExp(
        `ToId\\(newProps\\.${field}\\);\\s+_view\\.${field} = ${field};`
      )
    );
  }
};

const testKotlin = (temporary: string) => {
  const run = getKotlinRunner();
  if (!run) return;
  const bridge = readFileSync(
    join(peer, layerSources, "RNMBXLayer.kt"),
    "utf8"
  );
  const implementation = bridge.slice(
    bridge.indexOf("abstract class RNMBXLayer")
  );
  const main = join(temporary, "LayerOrder.kt");
  writeFileSync(
    main,
    readFileSync(join(fixtures, "rnmapbox-layer-order.kt"), "utf8").replace(
      "// Insert peer layer implementation here.",
      () => implementation
    )
  );
  run([main], join(temporary, "layer-order.jar"));
  const manager = readFileSync(
    join(peer, layerSources, "RNMBXCircleLayerManager.kt"),
    "utf8"
  );
  assert.match(manager, /setMinZoomLevel\(if \(minZoomLevel.isNull\) null/);
  assert.match(manager, /setMaxZoomLevel\(if \(maxZoomLevel.isNull\) null/);
};

const temporary = mkdtempSync(join(tmpdir(), "one-map-rnmapbox-layer-order-"));
try {
  testSwift(temporary);
  testKotlin(temporary);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
