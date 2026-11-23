# Library boundary

one-map-react lets an application share a map screen across web, iOS, and Android. The application chooses the renderer in platform imports. Web imports stock react-map-gl. Native imports `one-map-react/mapbox-native` or `one-map-react/maplibre-native`. The [package guide](../packages/one-map-react/README.md) covers install, imports, patches, and current limitations. The [vessel screen](../packages/example-map/reference/VesselMap.tsx) compiles the same calls against all four choices.

Browser convenience entries re-export react-map-gl. A browser application can omit this package.

## What the library owns

Each native map owns its camera conversion, attached ref, source registry, click delivery, and live marker overlay.

Camera converters translate desktop camera inputs for RNMapbox and MapLibre React Native. Initial defaults, a later target, and movement observed after a gesture stay distinct. `viewState` applies a changed camera target. An unchanged target stays where the gesture left it. The strict `controlledCamera` capability is not offered. See the [RNMapbox converter](../packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts) and the [MapLibre converter](../packages/one-map-react/src/adapters/maplibre-native/convert-camera.ts).

A source handle belongs to one registration. Replacing a source under the same id keeps the replacement when the old registration cleans up. See the [source registry](../packages/one-map-react/src/adapters/shared/native-source-registry.ts).

A filtered click can finish after its map detaches. Completion reaches the current callback only while the original map is still attached. See [click delivery](../packages/one-map-react/src/facade/use-map-interactions.ts).

Live marker children stay in the React tree through `react-native-teleport`. Placement follows camera movement, host layout, and an asynchronous projection that can finish after the marker moves or unmounts. See the [marker overlay](../packages/one-map-react/src/adapters/shared/native-marker-overlay.tsx).

`Images` and `UserLocation` are exported from `one-map-react/native-extensions`. On web, the application registers style images through the selected SDK and draws a supplied location with a marker or a GeoJSON layer.

## What the application owns

The application owns credentials, host layout, browser CSS, permissions, location acquisition, offline packs, snapshots, and screen controls. Selected SDK operations use `getWrapperMap()` or a direct SDK import. Offline, snapshot, and location managers stay on the selected native entry. The application owns their policy, cleanup, and storage.

Map-level `getClusterExpansionZoom`, `getClusterLeaves`, and `getClusterChildren` still exist on the native refs. The desktop shape is the GeoJSON source returned by `map.getSource(id)`. Removing the map-level methods is an open owner decision. Until that decision, keep both forms and keep lookup by source id.

## Native fit cap

Native `fitBounds` rejects a supplied `maxZoom`, including `0`. Web forwards the option. The capped fit belongs in the upstream wrappers, which calculate the camera before it moves. The adapters keep rejecting the option until those wrappers accept it. A temporary map-wide zoom limit would also change gestures and later commands.

## Native repairs

Each release targets one exact version of each React Native wrapper. This release targets [RNMapbox 10.3.19](https://github.com/rnmapbox/maps/tree/ab9322d8e3bb1db3f3080049f9de816898c2bef7) and [MapLibre React Native 11.5.1](https://github.com/maplibre/maplibre-react-native/tree/6941f96d1c7bc0e52847663d46935dc43e3ce2ab). The package guide lists the patch files and SDK pins. Start the next upgrade from pristine npm packages and recheck the rows below.

| Area | Repair still required on these versions | Routine evidence |
| --- | --- | --- |
| Camera and events | RNMapbox clears removed camera bounds upstream. Its Android event cache still needs per-view keys and cleanup. Its iOS immediate camera mode still needs the constant read by the JS wrapper. MapLibre still needs to clear the previous constraint when bounds are removed on either platform. | [Archive check](../scripts/test-package.mjs), [camera mode dispatch](../scripts/native-camera-mode.test.mjs), [bounds regression](../scripts/native-camera-bounds-reset.test.mjs) |
| Styles and sources | RNMapbox now decodes Swift light colors upstream. Keep RNMapbox terrain disable and elevation result handling, explicit Android feature-state errors, and MapLibre detached-view rejection. | [Color conversion](../scripts/rnmapbox-light-color.test.mjs), [terrain and declarations](../scripts/tf09-peer-patches.test.mjs), [source lifetimes](../scripts/native-source-lifetime.test.mjs) |
| Images | RNMapbox iOS removes registered images on view removal upstream. Both peers still need guards against late image writes after replacement or teardown. | [Image ownership and patch verification](../scripts/tf08-patches.test.mjs) |
| Selected SDK operations | The wrappers still need repairs for offline pack status, storage operations, snapshot handling, and RNMapbox custom-location observer replay. These paths are reachable through the selected native APIs. | [Offline and snapshot coverage](../scripts/tf08-patches.test.mjs), [offline status](../scripts/rnmapbox-offline-status.test.mjs), [location replay](../scripts/rnmapbox-location-observer.test.mjs) |
| Consumer builds | Both pristine wrappers generate the same map-view protocol names. Keep the RNMapbox codegen rename and the declaration fixes required by isolated NodeNext consumers. | [Dual codegen](../scripts/example-native-codegen.test.mjs), [packed peer checks](../scripts/test-peers.mjs) |

These rows are source, compiled-method, and package checks. Native linking, renderer behavior, and service acceptance on these versions remain open under [testing](testing.md).

## Renderer acceptance

Mocked tests and package checks cover the adapter mappings. Seeing the map render still requires a browser or a device. [Testing](testing.md) says when to run that.
