# Native fitBounds.maxZoom deferred implementation memo

Date: October 12, 2026. Status: deferred by the project owner. Baseline: RNMapbox (`@rnmapbox/maps`) 10.3.7 and MapLibre React Native (`@maplibre/maplibre-react-native`) 11.5.0.

one-map-react will retain its current rejection of `fitBounds.maxZoom` on both native adapters. A future project should add support through two upstream wrapper pull requests, starting with RNMapbox. Web support remains available. The native gap concerns the React wrappers' fit commands; the underlying mobile SDKs provide camera calculation and adjustment facilities that can support the behavior.

## Expected behavior and current handling

`fitBounds` calculates a camera that contains the requested geographic bounds within the viewport and its padding. A fit-specific `maxZoom` caps that operation's target zoom. For a cap of 12, an ordinary fit that calculates zoom 9 should still use 9; a fit that calculates zoom 17 should use 12. Later camera commands and gestures should remain free to exceed 12, subject to the map's ordinary constraints. The map-wide `maxZoom` prop instead restricts all camera movements until changed.

The following comparison uses the same request on every backend: fit a tight Seattle rectangle with a target cap of 12.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| The [10.3.7 fit command](https://github.com/rnmapbox/maps/blob/v10.3.7/src/components/Camera.tsx) accepts northeast and southwest corners, padding, and duration, with no fit-specific cap. | The [11.5.0 fit command](https://github.com/maplibre/maplibre-react-native/blob/v11.5.0/package/src/components/camera/Camera.tsx) accepts flat bounds and an options object, with no fit-specific cap. | The web ref forwards `fitBounds` and its `maxZoom` option to Mapbox GL JS or MapLibre GL JS. See the [web adapter](../packages/one-map-react/src/adapters/web/map-ref.ts). | The existing common signature retains `FitBoundsOptions.maxZoom`. Today, web forwards the cap and native rejects the request. Future native support would produce one capped fit through the wrapper. |

Both native converters throw an ordinary `Error` whenever `maxZoom !== undefined`, including a supplied value of 0. The public asynchronous `MapRef.fitBounds` therefore rejects before dispatching the camera command. The message is `fitBounds.maxZoom is unavailable through the pinned native camera wrapper.` Omitting the option, or supplying `undefined`, preserves the existing native fit path. See the [RNMapbox converter](../packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts), [MapLibre converter](../packages/one-map-react/src/adapters/maplibre-native/convert-camera.ts), and [common contract](../packages/one-map-react/src/contracts/camera-types.ts).

The previous facade accepted this option without reliably enforcing it. The current rejection makes the unsupported request observable. Native cap support remains pending; the [TF04 record](tf04-camera.md) distinguishes the corrected behavior from historical renderer acceptance.

## Wrapper gap and mobile SDK facilities

RNMapbox's TypeScript camera-stop serializer has no fit-cap field. Its Android and iOS bounds paths calculate a fitted native camera without passing a cap. Mapbox's SDK exposes fitting APIs with a `maxZoom` argument, as shown in the [Android camera guide](https://docs.mapbox.com/android/maps/guides/camera-and-animation/camera/) and [iOS fitting API](https://docs.mapbox.com/ios/maps/api/latest/documentation/mapboxmaps/mapboxmap/camera%28for%3Acamera%3Acoordinatespadding%3Amaxzoom%3Aoffset%3A%29/). An upstream wrapper change can carry the requested cap to the appropriate SDK call.

MapLibre React Native's camera command also has no fit-cap field. Android obtains a calculated camera position and uses its zoom; iOS obtains a fitted camera and uses its altitude. The mobile SDK fitting interfaces generally lack a direct per-fit cap parameter, but they return a camera that native code can adjust before movement. See MapLibre Native's [Android bounds calculation](https://maplibre.org/maplibre-native/android/api/-map-libre%20-native%20-android/org.maplibre.android.maps/-map-libre-map/get-camera-for-lat-lng-bounds.html) and [iOS camera facilities](https://maplibre.org/maplibre-native/ios/latest/documentation/maplibre/mlnmapview/). A wrapper implementation should be possible without changing the rendering engine; padding and pitch behavior still require native verification.

Supplying an ordinary `zoom` alongside bounds does not provide the missing behavior. In the inspected wrapper implementations, the bounds calculation takes precedence. The relevant native paths are RNMapbox's `CameraStop.kt` and `RNMBXCamera.swift`, and MapLibre React Native's `CameraStop.kt`, `CameraUpdateItem.m`, and `MLRNMapView.m`. This assessment is based on the installed versions above; recheck upstream branches and existing proposals when the deferred project begins.

## Proposed RNMapbox change

Extend the existing `fitBounds` method while preserving its positional padding and duration calls. A compatible options argument or overload should expose the fit cap; maintainers should choose the final signature and naming. The cap should also be available to bounds-based `setCamera` commands, which one-map-react currently uses for this operation.

Carry the optional cap through the public types, camera-stop serialization, native command declarations, and Android and iOS parsing. Pass it to the native fitting calculation before submitting the camera to the existing animation machinery. Preserve omission behavior and keep the cap separate from the map-wide `maxZoomLevel` constraint. Confirm SDK overload availability across the versions that RNMapbox supports.

Estimated scope is 50–100 handwritten production lines across roughly 5–7 files, plus documentation, tests, and an example. This is an engineering estimate based on the inspected implementation, not a measured patch. RNMapbox should be the smaller first contribution because its SDK already accepts the cap.

## Proposed MapLibre React Native change

Add a fit-specific options type with an optional `maxZoom` field to the existing `fitBounds` options object. Carry it through the native command schema and both platform parsers. Keep its internal field distinct from the map-wide Camera prop; a name such as `fitMaxZoom` would avoid conflating the two meanings. The exact public bounds-stop API for `setStop` needs maintainer agreement.

On Android, calculate the fitted camera and cap its zoom before applying one camera update. The fallback used when `getCameraForLatLngBounds` returns no camera must also honor the cap or report failure; it must never silently perform an uncapped fit. On iOS, adjust the fitted camera's altitude using the zoom conversion facilities already used by the wrapper. Apply the adjustment consistently with the fitted camera's latitude, pitch, and padding, and verify that the requested bounds remain visible.

Estimated scope is 80–180 handwritten production lines across roughly 6–8 files, plus documentation, tests, and an example. Generated native-interface code is excluded. The iOS conversion and Android fallback make this contribution more involved than RNMapbox's forwarding change.

## Why a facade polyfill remains deferred

A JavaScript calculation could support a documented flat Mercator subset using the bounds, viewport dimensions, and padding. Matching the native fit generally would require additional camera mathematics for rotation, pitch, antimeridian crossings, and renderer constraints. That would give the facade ownership of camera-fitting behavior currently delegated to the wrappers.

Fitting first and then zooming out creates two observable movements and changes animation, event, and cancellation behavior. Temporarily lowering the map-wide maximum can affect gestures and concurrent commands and requires reliable restoration. The deferred upstream changes should calculate the capped target before movement and leave global limits untouched.

## Verification and adoption

Each pull request should include typed API coverage, command-forwarding regressions, and representative iOS and Android renderer scenarios. Allow roughly 100–250 additional lines per library for tests and an example, with the final amount depending on existing test facilities. Native builds and validation are likely to take more effort than the cap calculation itself.

- Verify that a tight fit stops at the cap, a wider fit retains its lower calculated zoom, and omission preserves current behavior.
- Cover asymmetric padding, rotation, pitch, antimeridian bounds, and zero-area bounds such as a single point.
- Verify one transition, cancellation behavior, repeated fits, and a later command or gesture that zooms beyond the fit cap.
- Check compatibility with map-wide minimum and maximum zoom and maximum bounds. Agree on behavior for an impossible cap below the map's minimum zoom; rejecting that combination is a proposed policy.
- Validate invalid numeric inputs and the MapLibre Android fallback. Preserve fractional caps and valid zero values.

When this project resumes, review current upstream code and contribution policies, agree on the API, and prepare RNMapbox first, followed by MapLibre React Native. Existing calls must keep their behavior when no cap is supplied. The upstream proposals have not been implemented or accepted, and their runtime behavior is unverified.

After compatible upstream releases exist, update the supported version baseline and one-map-react adapters, replace the rejection regressions with forwarding and behavior coverage, and verify all four native environments. Older supported wrapper versions must continue to reject rather than silently ignore the option. Follow the [testing policy](testing-policy.md#acceptance-timing-and-user-permission): complete implementation, review, and routine checks before requesting permission for scoped native acceptance, identifying the artifact, environments, commands, and expected duration.
