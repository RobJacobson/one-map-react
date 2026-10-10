# Adapter selection and Metro browser transport

**Historical decision.** This record describes the previous implementation. Preserve its upstream evidence and observed failures, but assess its design choices against the [thin-facade requirements](../requirements.md). Its instructions and acceptance results do not govern or certify the replacement.

**Historical implementation status:** The common provider, map registration, explicit adapter entries, and browser-first aliases were implemented in the retired source. Packed selected-peer checks and mounted context tests provide package and React ownership evidence. Renderer creation, native linking, and six-environment runtime conformance remain separate gates in the archived implementation-status document.

The research basis is the frozen [version baseline](../../records/version-baseline.json), inspected on 2026-10-08. Source links below refer to the selected release tag or commit; package and runtime observations are linked separately.

## Selection and map ownership

Select one stable adapter during application setup and pass it to OneMapProvider. Replacing that adapter during the provider's lifetime raises InvalidMapOptionError; switching requires remounting the provider. Each map has a stable nonempty ID unique within its provider. A retained handle becomes not-ready after its renderer detaches, and commands reject with MapNotReadyError. StrictMode effect replay can detach and reattach the same session without permanently disposing it.

The common entry imports React and one-map-react modules without importing a backend or requiring a DOM. Each explicit adapter imports its selected wrapper and host. The platform aliases select the browser target before the React Native target, including when Metro enables both conditions. See the archived architecture document’s dependency ownership section and the [portable contracts](0002-portable-contracts.md).

## Metro browser setup

The pinned renderers need a scoped Metro browser configuration. Mapbox GL JS 3.32.0's distributed build uses a browser dynamic import with a computed URL; its [release build configuration](https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/rollup.config.ts) preserves browser imports through the renderer's helper. Metro's dependency collector rejects that computed import. MapLibre GL JS 6.13.0's module artifact also contains modern syntax that the default React Native Babel preset does not transform successfully in the tested configuration. These are observed bundling failures, retained in the package-selection evidence; they do not establish unavailable SDK features.

Apply `withOneMapMetroWeb` only to a browser Metro configuration. The helper requires the pinned optional `@react-native/metro-config` toolchain and its default Babel transformer and Metro serializer. It rejects incompatible custom transformers or serializers rather than replacing their behavior. Native configurations retain their ordinary React Native setup.

```js
// metro.web.config.cjs
const { getDefaultConfig } = require("@react-native/metro-config");
const { withOneMapMetroWeb } = require("one-map-react/metro-web");

module.exports = withOneMapMetroWeb(getDefaultConfig(__dirname));
```

The retired scoped transformer (`src/metro-web-transformer.cjs`) parses the selected renderer artifacts without general Babel transpilation, preserves their serialized worker bodies, and converts MapLibre's module exports into Metro's module format. For Mapbox, it forwards computed imports to a native browser import function emitted outside Metro's dependency collector. Other modules retain the default React Native transformer. Direct SDK transport tests now execute both renderers and their workers in Chromium, with GeoJSON loading, updates, and map removal. These tests establish development-bundle transport; they do not exercise the one-map-react facade or establish production minification compatibility. Results and earlier failures are retained in [selection evidence](../../records/evidence/selection.json).

Serve the Metro web bundle as a module script. MapLibre GL JS 6.13.0 resolves its module worker relative to `import.meta.url` in [worker setup](https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/web_worker.ts). Copy the selected renderer's assets beside the served bundle with `copyOneMapMetroWebAssets`. The helper records the version, byte counts, and SHA256 hashes; it reuses identical assets and rejects conflicting files. Mapbox's tested distribution uses inline workers and requires no copied worker assets.

```js
// scripts/prepare-metro-web.cjs
const { copyOneMapMetroWebAssets } = require("one-map-react/metro-web-assets");

copyOneMapMetroWebAssets({
  backend: "maplibre",
  destinationDirectory: "./public/metro",
});
// Serve transport.bundle.js and copied assets in ./public/metro.
// Load the bundle with <script type="module" src="/metro/transport.bundle.js">.
```

MapLibre's transport run releases the removed map's worker ownership while the SDK's global dispatcher retains its own worker reference. The evidence distinguishes those owners; it does not treat a remaining SDK-global worker as a map leak. See the pinned [dispatcher](https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/dispatcher.ts) and [worker pool](https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/worker_pool.ts).

The browser helper owns `globalThis.__oneMapBrowserImport` for the page lifetime. Bundles reuse an existing one-map-react helper and reject a conflicting global owner. Map unmount does not remove a helper that another bundle may use. Its promise success and rejection behavior is checked in Chromium; no evaluation of generated source strings is required.

## Verification boundaries

The package suite installs fresh consumers outside workspace hoisting, checks declarations and conditional exports, verifies missing-selected-peer failures, and inspects browser and native Metro dependency graphs. It includes both mixed-engine configurations. Native fixture materialization additionally checks separate application identities and selected-only autolinking configuration. Installed packages, JavaScript graphs, and linked native SDKs remain distinct evidence: no native binary has been certified by these checks.

The mounted context suite uses React Native host mocks to verify reactive readiness, cleanup, named-map lookup, duplicate-ID ownership, adapter identity, and diagnostic deduplication. It does not execute RNMapbox, MapLibre React Native, or either native SDK. The root `validate` command includes static, portable, context, build, and packed selection checks; real-renderer commands remain explicit runtime gates.
