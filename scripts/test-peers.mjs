import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { installConsumerPatch } from "./consumer-peer-patches.mjs";
import {
  packageCheckOptions,
  selectedVersions,
} from "./package-check-options.mjs";

const options = packageCheckOptions();
const evidence = [];
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "one-map-peers-"));
const compiler = join(root, "node_modules/.bin/tsc");
const backends = [
  "react-map-gl",
  "mapbox-gl",
  "maplibre-gl",
  "@rnmapbox/maps",
  "@maplibre/maplibre-react-native",
  "react-native-teleport",
];

const peers = {
  "mapbox-web": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "@types/react@19.2.18",
    "react-map-gl@8.1.3",
    "mapbox-gl@3.32.0",
  ],
  "maplibre-web": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "@types/react@19.2.18",
    "react-map-gl@8.1.3",
    "maplibre-gl@6.13.0",
  ],
  "mapbox-native": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "react-native@0.87.1",
    "@types/react@19.2.18",
    "@rnmapbox/maps@10.3.7",
    "react-native-teleport@1.2.1",
  ],
  "maplibre-native": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "react-native@0.87.1",
    "@types/react@19.2.18",
    "@maplibre/maplibre-react-native@11.5.0",
    "react-native-teleport@1.2.1",
    "@types/geojson@7946.0.16",
  ],
};

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

const installedNames = (consumer) => {
  const names = new Set();
  const walk = (directory, scope = "") => {
    if (!directory || !readdirSync(directory, { withFileTypes: true })) {
      return;
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@") && !scope) {
        walk(join(directory, entry.name), entry.name);
        continue;
      }

      names.add(scope ? `${scope}/${entry.name}` : entry.name);
    }
  };

  walk(join(consumer, "node_modules"));
  return names;
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

    for (const [entry, packages] of Object.entries(peers)) {
      await checkPeerConsumer(
        archive,
        entry,
        selectedVersions(packages, options.versions, entry)
      );
    }

    for (const pair of [
      ["mapbox-web", "maplibre-native"],
      ["maplibre-web", "mapbox-native"],
    ]) {
      const [webEntry, nativeEntry] = pair;
      const packages = new Map();
      for (const entry of [webEntry, nativeEntry]) {
        for (const specifier of selectedVersions(
          peers[entry],
          options.versions,
          entry
        )) {
          packages.set(
            specifier.slice(0, specifier.lastIndexOf("@")),
            specifier
          );
        }
      }
      for (const entry of pair)
        await checkPeerConsumer(archive, entry, [...packages.values()]);
    }

    console.log(
      "PASS packed selected-peer consumers: each explicit entry typechecks with only its peers."
    );
  } finally {
    if (options.evidence)
      writeFileSync(
        options.evidence,
        JSON.stringify({ checks: evidence }, null, 2) + "\n"
      );
    rmSync(output, { recursive: true, force: true });
  }
};

