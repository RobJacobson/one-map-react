# Library boundary

one-map-react lets an application share a map screen across web, iOS, and Android. The application chooses the renderer in platform imports. Web imports stock react-map-gl. Native imports `one-map-react/mapbox-native` or `one-map-react/maplibre-native`. The [package guide](../packages/one-map-react/README.md) covers install, imports, patches, and current limitations. The [vessel screen](../packages/example-map/reference/VesselMap.tsx) compiles the same calls against all four choices.

Browser convenience entries re-export react-map-gl. A browser application can omit this package.

## What the library owns

The [RNMapbox entry](../packages/one-map-react/src/mapbox-native.tsx) and the [MapLibre React Native entry](../packages/one-map-react/src/maplibre-native.tsx) bind their backend to the [shared native components and hooks](../packages/one-map-react/src/facade/native-map.tsx). `MapProvider` owns named lookup for its entry. The [mounted map](../packages/one-map-react/src/facade/map.tsx) owns its renderer attachment, stable `useMap()` handle, and common callbacks. The handle forwards each call to the current attachment.

Camera converters translate desktop camera inputs for RNMapbox and MapLibre React Native. Initial defaults, a later target, and movement observed after a gesture stay distinct. `viewState` applies a changed camera target. An unchanged target stays where the gesture left it. The strict `controlledCamera` capability is not offered. See the [RNMapbox converter](../packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts) and the [MapLibre converter](../packages/one-map-react/src/adapters/maplibre-native/convert-camera.ts).

Each native map owns its source registry. The [shared registry](../packages/one-map-react/src/adapters/shared/native-source-registry.ts) keeps the replacement when an old source registration with the same ID cleans up. The [cluster helper](../packages/one-map-react/src/adapters/shared/native-clusters.ts) caches one GeoJSON handle per registration and normalizes cluster results for both backends. Consumers query clusters through the handle returned by `map.getSource(id)`.

A filtered click can finish after its map detaches. Completion reaches the current callback only while the original map is still attached. See [click delivery](../packages/one-map-react/src/facade/use-map-interactions.ts).

Both adapters render through the [shared native host](../packages/one-map-react/src/adapters/shared/native-map-host.tsx). It measures the viewport and mounts the portal host for live marker children. The [marker overlay](../packages/one-map-react/src/adapters/shared/native-marker-overlay.tsx) keeps those children in the React tree through `react-native-teleport`. It projects the marker position when the camera, viewport, or marker coordinates change and ignores results from retired projections.

`Images` and `UserLocation` are exported from `one-map-react/native-extensions`. On web, the application registers style images through the selected SDK and draws a supplied location with a marker or a GeoJSON layer.

## What the application owns

The application owns credentials, host layout, browser CSS, permissions, location acquisition, offline packs, snapshots, and screen controls. Selected SDK operations use `getWrapperMap()` or a direct SDK import. Offline, snapshot, and location managers stay on the selected native entry. The application owns their policy, cleanup, and storage.

The Vite and Expo apps import the shared example package. Backend-specific example modules supply renderer components and services to the shared [web acceptance scene](../packages/example-map/src/scenarios/WebAcceptanceScene.tsx) and [native acceptance scene](../packages/example-map/src/scenarios/NativeAcceptanceScene.tsx).

## Native fit cap

Native `fitBounds` rejects a supplied `maxZoom`, including `0`. Web forwards the option. The capped fit belongs in the upstream wrappers, which calculate the camera before it moves. The adapters keep rejecting the option until those wrappers accept it. A temporary map-wide zoom limit would also change gestures and later commands.

## Native repairs

Each release targets one exact version of each React Native wrapper. This release targets [RNMapbox 10.3.19](https://github.com/rnmapbox/maps/tree/ab9322d8e3bb1db3f3080049f9de816898c2bef7) and [MapLibre React Native 11.5.1](https://github.com/maplibre/maplibre-react-native/tree/6941f96d1c7bc0e52847663d46935dc43e3ce2ab). The package guide lists the patch files and SDK pins. Start the next upgrade from pristine npm packages and recheck the rows below.

| Area | Repair still required on these versions | Routine evidence |
| --- | --- | --- |
| Camera and events | RNMapbox clears removed camera bounds upstream. Its Android event cache still needs per-view keys and cleanup. Its iOS immediate camera mode still needs the constant read by the JS wrapper. MapLibre still needs to clear the previous constraint when bounds are removed on either platform. | [Archive check](../tests/package/selection.test.mjs), [camera mode dispatch](../tests/peers/camera-mode.test.mjs), [bounds regression](../tests/peers/camera-bounds-reset.test.mjs) |
| Styles and sources | RNMapbox now decodes Swift light colors upstream. Keep RNMapbox terrain disable and elevation result handling, explicit Android feature-state errors, and MapLibre detached-view rejection. | [Color conversion](../tests/peers/light-color.test.mjs), [terrain and declarations](../tests/peers/terrain.test.mjs), [source lifetimes](../tests/peers/source-lifetime.test.mjs) |
| Images | RNMapbox iOS removes registered images on view removal upstream. Both peers still need guards against late image writes after replacement or teardown. | [Image ownership and patch verification](../tests/peers/patches.test.mjs) |
| Selected SDK operations | The wrappers still need repairs for offline pack status, storage operations, snapshot handling, and RNMapbox custom-location observer replay. These paths are reachable through the selected native APIs. | [Offline and snapshot coverage](../tests/peers/patches.test.mjs), [offline status](../tests/peers/offline-status.test.mjs), [location replay](../tests/peers/location-observer.test.mjs) |
| Consumer builds | Both pristine wrappers generate the same map-view protocol names. Keep the RNMapbox codegen rename and the declaration fixes required by isolated NodeNext consumers. | [Dual codegen](../tests/example/native-codegen.test.mjs), [packed peer checks](../tests/package/peers.test.mjs) |

These rows are source, compiled-method, and package checks. Native linking, renderer behavior, and service acceptance on these versions remain open under [testing](testing.md).

## Renderer acceptance

Mocked tests and package checks cover the adapter mappings. Seeing the map render still requires a browser or a device. [Testing](testing.md) says when to run that.
