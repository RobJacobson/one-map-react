# TF02 handoff: Mapbox Android initial camera

**Closed. TF02 passed on 2026-10-10.** The opening frame matches pinned `@rnmapbox/maps` 10.3.7. `Camera` `defaultSettings` is applied with a zero-duration `flyTo`. On a cold style cache that animation writes the center while zoom is still 0, and Mapbox's height constraint keeps latitude at 0. The facade passes the same stop the wrapper documents, and stock RNMapbox reproduces the frame. The upstream fix is [pull request #4332](https://github.com/rnmapbox/maps/pull/4332) for [issue #4273](https://github.com/rnmapbox/maps/issues/4273). Drop the limitation when the pinned peer is a release that contains it. Do not patch `node_modules`, do not point the example at the fork, and do not change the adapter for this miss. The notes below are the investigation record.

## What the smoke showed

MapLibre web, iOS, and Android passed. Mapbox web and iOS passed. Mapbox Android, on the Medium_Phone emulator, API 37, on 2026-10-10, opened at longitude 0, latitude 0 and then flew to the route. That opening frame matches the pinned wrapper.

The expected opening view is longitude -122.34, latitude 47.61, zoom 11, from `tests/fixtures/map.json`. Fly north targets longitude -122.32, latitude 47.64, duration 1000. The line is `#2563eb`, width 3, on the empty gray style `#f5f5f5`.

Android mount and remount both logged `onMove` with origin `unknown`, longitude 0, latitude 0, then zoom 0.6917435191712747. The route was off screen. A pixel scan of the opening screenshot found no route-colored pixels in the map area. Fly north then logged longitude -122.32, latitude 47.64, zoom 11, origin `unknown`, and the blue line was visible. Remount created a new map: the camera left the flown view. That new map again opened at 0, 0.

The compact record is [tf02-shared-map.json](../records/evidence/tf02-shared-map.json). The stage record is [tf02-shared-map.md](tf02-shared-map.md). TF02 is complete. Map reuse is recorded in [TF03](tf03-reuse.md).

## What already works on this build

The public token comes from the shell variable `MAPBOX_ACCESS_TOKEN` or a gitignored `.env` file. Do not print it, and do not search the home directory for it. An earlier run was blocked because a token file was empty. That file is gone. This Android run used the shell variable, and the map drew Mapbox chrome and, after the flight, the route. The token is not the camera failure.

The app uid cannot open `10.0.2.2:8081`. The debug host was written to `debug_http_host` in the app preferences, using the computer's LAN address at that time (`192.168.12.116:8081`). Re-detect the address with `ipconfig getifaddr en0` rather than assuming it is unchanged. RNMapbox's `setDebugServerHost` only caches the host in memory, and `PackagerConnectionSettings` clears that cache on init. A cold start reads `debug_http_host` from the default shared preferences. The nearby-devices prompt was dismissed.

The Maps SDK is not on Maven Central. `scripts/setup-native-example.mjs` adds `https://api.mapbox.com/downloads/v2/releases/maven`. The smoke build resolved `com.mapbox.maps:android-ndk27:11.23.1`. `MAPBOX_DOWNLOADS_TOKEN` was unset and was not required. The iOS deployment target is raised to 15.0 in the same script because Xcode 27 rejects 14.0. This machine's Bundler is 4.0.17 against a gemspec of 4.0.20, so use `/opt/homebrew/bin/pod` directly.

`@rnmapbox/maps` is 10.3.7. React Native is 0.87.1, and the app log reported `"fabric":true`. The example package is `com.onemapmapbox`. Metro for that example was serving `./index.js` on port 8081. The shared route component is `examples/shared/route-map.tsx`.

## Where the opening camera is dropped

**Existing API, inspected in the installed `@rnmapbox/maps@10.3.7` tree.** The facade passes the frozen first `initialViewState` into RNMapbox `Camera` `defaultSettings`. `toRnmapboxDefaultSettings` in `packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts` (flat `src/convert-camera.ts` when this was investigated) copies longitude and latitude into `centerCoordinate`, zoom into `zoomLevel`, bearing into `heading`, and pitch into `pitch`. The Mapbox native map component (flat `src/mapbox-native.tsx` when this was investigated, now split under `packages/one-map-react/src/adapters/mapbox-native/`) renders that as the `Camera` child of `MapView`. The same component flew correctly, so the ref and `setCamera` path work.

RNMapbox `Camera.tsx` turns `defaultSettings` into the native `defaultStop` prop. On Android, `RNMBXCamera.setDefaultStop` only assigns `mDefaultStop`. The only reader is `setInitialCamera`, called from `addToMap`. `RNMBXCamera.requiresStyleLoad` is false, so `RNMBXMapView.addFeature` calls `addToMap` as soon as the camera view is inserted, if the window is already attached. If `mDefaultStop` is null at that moment, `setInitialCamera` returns without moving the map. A `defaultStop` that arrives later is stored and never applied.

`setStop` is the other path. `flyTo` uses it through `setCamera`, and `setStop` calls `updateCamera` immediately. That is why Fly north moved the map and revealed the line.

iOS keeps the same `defaultStop` property, but applies it later. `RNMBXMapView.layoutSubviews` calls `camera.initialLayout()` once, and that calls `_setInitialCamera()`. The iOS smoke opened on the route, so the shared props and the stop contents are sufficient on iOS.

**Finding.** `setDefaultStop` does store the Seattle stop, and `setInitialCamera` does run it. The miss is inside that update. `CameraUpdateItem.run` sent duration 0 and mode `none` through `flyTo`, which writes center and zoom as separate camera updates. The center write runs at zoom 0, where the height constraint can only center at latitude 0, and the later zoom write does not restore the latitude. The logged zoom `0.6917435191712747` is the SDK default for the view, `log2(827/512)`, not zoom 11. iOS uses one `setCamera` for mode `none` and opened on the route. A later check of stock RNMapbox `defaultSettings` on a cold cache showed the same latitude loss, including an inline style with no camera of its own. Deferring the update until style load still calls `flyTo`, so an empty style still loses the latitude.

## After the finding

The public API already expresses the opening camera, and the facade passes it through. The miss is inside `@rnmapbox/maps` 10.3.7. Do not patch `node_modules`. The [TF02 record](tf02-shared-map.md) traces `flyTo` and `onMove`.

The packed library for the smoke is SHA-256 `b47b647d5a33c46ea074e5eaa5dde43b62d7514f35c5a8d4e21f79befad5104f`. Library source did not change during the token or smoke work. Example and setup-script edits are outside that hash.

Do not commit unless asked. Do not re-run the six-environment smoke. A changed artifact, or another Android install and flight, needs a new permission from the owner. Routine unit tests and reading the installed wrapper source do not. Keep new evidence compact in `records/evidence`, and leave the earlier "blocked on an empty token file" notes intact as the record of that first run.

Generated `examples/native-mapbox/ios` and `android` are gitignored and still present from the smoke. They match the setup script's Maven repository and iOS 15.0 post-install. The camera question is closed. Remove those trees when the owner asks for cleanup.