const checkPeerConsumer = async (archive, entry, packages) => {
  const consumer = mkdtempSync(join(output, `${entry}-`));
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
    })
  );
  run("bun", ["add", archive, ...packages], consumer);

  for (const peer of ["@rnmapbox/maps", "@maplibre/maplibre-react-native"]) {
    if (packages.some((specifier) => specifier.startsWith(`${peer}@`))) {
      installConsumerPatch(consumer, peer, run);
    }
  }

  const names = installedNames(consumer);
  assert.ok(names.has("one-map-react"));
  const otherBackends = backends.filter(
    (backend) => !packages.some((pkg) => pkg.startsWith(`${backend}@`))
  );
  for (const backend of otherBackends) {
    assert.equal(
      names.has(backend),
      false,
      `${entry} consumer installed ${backend}`
    );
  }

  const selectedAssertions = entry.endsWith("web")
    ? `
import { Map as SelectedMap, Source as SelectedSource, Layer as SelectedLayer, type WebMapRef } from "one-map-react/${entry}";
${entry === "mapbox-web" ? 'import { supported, LngLat, LngLatBounds, MercatorCoordinate, Point, IndoorControl } from "one-map-react/mapbox-web"; const browserSupported: boolean = supported(false); const coordinate: LngLat = new LngLat(0, 0); const bounds: LngLatBounds = new LngLatBounds([0,0], [1,1]); const mercator: MercatorCoordinate = new MercatorCoordinate(0,0,0); const pixel: Point = new Point(0,0); const indoor: IndoorControl = new IndoorControl(); void coordinate; void bounds; void mercator; void pixel; void indoor; void browserSupported;' : ""}
import type { MapRef as WrapperMapRef } from "react-map-gl/${entry === "mapbox-web" ? "mapbox" : "maplibre"}";
declare const selectedRef: WebMapRef;
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;
const exactWrapperPromise: Equal<ReturnType<WebMapRef["getWrapperMap"]>, Promise<WrapperMapRef>> = true;
const borrowed: Promise<WrapperMapRef> = selectedRef.getWrapperMap();
void exactWrapperPromise; void borrowed;
const useBorrowedWrapper = async (): Promise<void> => {
  const wrapper = await selectedRef.getWrapperMap();
  ${entry === "mapbox-web" ? "wrapper.setRain({ density: 0 }); wrapper.getMap().setLanguage('en'); wrapper.getMap().fire('fixture'); wrapper.getMap().dragPan.disable(); const version: string = wrapper.getMap().version; void version;" : "wrapper.setGlobalStateProperty('fixture', 1); wrapper.getMap().refreshTiles('source'); wrapper.getMap().fire('idle'); wrapper.getMap().setEventedParent(null); wrapper.getMap().dragPan.disable(); const version: string = wrapper.getMap().version; void version;"}
};
void useBorrowedWrapper;
const commonCenter: Promise<readonly [number, number]> = selectedRef.getCenter();
void commonCenter;
// @ts-expect-error Advanced renderer reads belong to the wrapper.
selectedRef.getStyle();
// @ts-expect-error Plugin event production belongs to the raw renderer.
selectedRef.fire('fixture');
// @ts-expect-error Gesture controls belong to the raw renderer.
selectedRef.getGestureHandler('dragPan');
// @ts-expect-error Debug options belong to the raw renderer.
selectedRef.setDebugOptions({ repaint: false });
// @ts-expect-error Renderer version belongs to the raw renderer.
selectedRef.getVersion();
// @ts-expect-error Media sources are accessed through the wrapper.
selectedRef.getCanvasSource('canvas');
void <SelectedMap mapStyle={style} initialViewState={viewState} options={{ transformRequest: (url) => ({ url }), ${entry === "maplibre-web" ? "maxCanvasSize: [4096, 4096]," : "language: 'en', worldview: 'US',"} }} />;
void <SelectedSource id="canvas" type="canvas" canvas={"canvas-id"} coordinates={[[0,1],[1,1],[1,0],[0,0]]} />;
void <SelectedLayer id="custom" type="custom" render={() => undefined} />;
${
  entry === "mapbox-web"
    ? `// @ts-expect-error Weather methods belong to the wrapper.
selectedRef.setRain({ density: 0 });
// @ts-expect-error Locale methods belong to the wrapper.
selectedRef.setLanguage('en');
// @ts-expect-error Indoor methods belong to the wrapper.
selectedRef.getIndoorTileOptions('source', '');`
    : `// @ts-expect-error Style state belongs to the wrapper.
