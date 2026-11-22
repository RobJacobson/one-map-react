import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  packageCheckOptions,
  selectedVersions,
} from "./package-check-options.mjs";
import { walkDeclarations } from "./packed-declarations.mjs";

const options = packageCheckOptions();
const evidence = [];
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "one-map-tf02-"));
const compiler = join(root, "node_modules/.bin/tsc");
const reactPackage = join(root, "node_modules/react");
const reactTypes = join(root, "node_modules/@types/react");
const styleSpecName = "@maplibre/maplibre-gl-style-spec";
const styleSpec = join(
  root,
  "packages/one-map-react/node_modules",
  styleSpecName
);

const backends = [
  "react-map-gl",
  "mapbox-gl",
  "maplibre-gl",
  "react-native",
  "@rnmapbox/maps",
  "@maplibre/maplibre-react-native",
  "react-native-teleport",
];

const explicit = [
  "mapbox-web",
  "maplibre-web",
  "mapbox-native",
  "maplibre-native",
];

const aliasConditions = [
  [],
  ["browser"],
  ["react-native"],
  ["browser", "react-native"],
];

const cases = [
  { name: "common", conditions: [], entries: [] },
  ...explicit.map((backend) => ({
    name: backend,
    conditions: [],
    entries: [[backend, backend]],
  })),
  ...aliasConditions.map((conditions) => ({
    name: `aliases-${conditions.join("-") || "default"}`,
    conditions,
    entries: ["mapbox", "maplibre"].map((engine) => [
      engine,
      `${engine}-${conditions.includes("react-native") && !conditions.includes("browser") ? "native" : "web"}`,
    ]),
  })),
  ...[
    ["mapbox-web", "maplibre-native"],
    ["maplibre-web", "mapbox-native"],
  ].flatMap((pair, index) =>
    pair.map((backend) => ({
      name: `mixed-${index}-${backend}`,
      conditions: backend.endsWith("native") ? ["react-native"] : ["browser"],
      entries: [[backend, backend]],
    }))
  ),
];

/** Runs a command and includes output only when it fails. */
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: "" },
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`
  );
  return result.stdout.trim();
};

/** Resolves a package specifier with Node under the given export conditions. */
const resolvePackage = (consumer, specifier, conditions) => {
  const conditionArgs = conditions.flatMap((name) => ["--conditions", name]);
  const resolved = run(
    "node",
    [
      ...conditionArgs,
      "--input-type=module",
      "-e",
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    consumer
  );

  return fileURLToPath(resolved);
};

const main = async () => {
  try {
    let archive = options.archive;
    if (!archive) {
      run(
        "bun",
        ["pm", "pack", "--destination", output, "--ignore-scripts"],
        join(root, "packages/one-map-react")
      );
      const archives = readdirSync(output).filter((name) =>
        name.endsWith(".tgz")
      );
      assert.equal(archives.length, 1);
      archive = join(output, archives[0]);
    }
    const files = run("tar", ["-tzf", archive], output).split("\n");
    const rnmapboxPatch = "package/patches/rnmapbox-10.3.7-tf08.patch";
    assert.deepEqual(
      files.filter((file) => !file.startsWith("package/dist/")).sort(),
      [
        "package/LICENSE",
        "package/README.md",
        "package/package.json",
        "package/patches/maplibre-native-11.5.0-tf08.patch",
        rnmapboxPatch,
        "package/patches/rnmapbox-10.3.8.patch",
      ]
    );
    assert(files.includes("package/dist/index.d.ts"));
    for (const retired of [
      "package/dist/index.js",
      "package/dist/facade/map-setup.js",
      "package/dist/facade/map-setup.d.ts",
    ]) {
      assert(!files.includes(retired), `Retired file is packed: ${retired}`);
    }
    const repair = run("tar", ["-xOzf", archive, rnmapboxPatch], output);
    assert(
      repair.includes(
        '+        return String.format("%s-%s-%s", event.iD, event.key, event.type)'
      ),
      "The combined RNMapbox repair must throttle events per view."
    );
    assert(
      repair.includes(
        '+        val prefix = "${view.id}-"\n+        mRateLimitedEvents.keys.removeAll { it.startsWith(prefix) }'
      ),
      "The combined RNMapbox repair must remove the retired view's cache entries."
    );
    assert(
      !files.some((file) => file.startsWith("package/dist/adapters/web/"))
    );

    for (const scenario of cases) {
      await checkConsumer(archive, scenario);
    }

    console.log(
      `PASS ${cases.length} isolated package selections: type-only root, native extensions, and selected export paths.`
    );
    console.log(
      `PACKAGE SHA-256: ${createHash("sha256").update(readFileSync(archive)).digest("hex")}`
    );
    console.log(
      "SCOPE: packed publication, root declarations, native extensions, and selected-entry resolution without backend peers."
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
    if (options.evidence)
      writeFileSync(
        options.evidence,
        JSON.stringify({ checks: evidence }, null, 2) + "\n"
      );
  }
};

const checkConsumer = async (archive, scenario) => {
  const consumer = join(output, scenario.name);
  const installed = join(consumer, "node_modules/one-map-react");
  mkdirSync(installed, { recursive: true });
  run(
    "tar",
    ["-xzf", archive, "--strip-components=1", "-C", installed],
    consumer
  );
  cpSync(reactPackage, join(consumer, "node_modules/react"), {
    recursive: true,
  });
  mkdirSync(join(consumer, "node_modules/@types"), { recursive: true });
  cpSync(reactTypes, join(consumer, "node_modules/@types/react"), {
    recursive: true,
  });
  writeFileSync(
    join(consumer, "package.json"),
    '{"private":true,"type":"module"}\n'
  );

  if (Object.keys(options.versions).length) {
    run(
      "bun",
      [
        "add",
        archive,
        ...selectedVersions(
          ["react@19.2.3", "@types/react@19.2.18"],
          options.versions
        ),
      ],
      consumer
    );
  } else {
    // This offline fixture hand-installs declarations. Include the version the archive declares.
    const dependency = JSON.parse(
      readFileSync(join(styleSpec, "package.json"), "utf8")
    );
    const manifest = JSON.parse(
      readFileSync(join(installed, "package.json"), "utf8")
    );
    assert.equal(manifest.dependencies[styleSpecName], dependency.version);
    const target = join(consumer, "node_modules", styleSpecName);
    for (const file of ["package.json", dependency.types]) {
      cpSync(join(styleSpec, file), join(target, file));
    }
  }

  if (scenario.name === "common") {
    walkDeclarations(join(installed, "dist/index.d.ts"), backends);
    walkDeclarations(join(installed, "dist/native-extensions.d.ts"), backends);
    writeFileSync(
      join(consumer, "common.mjs"),
      `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as extensions from "one-map-react/native-extensions";
