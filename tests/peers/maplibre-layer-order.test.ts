import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { getKotlinRunner } from "./kotlin-regression.ts";

const fixtures = join(import.meta.dirname, "fixtures");
const androidPath =
  "android/src/main/java/org/maplibre/reactnative/components/layer";
const iosPath = "ios/components/layer";
const layerKinds = [
  "Background",
  "Circle",
  "ColorRelief",
  "Fill",
  "FillExtrusion",
  "Heatmap",
  "Hillshade",
  "Line",
  "Raster",
  "Symbol",
];

const read = (root: string, path: string) =>
  readFileSync(join(root, path), "utf8");

const run = (command: string, args: string[]) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
};

const runIos = (root: string, temporary: string) => {
  const layer = read(root, `${iosPath}/MLRNLayer.m`).replace(
    /^#import.*$/gm,
    ""
  );
  const header = read(root, `${iosPath}/MLRNLayer.h`).replace(
    /^#import.*$/gm,
    ""
  );
  const styleValue = ["h", "m"]
    .map((extension) =>
      read(root, `${iosPath}/style/MLRNStyleValue.${extension}`).replace(
        /^(?:#import|@import).*$/gm,
        ""
      )
    )
    .join("\n");
  const bridge = read(root, `${iosPath}/MLRNLayerComponentView.mm`);
  const start = bridge.indexOf("  if (oldViewProps.afterId");
  const stop = bridge.indexOf("  [super updateProps:", start);
  assert(start >= 0 && stop > start);

  const source = join(temporary, "Layers.mm");
  const fabricUpdate = `struct Props {
  std::string afterId, beforeId;
  bool oneMapResetAdoptedStyle = false;
  int layerIndex = ${bridge.includes("layerIndex == -1") ? -1 : 0};
  double minzoom = ${bridge.includes("minzoom == -1") ? -1 : 0};
  double maxzoom = ${bridge.includes("maxzoom == -1") ? -1 : 0};
  NSArray *filter = nil;
  NSDictionary *reactStyle = nil;
};
static void update(MLRNLayer *_view, Props oldViewProps, Props newViewProps) {
  ${bridge.slice(start, stop)}
}`;
  const fixture = read(fixtures, "maplibre-layer-order.mm")
    .replace("// Insert peer style value here.", () => styleValue)
    .replace("// Declare SDK layer types here.", () =>
      layerKinds.map(iosType).join("\n")
    )
    .replace(
      "// Declare style setters here.",
      () => layerKinds.map(iosApplySignature).join(";\n") + ";"
    )
    .replace("// Implement style setters here.", () =>
      layerKinds
        .map(
          (kind) => iosApplySignature(kind) + " { applyStyle(layer, fields); }"
        )
        .join("\n")
    )
    .replace("// Insert peer layer and Fabric update here.", () =>
      [header, layer, fabricUpdate].join("\n")
    );
  writeFileSync(source, fixture);
  const binary = join(temporary, "layers");
  run("xcrun", [
    "clang++",
    "-std=c++17",
    "-fobjc-arc",
    "-framework",
    "Foundation",
    source,
    "-o",
    binary,
  ]);
  run(binary, []);
};

const runAndroid = (
  root: string,
  temporary: string,
  compile: NonNullable<ReturnType<typeof getKotlinRunner>>
) => {
  const layer = read(root, `${androidPath}/MLRNLayer.kt`).replace(
    /^(?:package|import) (?!java\.).*$/gm,
    ""
  );
  const manager = read(root, `${androidPath}/MLRNLayerManager.kt`).replace(
    /^(?:package|import) .*$/gm,
    ""
  );
  const source = join(temporary, "Layers.kt");
  const fixture = read(fixtures, "maplibre-layer-order.kt")
    .replace("// Insert peer layer and manager here.", () =>
      [layer, manager].join("\n")
    )
    .replace("// Declare SDK layer types here.", () =>
      layerKinds.map(androidType).join("\n")
    )
    .replace("// Implement style setters here.", () =>
      layerKinds.map(androidApply).join("\n  ")
    )
    .replace(
      "// Insert bridge defaults here.",
      () => `const val defaultIndex = ${manager.includes("defaultInt = -1") ? "-1" : "0"}
const val defaultZoom = ${manager.includes("defaultDouble = -1.0") ? "-1.0" : "0.0"}`
    );
  writeFileSync(source, fixture);
  compile([source], join(temporary, "layers.jar"));
};

const iosType = (kind: string) =>
  `@interface MLN${kind}StyleLayer : MLNVectorStyleLayer @end
@implementation MLN${kind}StyleLayer @end`;

const iosApplySignature = (kind: string) =>
  `- (void)${kind[0]?.toLowerCase()}${kind.slice(1)}Layer:(MLN${kind}StyleLayer *)layer withReactStyle:(NSDictionary *)fields isValid:(BOOL (^)(void))valid`;

const androidType = (kind: string) =>
  `class ${kind}Layer(id: String?, source: String? = null): Layer(id!!, source)`;

const androidApply = (kind: string) =>
  `fun set${kind}LayerStyle(layer: ${kind}Layer, style: MLRNStyle) = layer.fields.putAll(style.fields.values)`;

const main = () => {
  const root = resolve(
    process.argv[2] ?? "node_modules/@maplibre/maplibre-react-native"
  );
  const android = getKotlinRunner();
  const temporary = mkdtempSync(join(tmpdir(), "one-map-libre-layer-order-"));
  try {
    if (process.argv[3] !== "android" && process.platform === "darwin") {
      runIos(root, temporary);
      console.log(
        "PASS MapLibre React Native iOS layer updates at the SDK boundary."
      );
    } else {
      console.log(
        "SKIP MapLibre React Native iOS layer order: requires Xcode."
      );
    }
    if (android) {
      runAndroid(root, temporary, android);
      console.log(
        "PASS MapLibre React Native Android layer updates at the SDK boundary."
      );
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};

main();
