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
import { walkDeclarations } from "./packed-declarations.mjs";
import { checkNativeLoad } from "./packed-native-load.mjs";

const args = process.argv.slice(2);
const nativeOnly = args.includes("--native-only");
const options = packageCheckOptions(
  args.filter((arg) => arg !== "--native-only")
);
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
    "react-native-teleport@1.2.2",
  ],
  "maplibre-native": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "react-native@0.87.1",
    "@types/react@19.2.18",
    "@maplibre/maplibre-react-native@11.5.0",
    "react-native-teleport@1.2.2",
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
      if (nativeOnly && !entry.endsWith("native")) continue;
      await checkPeerConsumer(
        archive,
        entry,
        selectedVersions(packages, options.versions, entry)
      );
    }

    if (nativeOnly) {
      console.log("PASS two isolated packed native entries and aliases.");
      return;
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
    rmSync(output, { recursive: true, force: true });
    if (options.evidence)
      writeFileSync(
        options.evidence,
        JSON.stringify({ checks: evidence }, null, 2) + "\n"
      );
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

  if (entry.endsWith("native")) {
    const peer =
      entry === "mapbox-native"
        ? "@rnmapbox/maps"
        : "@maplibre/maplibre-react-native";
    const forbidden = backends.filter(
      (backend) => backend !== peer && backend !== "react-native-teleport"
    );
    walkDeclarations(
      join(consumer, "node_modules/one-map-react/dist", `${entry}.d.ts`),
      forbidden
    );
    checkNativeLoad(consumer, entry, peer, run);
  }

  const engine = entry.split("-")[0];
  writeFileSync(
    join(consumer, "consumer.tsx"),
    entry.endsWith("web")
      ? webConsumer(entry, engine)
      : nativeConsumer(entry, consumer)
  );
  const files = ["consumer.tsx"];
  if (entry.endsWith("native")) {
    const reference = join(root, "packages/example-map/reference");
    cpSync(join(reference, `maps.${entry}.ts`), join(consumer, "maps.ts"));
    for (const file of ["VesselMap.tsx", "vessel-fixture.ts"]) {
      cpSync(join(reference, file), join(consumer, file));
    }
    files.push("VesselMap.tsx");
  }
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        // Metro consumers use bundler resolution for the peers' extensionless declarations.
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        lib: ["ES2022", "DOM"],
        customConditions: entry.endsWith("native")
          ? ["react-native"]
          : ["browser"],
        moduleSuffixes: entry.endsWith("native") ? [".native", ""] : [""],
      },
      files,
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
      `import assert from "node:assert/strict";
import * as upstream from "react-map-gl/${engine}";
import * as alias from "one-map-react/${engine}";
import * as explicit from "one-map-react/${entry}";
assert.equal(alias, explicit);
assert.deepEqual(Object.keys(explicit), Object.keys(upstream));
for (const key of Object.keys(upstream)) assert.equal(explicit[key], upstream[key], key);
`
    );
    run("node", [join(consumer, "runtime.mjs")], consumer);
    run(
      "node",
      ["--conditions=browser", join(consumer, "runtime.mjs")],
      consumer
    );
  }
  const patchedFiles = {};
  for (const peer of ["@rnmapbox/maps", "@maplibre/maplibre-react-native"]) {
    if (!packages.some((specifier) => specifier.startsWith(`${peer}@`)))
      continue;
    const patch = readFileSync(join(consumer, "peer.patch"), "utf8");
    for (const match of patch.matchAll(/^diff --git a\/.* b\/(.+)$/gm)) {
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
    scope: entry.endsWith("native")
      ? "isolated declarations and vessel reference, mocked native import, peer installation and patch application; no native linking or renderer"
      : "isolated declarations, selected web import, peer installation",
  });
  rmSync(consumer, { recursive: true, force: true });
};

const webConsumer = (entry, engine) => `
import * as upstream from "react-map-gl/${engine}";
import * as explicit from "one-map-react/${entry}";
import * as alias from "one-map-react/${engine}";
const stock: typeof upstream = explicit;
const forwarded: typeof alias = upstream;
const selected: typeof explicit = alias;
const typedRef: 0 extends (1 & explicit.MapRef) ? false : true = true;
void typedRef;
declare const ref: explicit.MapRef;
const zoom: number = ref.getZoom();
const options: upstream.MapProps = { interactiveLayerIds: ["routes"] };
void <alias.default {...options} onClick={event => event.features?.[0]}><explicit.NavigationControl /></alias.default>;
void stock; void forwarded; void selected; void zoom;
`;