selectedRef.setGlobalStateProperty('fixture', 1);
// @ts-expect-error Tile refresh belongs to the wrapper.
selectedRef.refreshTiles('source');
// @ts-expect-error Cancellation belongs to the raw renderer.
selectedRef.setCancelPendingTileRequestsWhileZooming(false);
// @ts-expect-error Cancellation belongs to the raw renderer.
selectedRef.getCancelPendingTileRequestsWhileZooming();
// @ts-expect-error Plugin parent routing belongs to the raw renderer.
selectedRef.setEventedParent(null);`
}
`
    : entry === "mapbox-native"
      ? `
import type { ComponentRef } from "react";
import type { MapView as RnmapboxMapView } from "@rnmapbox/maps";
import { Map as SelectedMap, WrapperMapView, WrapperCamera, WrapperShapeSource, Terrain, Light, Models, RasterArraySource, Viewport, setTelemetryEnabled, type NativeAdvancedMapRef } from "one-map-react/mapbox-native";
void <WrapperMapView styleJSON={JSON.stringify(style)}><WrapperCamera zoomLevel={0} /><WrapperShapeSource id="selected" shape={{ type: "FeatureCollection", features: [] }} /></WrapperMapView>;
void Terrain; void Light; void Models; void RasterArraySource; void Viewport;
setTelemetryEnabled(false);
// @ts-expect-error Selected native settings preserve their boolean input.
setTelemetryEnabled(42);
declare const selectedRef: NativeAdvancedMapRef;
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;
const exactWrapperPromise: Equal<ReturnType<NativeAdvancedMapRef["getWrapperMap"]>, Promise<ComponentRef<typeof RnmapboxMapView>>> = true;
const borrowed: Promise<ComponentRef<typeof RnmapboxMapView>> = selectedRef.getWrapperMap();
void exactWrapperPromise; void borrowed;
void <SelectedMap ref={(map) => { if (map) { const wrapper: Promise<ComponentRef<typeof RnmapboxMapView>> = map.getWrapperMap(); void wrapper; } }} mapStyle={style} initialViewState={viewState} />;
const useBorrowedWrapper = async (): Promise<void> => {
  const wrapper = await selectedRef.getWrapperMap();
  const center: number[] = await wrapper.getCenter();
  const capture: string = await wrapper.takeSnap(true);
  wrapper.setSourceVisibility(false, 'source');
  void center; void capture;
};
void useBorrowedWrapper;
// @ts-expect-error Source visibility belongs to the borrowed native wrapper.
selectedRef.setSourceVisibility(false, 'source');
`
      : `
import type { ComponentRef } from "react";
import type { Map as MaplibreMap } from "@maplibre/maplibre-react-native";
import { Map as SelectedMap, type NativeAdvancedMapRef, WrapperMap, WrapperCamera, WrapperGeoJSONSource, Animated, NetworkManager, TransformRequestManager, Layer as SelectedLayer } from "one-map-react/maplibre-native";
declare const selectedRef: NativeAdvancedMapRef;
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;
const exactWrapperPromise: Equal<ReturnType<NativeAdvancedMapRef["getWrapperMap"]>, Promise<ComponentRef<typeof MaplibreMap>>> = true;
const borrowed: Promise<ComponentRef<typeof MaplibreMap>> = selectedRef.getWrapperMap();
void exactWrapperPromise; void borrowed;
void <SelectedMap ref={(map) => { if (map) { const wrapper: Promise<ComponentRef<typeof MaplibreMap>> = map.getWrapperMap(); void wrapper; } }} mapStyle={style} initialViewState={viewState} />;
const useBorrowedWrapper = async (): Promise<void> => {
  const wrapper = await selectedRef.getWrapperMap();
  const capture: string = await wrapper.createStaticMapImage({ output: "file" });
  const camera = await wrapper.getViewState();
  wrapper.setSourceVisibility(false, 'source');
  wrapper.showAttribution();
  void capture; void camera;
};
void useBorrowedWrapper;
// @ts-expect-error Source visibility belongs to the borrowed native wrapper.
selectedRef.setSourceVisibility(false, 'source');
// @ts-expect-error Attribution belongs to the borrowed native wrapper.
selectedRef.showAttribution();
// @ts-expect-error Selected camera reads belong to the borrowed native wrapper.
selectedRef.getViewState();
void <WrapperMap mapStyle={style}><WrapperCamera initialViewState={{center: [0,0], zoom: 0}} /><WrapperGeoJSONSource id="selected" data={{ type: "FeatureCollection", features: [] }} /></WrapperMap>;
void Animated; void SelectedLayer; void TransformRequestManager;
NetworkManager.setConnected(false);
// @ts-expect-error Selected native settings preserve their boolean input.
NetworkManager.setConnected(42);
`;
  const markerAssertions = entry.endsWith("web")
    ? `
import { Marker as SelectedMarker } from "one-map-react/${entry}";
void <SelectedMarker longitude={0} latitude={0} draggable onDragStart={() => undefined} onDrag={() => undefined} onDragEnd={() => undefined} />;
`
    : `
import { Marker as SelectedMarker, ${entry === "mapbox-native" ? "PointAnnotation" : "ViewAnnotation"} as RawAnnotation } from "one-map-react/${entry}";
void <SelectedMarker longitude={0} latitude={0} draggable={false} onClick={() => undefined} />;
// @ts-expect-error Shared native markers do not drag.
void <SelectedMarker longitude={0} latitude={0} draggable />;
// @ts-expect-error Native shared markers exclude drag-start callbacks.
void <SelectedMarker longitude={0} latitude={0} onDragStart={() => undefined} />;
// @ts-expect-error Native shared markers exclude drag callbacks even when disabled.
void <SelectedMarker longitude={0} latitude={0} draggable={false} onDrag={() => undefined} />;
// @ts-expect-error Native shared markers exclude drag-end callbacks.
void <SelectedMarker longitude={0} latitude={0} onDragEnd={() => undefined} />;
void <RawAnnotation id="raw-drag" ${entry === "mapbox-native" ? "coordinate" : "lngLat"}={[0, 0]} draggable onDragStart={() => undefined} onDrag={() => undefined} onDragEnd={() => undefined}><></></RawAnnotation>;
`;
  writeFileSync(
    join(consumer, "consumer.tsx"),
    `import { Map as OneMap, MapSetup, Source, Layer } from "one-map-react";
import { adapter } from "one-map-react/${entry}";
import type { Adapter } from "one-map-react";

const selected: Adapter = adapter;
void MapSetup;
void Source;
void Layer;
void selected;
const viewState = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};
const style = { version: 8 as const, sources: {}, layers: [] };
${selectedAssertions}
${markerAssertions}
void (
  <OneMap mapStyle={style} initialViewState={viewState} />
);
void (
  <OneMap
    mapStyle={style}
    initialViewState={viewState}
    // @ts-expect-error Invalid map props must not type-check.
    definitelyNotAMapProp
  />
);
`
  );
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
        lib: ["ES2022", "DOM"],
        moduleSuffixes: entry.endsWith("native") ? [".native", ""] : [""],
      },
      files: ["consumer.tsx"],
    })
  );
  try {
    run(compiler, ["-p", "tsconfig.json"], consumer);
  } catch (error) {
    throw new Error(`${entry}: ${error.message}`);
  }

  if (entry.endsWith("web")) {
    writeFileSync(
      join(consumer, "runtime.mjs"),
      `import { adapter } from "one-map-react/${entry}";
console.log(adapter.backend);
`
    );
    assert.equal(run("node", [join(consumer, "runtime.mjs")], consumer), entry);
  }
  const patchedFiles = {};
  for (const peer of ["@rnmapbox/maps", "@maplibre/maplibre-react-native"]) {
    if (!packages.some((specifier) => specifier.startsWith(`${peer}@`)))
      continue;
    const patch = readFileSync(join(consumer, "peer.patch"), "utf8");
    for (const match of patch.matchAll(/^diff --git a\/(.+) b\//gm)) {
      patchedFiles[`${peer}/${match[1]}`] = sha256(
        join(consumer, "node_modules", peer, match[1])
      );
    }
  }
  let retainedLockfile;
  if (options.evidence) {
    const lockRoot = `${options.evidence}.locks`;
    mkdirSync(lockRoot, { recursive: true });
    retainedLockfile = join(lockRoot, `${evidence.length}-${entry}.bun.lock`);
    cpSync(join(consumer, "bun.lock"), retainedLockfile);
  }
  evidence.push({
    entry,
    packages,
    resolvedPeers: Object.fromEntries(
      packages.map((specifier) => {
        const name = specifier.slice(0, specifier.lastIndexOf("@"));
        return [
          name,
          JSON.parse(
            readFileSync(
              join(consumer, "node_modules", name, "package.json"),
              "utf8"
            )
          ).version,
        ];
      })
    ),
    archiveSha256: sha256(archive),
    lockfileSha256: sha256(join(consumer, "bun.lock")),
    retainedLockfile,
    patchedFiles,
    status: "passed",
    scope:
      "isolated declarations, selected web import, peer installation, patch application; no native linking or renderer",
  });
};

await main();