const require = createRequire(import.meta.url);
for (const specifier of ["one-map-react", "one-map-react/legacy"]) {
  await assert.rejects(import(specifier), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
  assert.throws(() => require(specifier), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
}
assert.deepEqual(Object.keys(extensions).sort(), ["Images", "UserLocation"]);
assert.equal(typeof extensions.Images, "function");
assert.equal(typeof extensions.UserLocation, "function");
`
    );
    for (const conditions of aliasConditions) {
      run(
        "node",
        [...conditions.map(asNodeCondition), join(consumer, "common.mjs")],
        consumer
      );
    }
  }

  for (const [entry, backend] of scenario.entries) {
    const resolved = resolvePackage(
      consumer,
      `one-map-react/${entry}`,
      scenario.conditions
    );
    assert.ok(
      resolved.endsWith(`/dist/${backend}.js`),
      `${scenario.name} ${entry} -> ${resolved}`
    );
  }

  if (scenario.name === "common") {
    writeFileSync(
      join(consumer, "selection.tsx"),
      `import type { Backend, Bounds, LayerProps, MapProps, MapRef, ViewState } from "one-map-react";
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;
const rootHasNoValues: Equal<keyof typeof import("one-map-react"), never> = true;
void rootHasNoValues;
// @ts-expect-error Adapter objects are private.
import type { Adapter } from "one-map-react";
// @ts-expect-error The setup component and its props are retired.
import type { MapSetupProps } from "one-map-react";
// @ts-expect-error The legacy entry no longer resolves.
import type * as Legacy from "one-map-react/legacy";
// @ts-expect-error The root layer types reject cross-family properties.
const badLine: LayerProps = { id: "bad-line", type: "line", paint: { "circle-radius": 3 } };
const routes: LayerProps = { id: "routes", type: "line", paint: { "line-width-transition": { duration: 250 } } };
void routes;
declare const commonRef: MapRef;
// @ts-expect-error Source click events are removed.
import type { SourceClickEvent } from "one-map-react";
// @ts-expect-error Common source activation belongs to Map.onClick.
type RemovedCommonSourceCallback = import("one-map-react").SourceProps["onClick"];
// @ts-expect-error Source activation belongs to Map.onClick.
type RemovedSourceCallback = import("one-map-react").GeoJsonSourceProps["onClick"];
// @ts-expect-error Vector source activation belongs to Map.onClick.
type RemovedVectorCallback = import("one-map-react").VectorSourceProps["onClick"];
// @ts-expect-error Supplied location is display only.
type RemovedLocationPress = import("one-map-react/native-extensions").UserLocationProps["onPress"];
// @ts-expect-error Common popup props are removed.
import type { PopupProps } from "one-map-react";
// @ts-expect-error Common custom control props are removed.
import type { ControlProps } from "one-map-react";
// @ts-expect-error Common placement positions are removed.
import type { ControlPosition } from "one-map-react";
// @ts-expect-error Common location control props are removed.
import type { GeolocateControlProps } from "one-map-react";
// @ts-expect-error Common scale props, including width and units, are removed.
import type { ScaleControlProps } from "one-map-react";
// @ts-expect-error Common attribution props are removed.
import type { AttributionControlProps } from "one-map-react";
// @ts-expect-error The common control props are removed.
import type { NavigationControlProps } from "one-map-react";
// @ts-expect-error The common control props are removed.
import type { FullscreenControlProps } from "one-map-react";
// @ts-expect-error Offline packs belong to the selected SDK.
import type { OfflinePack } from "one-map-react";
// @ts-expect-error Offline creation options belong to the selected SDK.
import type { OfflinePackOptions } from "one-map-react";
// @ts-expect-error Offline status belongs to the selected SDK.
import type { OfflinePackStatus } from "one-map-react";
// @ts-expect-error No common offline service remains.
import type { OfflineService } from "one-map-react";
// @ts-expect-error Common location services are removed.
import type { MapServices } from "one-map-react";
// @ts-expect-error Common acquisition type is removed.
import type { LocationService } from "one-map-react";
// @ts-expect-error Common acquisition type is removed.
import type { LocationPermission } from "one-map-react";
// @ts-expect-error Common acquisition type is removed.
import type { LocationOptions } from "one-map-react";
// @ts-expect-error Common acquisition type is removed.
import type { LocationAbortSignal } from "one-map-react";
// @ts-expect-error Common independent image output is removed.
import type { ImageOutput } from "one-map-react";
// @ts-expect-error Common independent image result is removed.
import type { MapImage } from "one-map-react";
// @ts-expect-error Snapshot inputs belong to the selected SDK.
import type { StaticMapImageOptions } from "one-map-react";
// @ts-expect-error No common snapshot service remains.
import type { StaticMapImageService } from "one-map-react";
// @ts-expect-error Capture belongs to the application and selected wrapper.
commonRef.capture({ output: "data-url", scope: "backend" });
// @ts-expect-error Capture-only options are removed from the common package.
import type { CaptureOptions } from "one-map-react";
// @ts-expect-error Capture scope is no longer a common promise.
import type { CaptureScope } from "one-map-react";
// @ts-expect-error Capture-only results are removed from the common package.
import type { MapCapture } from "one-map-react";
// @ts-expect-error Wrapper access belongs to selected refs.
commonRef.getWrapperMap();
const viewState: ViewState = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};
const style = { version: 8 as const, sources: {}, layers: [] };
const bounds: Bounds = [[-123, 47], [-122, 48]];
const fitted: Promise<void> = commonRef.fitBounds(bounds, { maxZoom: 10 });
const backend: Backend = "mapbox-native";
void fitted; void backend;
// @ts-expect-error Drawing-buffer configuration is a selected wrapper option.
type RemovedCommonCapture = MapProps["captureEnabled"];
const mapProps: MapProps = { mapStyle: style, initialViewState: viewState, terrain: { source: "dem", exaggeration: 0 }, projection: "mercator", light: { intensity: 0 } };
void mapProps;
// @ts-expect-error An arbitrary backend must not type-check.
const invalid: Backend = "automatic";
`
    );
  } else {
    writeFileSync(
      join(consumer, "selection.tsx"),
      scenario.entries
        .map(
          ([entry], index) =>
            `import type * as Selected${index} from "one-map-react/${entry}";`
        )
        .join("\n")
    );
  }
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        lib: ["ES2022"],
        customConditions: scenario.conditions,
      },
      files: ["selection.tsx"],
    })
  );
  const trace = run(
    compiler,
    ["-p", "tsconfig.json", "--traceResolution"],
    consumer
  );
  for (const [entry, backend] of scenario.entries) {
    assert(
      trace.includes(
        `Module name 'one-map-react/${entry}' was successfully resolved to '${realpathSync(installed)}/dist/${backend}.d.ts'`
      ),
      `Unexpected declaration for ${scenario.name}: ${entry}`
    );
  }

  for (const peer of [...backends, "react-dom"]) {
    assert(
      !existsSync(join(consumer, "node_modules", peer)),
      `Unexpected peer: ${peer}`
    );
  }
  evidence.push({
    scenario: scenario.name,
    archiveSha256: createHash("sha256")
      .update(readFileSync(archive))
      .digest("hex"),
    react: JSON.parse(
      readFileSync(join(consumer, "node_modules/react/package.json"), "utf8")
    ).version,
    reactTypes: JSON.parse(
      readFileSync(
        join(consumer, "node_modules/@types/react/package.json"),
        "utf8"
      )
    ).version,
    lockfileSha256: existsSync(join(consumer, "bun.lock"))
      ? createHash("sha256")
          .update(readFileSync(join(consumer, "bun.lock")))
          .digest("hex")
      : null,
    status: "passed",
    scope:
      "type-only root, native extensions, and peer-free selected declaration resolution; test-peers checks backend compatibility",
  });
  rmSync(consumer, { recursive: true, force: true });
};

const asNodeCondition = (name) => `--conditions=${name}`;

await main();