const nativeConsumer = (entry, consumer) => {
  const modelAvailable =
    entry === "mapbox-native" &&
    JSON.parse(
      readFileSync(
        join(consumer, "node_modules/@rnmapbox/maps/package.json"),
        "utf8"
      )
    ).version === "10.3.8";
  const selectedAssertions =
    entry === "mapbox-native"
      ? `
import type { ComponentRef } from "react";
import type { MapView as RnmapboxMapView, SnapshotOptions } from "@rnmapbox/maps";
import { Map as SelectedMap, LocationPuck, WrapperMapView, WrapperCamera, WrapperShapeSource, Terrain, Light, Models, RasterArraySource, Viewport, setTelemetryEnabled, type NativeAdvancedMapRef, WrapperOfflineManager, WrapperSnapshotManager, WrapperLocationManager } from "one-map-react/mapbox-native";
void <WrapperMapView styleJSON={JSON.stringify(style)}><WrapperCamera zoomLevel={0} /><WrapperShapeSource id="selected" shape={{ type: "FeatureCollection", features: [] }} hitbox={{ width: 20, height: 20 }} onPress={() => {}} /></WrapperMapView>;
void Terrain; void Light; void Models; void RasterArraySource; void Viewport;
const selectedLocationManager: typeof import("@rnmapbox/maps").locationManager = WrapperLocationManager;
const addLocationListener: typeof selectedLocationManager.addListener = WrapperLocationManager.addListener;
const removeLocationListener: typeof selectedLocationManager.removeListener = WrapperLocationManager.removeListener;
void addLocationListener; void removeLocationListener;
${modelAvailable ? "" : "// @ts-expect-error The minimum peer has no model puck."}
void <LocationPuck model={{ uri: 'http://127.0.0.1/model.glb', scale: [1,2,3], rotation: [0,0,90], opacity: 0.5 }} />;
setTelemetryEnabled(false);
// @ts-expect-error Selected native settings preserve their boolean input.
setTelemetryEnabled(42);
declare const selectedRef: NativeAdvancedMapRef;
// @ts-expect-error Selected common source hitbox is removed.
type RemovedSelectedHitbox = import("one-map-react/mapbox-native").NativeSourceProps["hitbox"];
// @ts-expect-error Selected common source activation is removed.
type RemovedSelectedCallback = import("one-map-react/mapbox-native").NativeSourceProps["onClick"];
// @ts-expect-error Selected GeoJson facade onClick is removed.
type RemovedSelectedGeoJsonCallback = Extract<import("one-map-react/mapbox-native").NativeSourceProps, { type: "geojson" }>["onClick"];
// @ts-expect-error Selected GeoJson facade hitbox is removed.
type RemovedSelectedGeoJsonHitbox = Extract<import("one-map-react/mapbox-native").NativeSourceProps, { type: "geojson" }>["hitbox"];
// @ts-expect-error Selected Vector facade onClick is removed.
type RemovedSelectedVectorCallback = Extract<import("one-map-react/mapbox-native").NativeSourceProps, { type: "vector" }>["onClick"];
// @ts-expect-error Selected Vector facade hitbox is removed.
type RemovedSelectedVectorHitbox = Extract<import("one-map-react/mapbox-native").NativeSourceProps, { type: "vector" }>["hitbox"];
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;
const exactWrapperPromise: Equal<ReturnType<NativeAdvancedMapRef["getWrapperMap"]>, Promise<ComponentRef<typeof RnmapboxMapView>>> = true;
const exactSelectedKeys: Equal<Exclude<keyof NativeAdvancedMapRef, keyof import("one-map-react").MapRef>, "getWrapperMap" | "getSource"> = true;
void exactSelectedKeys;
const borrowed: Promise<ComponentRef<typeof RnmapboxMapView>> = selectedRef.getWrapperMap();
void exactWrapperPromise; void borrowed;
void <SelectedMap ref={(map) => { if (map) { const wrapper: Promise<ComponentRef<typeof RnmapboxMapView>> = map.getWrapperMap(); void wrapper; } }} mapStyle={style} initialViewState={viewState} />;
const useSelectedOfflineManager = async (): Promise<void> => {
  await WrapperOfflineManager.createPack({ name: "harbor", styleURL: "https://example.test/style", bounds: [[10,10],[-10,-10]], minZoom: 0, maxZoom: 1, metadata: { regionId: "harbor" } }, (pack, status) => {
    const name: string = pack.name;
    const percentage: number | null = status.percentage;
    void name; void percentage;
  }, (pack, error) => { const message: string = error.message; void pack.name; void message; });
  const pack = await WrapperOfflineManager.getPack("harbor");
  void pack?.name;
  WrapperOfflineManager.unsubscribe("harbor");
  // @ts-expect-error RNMapbox creation requires its native name.
  await WrapperOfflineManager.createPack({ mapStyle: "https://example.test/style", bounds: [0,0,1,1] }, () => {});
};
void useSelectedOfflineManager;
const useSelectedSnapshot = async (): Promise<void> => {
  const centeredOptions: ConstructorParameters<typeof SnapshotOptions>[0] = { centerCoordinate: [0,0], zoomLevel: 0, width: 128, height: 80, writeToDisk: false };
  const centered: string = await WrapperSnapshotManager.takeSnap(centeredOptions);
  // @ts-expect-error RNMapbox output is selected with a boolean file flag.
  const invalidOutput: ConstructorParameters<typeof SnapshotOptions>[0] = { centerCoordinate: [0,0], writeToDisk: "file" };
  // @ts-expect-error RNMapbox bounds are coordinate pairs, not flat corners.
  const invalidBounds: ConstructorParameters<typeof SnapshotOptions>[0] = { bounds: [-10,-10,10,10] };
  void invalidOutput; void invalidBounds;
  const bounded: string = await WrapperSnapshotManager.takeSnap({ bounds: [[10,10],[-10,-10]], width: 128, height: 80, writeToDisk: true });
  void centered; void bounded;
};
void useSelectedSnapshot;

const useBorrowedWrapper = async (): Promise<void> => {
  const wrapper = await selectedRef.getWrapperMap();
  const center: number[] = await wrapper.getCenter();
  const capture: string = await wrapper.takeSnap(true);
  const base64: string = await wrapper.takeSnap(false);
  void base64;
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
import { Map as SelectedMap, type NativeAdvancedMapRef, WrapperMap, WrapperCamera, WrapperGeoJSONSource, Animated, NetworkManager, TransformRequestManager, Layer as SelectedLayer, WrapperOfflineManager, WrapperStaticMapImageManager, WrapperLocationManager } from "one-map-react/maplibre-native";
const selectedLocationManager: typeof import("@maplibre/maplibre-react-native").LocationManager = WrapperLocationManager;
const addLocationListener: typeof selectedLocationManager.addListener = WrapperLocationManager.addListener;
const removeLocationListener: typeof selectedLocationManager.removeListener = WrapperLocationManager.removeListener;
void addLocationListener; void removeLocationListener;
declare const selectedRef: NativeAdvancedMapRef;
// @ts-expect-error Selected common source hitbox is removed.
type RemovedSelectedHitbox = import("one-map-react/maplibre-native").NativeSourceProps["hitbox"];
// @ts-expect-error Selected common source activation is removed.
type RemovedSelectedCallback = import("one-map-react/maplibre-native").NativeSourceProps["onClick"];
// @ts-expect-error Selected GeoJson facade onClick is removed.
type RemovedSelectedGeoJsonCallback = Extract<import("one-map-react/maplibre-native").NativeSourceProps, { type: "geojson" }>["onClick"];
// @ts-expect-error Selected GeoJson facade hitbox is removed.
type RemovedSelectedGeoJsonHitbox = Extract<import("one-map-react/maplibre-native").NativeSourceProps, { type: "geojson" }>["hitbox"];
// @ts-expect-error Selected Vector facade onClick is removed.
type RemovedSelectedVectorCallback = Extract<import("one-map-react/maplibre-native").NativeSourceProps, { type: "vector" }>["onClick"];
// @ts-expect-error Selected Vector facade hitbox is removed.
type RemovedSelectedVectorHitbox = Extract<import("one-map-react/maplibre-native").NativeSourceProps, { type: "vector" }>["hitbox"];
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;
const exactWrapperPromise: Equal<ReturnType<NativeAdvancedMapRef["getWrapperMap"]>, Promise<ComponentRef<typeof MaplibreMap>>> = true;
const exactSelectedKeys: Equal<Exclude<keyof NativeAdvancedMapRef, keyof import("one-map-react").MapRef>, "getWrapperMap" | "getSource"> = true;
void exactSelectedKeys;
const borrowed: Promise<ComponentRef<typeof MaplibreMap>> = selectedRef.getWrapperMap();
void exactWrapperPromise; void borrowed;
void <SelectedMap ref={(map) => { if (map) { const wrapper: Promise<ComponentRef<typeof MaplibreMap>> = map.getWrapperMap(); void wrapper; } }} mapStyle={style} initialViewState={viewState} />;
const useSelectedOfflineManager = async (): Promise<void> => {
  const pack = await WrapperOfflineManager.createPack({ mapStyle: "https://example.test/style", bounds: [-10,-10,10,10], minZoom: 0, maxZoom: 1, metadata: { regionId: "harbor" } }, (pack, status) => {
    const id: string = pack.id;
    const percentage: number = status.percentage;
    void id; void percentage;
  }, (pack, error) => { const message: string = error.message; void pack.id; void message; });
  const id: string = pack.id;
  WrapperOfflineManager.removeListener(id);
  // @ts-expect-error MapLibre bounds are flat west/south/east/north values.
  await WrapperOfflineManager.createPack({ mapStyle: "https://example.test/style", bounds: [[10,10],[-10,-10]] }, () => {}, () => {});
};
void useSelectedOfflineManager;
const useSelectedSnapshot = async (): Promise<void> => {
  const centered: string = await WrapperStaticMapImageManager.createImage({ mapStyle: "https://example.test/style", center: [0,0], zoom: 0, width: 128, height: 80, output: "base64" });
  const bounded: string = await WrapperStaticMapImageManager.createImage({ mapStyle: "https://example.test/style", bounds: [-10,-10,10,10], width: 128, height: 80, output: "file" });
  // @ts-expect-error MapLibre snapshot bounds are flat west/south/east/north.
  await WrapperStaticMapImageManager.createImage({ mapStyle: "https://example.test/style", bounds: [[10,10],[-10,-10]], width: 128, height: 80, output: "file" });
  // @ts-expect-error SDK output choices are file or base64.
  await WrapperStaticMapImageManager.createImage({ mapStyle: "https://example.test/style", center: [0,0], width: 128, height: 80, output: "data-url" });
  void centered; void bounded;
};
void useSelectedSnapshot;

const useBorrowedWrapper = async (): Promise<void> => {
  const wrapper = await selectedRef.getWrapperMap();
  const capture: string = await wrapper.createStaticMapImage({ output: "file" });
  const base64: string = await wrapper.createStaticMapImage({ output: "base64" });
  void base64;
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
void <WrapperMap mapStyle={style}><WrapperCamera initialViewState={{center: [0,0], zoom: 0}} /><WrapperGeoJSONSource id="selected" data={{ type: "FeatureCollection", features: [] }} hitbox={{ top: 10, right: 10, bottom: 10, left: 10 }} onPress={() => {}} /></WrapperMap>;
void <SelectedLayer type="raster" afterId="labels" layerIndex={7} style={{ rasterResampling: "nearest" }} />;
void Animated; void TransformRequestManager;
NetworkManager.setConnected(false);
// @ts-expect-error Selected native settings preserve their boolean input.
NetworkManager.setConnected(42);
`;
  const nativeBindingAssertions = `
import { Layer as BoundLayer, Marker as BoundMarker, Source as BoundSource, MapProvider, useMap as useSelectedMap } from "one-map-react/${entry}";
import { useMap as useAliasMap, Map as AliasMap } from "one-map-react/${entry.replace("-native", "")}";
type SelectedTypes = [import("one-map-react/${entry}").MapRef, import("one-map-react/${entry}").MapProps, import("one-map-react/${entry}").LayerProps, import("one-map-react/${entry}").SourceProps, import("one-map-react/${entry}").MarkerProps];
const nativeTypes: Equal<SelectedTypes, [NativeAdvancedMapRef, import("one-map-react/${entry}").NativeMapProps, import("one-map-react/${entry}").NativeLayerProps, import("one-map-react/${entry}").NativeSourceProps, import("one-map-react/${entry}").NativeMarkerProps]> = true;
void nativeTypes;
const SelectedChildren = () => {
  const maps = useSelectedMap();
  const exactCurrent: Equal<typeof maps.current, NativeAdvancedMapRef | undefined> = true;
  const exactNamed: Equal<typeof maps.harbor, NativeAdvancedMapRef | undefined> = true;
  const exactAlias: Equal<typeof useAliasMap, typeof useSelectedMap> = true;
  const exactMapAlias: Equal<typeof AliasMap, typeof SelectedMap> = true;
  void exactCurrent; void exactNamed; void exactAlias; void exactMapAlias;
  return <BoundMarker longitude={0} latitude={0} />;
};
void <MapProvider><SelectedMap id="harbor" mapStyle={style} initialViewState={{ zoom: 1 }} onClick={(event) => {
  const longitude: number = event.lngLat.lng;
  const x: number = event.point.x;
  const hit: string | number | undefined = event.features?.[0]?.id;
  void longitude; void x; void hit;
}}>
  <BoundSource id="routes" type="geojson" data={{ type: "FeatureCollection", features: [] }}>
    <BoundLayer id="route-line" type="line" paint={{ "line-width": 3, "line-width-transition": { duration: 450 } }} />
    <BoundLayer id="route-point" type="circle" paint={{ "circle-radius-transition": { delay: 0 }, "circle-stroke-width-transition": { duration: 450 } }} />
  </BoundSource>
  <SelectedChildren />
</SelectedMap></MapProvider>;
// @ts-expect-error A circle transition belongs to a circle layer.
void <BoundLayer id="invalid" type="line" paint={{ "circle-radius-transition": { duration: 450 } }} />;
// @ts-expect-error A transition's duration is numeric.
void <BoundLayer id="invalid" type="line" paint={{ "line-width-transition": { duration: "slow" } }} />;
const useDesktopShape = async () => {
  await selectedRef.flyTo({ center: { lng: -122.3, lat: 47.6 }, zoom: 9 });
  await selectedRef.flyTo({ zoom: 10, padding: 12 });
  await selectedRef.fitBounds([-123, 47, -122, 48], { padding: 8 });
  const center = await selectedRef.getCenter();
  const point = await selectedRef.project(center);
  const x: number = point.x;
  const west: number = (await selectedRef.getBounds()).getWest();
  await selectedRef.queryRenderedFeatures({ x, y: point.y }, { layers: ["route-line"] });
  await selectedRef.queryRenderedFeatures({ layers: ["route-point"] });
  const source = selectedRef.getSource("routes");
  if (source) {
    const callbackResult: typeof source = source.getClusterExpansionZoom(7, (error, zoom) => {
      const result: number | undefined = zoom;
      const failure: Error | null = error;
      void result; void failure;
    });
    const leaves = await source.getClusterLeaves(7, 2, 0);
    void callbackResult; void leaves;
  }
  void west;
};
void useDesktopShape;
`;
  const nativeUiAssertions = `
import { Callout, type NativeMapProps } from "one-map-react/${entry}";
import { Images, UserLocation } from "one-map-react/native-extensions";
void Images; void UserLocation;
const ornaments: NativeMapProps["options"] = ${entry === "mapbox-native" ? "{ scaleBarEnabled: true, attributionEnabled: true, logoEnabled: true }" : "{ scaleBar: true, attribution: true, logo: true }"};
void ornaments;
void <Callout title="Application callout" />;
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
  return `import { Map as OneMap, MapSetup, Source, Layer } from "one-map-react/legacy";
import { adapter } from "one-map-react/${entry}";
import type { Adapter } from "one-map-react";

const selected: Adapter = adapter;
// @ts-expect-error Selected adapters no longer own application acquisition.
adapter.services;
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
${nativeBindingAssertions}
${nativeUiAssertions}
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
`;
};

await main();
