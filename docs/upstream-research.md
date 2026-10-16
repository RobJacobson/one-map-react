# Upstream research notes

These notes preserve useful findings and citations from the retired inventory snapshots. They describe the inspected upstream versions, not current facade coverage or runtime certification. The [API coverage checklist](api-coverage.md) is the sole coverage record. The [support matrix](../records/support-matrix.json) owns current supported versions and patches; the upstream declarations own individual API signatures and defaults.

## Research basis

The baseline research was recorded on October 8, 2026. Later endpoint research covered RNMapbox 10.3.8, Mapbox GL JS 3.33.0 and MapLibre GL JS 6.14.0. The citations below retain those versions instead of pointing to a moving default branch.

| Inspected source | Version and primary citation | Use |
| --- | --- | --- |
| react-map-gl | [8.1.3 source](https://github.com/visgl/react-map-gl/tree/3df834290bdecf4f5c9b90d7c117d95af12c1f0a) | Trace component props, wrapper ownership and actual ref forwarding. |
| Mapbox GL JS | [3.32.0 release tag](https://github.com/mapbox/mapbox-gl-js/tree/v3.32.0) | Check the baseline renderer declarations and style schema. |
| MapLibre GL JS | [6.13.0 source](https://github.com/maplibre/maplibre-gl-js/tree/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d) and [style-spec 26.4.4](https://github.com/maplibre/maplibre-style-spec/tree/v26.4.4) | Check renderer APIs against the schema dependency recorded in that release's lockfile. |
| RNMapbox | [10.3.7 source](https://github.com/rnmapbox/maps/tree/0f50e8164c1aefe45de9ed9cde310f310076a310) | Check the native wrapper export graph, generated styles, bridge and build configuration. |
| MapLibre React Native | [11.5.0 package](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/package.json) and [style-spec 26.2.1](https://github.com/maplibre/maplibre-style-spec/blob/v26.2.1/src/reference/v8.json) | Distinguish wrapper declarations from actual native SDK parser support. |
| React Native host types | [0.87.1 source](https://github.com/facebook/react-native/tree/v0.87.1/packages/react-native) | Resolve inherited ViewProps, events and native handles; the baseline [host audit](../records/evidence/native-generated-host-inventory.json) records extraction details. |

The original Mapbox commit download returned HTTP 404. Researchers inspected the public 3.32.0 tag and npm declarations instead. The supplied commit in the [historical baseline](../records/version-baseline.json) must be confirmed before substituting commit citations for the release tag.

The historical web host extraction used @types/react and @types/react-dom 19.3.0 with csstype 3.2.3. Type-package versions describe the extraction, not React runtime compatibility. The [React host decision](decisions/0001-baselines-and-ownership.md#compatible-react-host-baseline) records the separate runtime reconciliation.

## Interpreting declarations

- Inherited host fields, union alternatives, style-schema vocabulary and overloaded signatures inflated the retired field count. They do not establish separate renderer operations or independent compatibility guarantees.
- A declaration can expose a field that the wrapper never copies at runtime. Check actual forwarding and ownership before treating a type member as callable or mutable through a selected ref.
- Recursive GeoJSON, ReactNode and opaque animated values belong to their public value/handle contracts. JavaScript primitive and array prototype methods are not additional mapping APIs.
- Native React lifecycle methods, bridge queues and generated base aliases require a reachability review. An underscore or private annotation alone does not prove that an observable application behavior can be discarded.
- A missing wrapper prop is evidence about the wrapper, not proof that the underlying SDK lacks a feature. Native implementation, default/reset behavior, callback timing and renderer observations require separate investigation.
- DOM/native host semantics, hardware probes, build settings and schema transport need different evidence. Passing types or forwarding tests does not certify accessibility, physical sensors, GPU behavior or every expression operator.

The existing task references preserve broader comparisons and examples: [maps and camera](maps-and-camera.md), [sources and layers](sources-and-layers.md), [markers and controls](markers-and-controls.md), and [capabilities and services](capabilities-and-extensions.md). Their historical proposals must be read with their status banners.

## Web declarations

[Mapbox createRef](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/create-ref.ts#L30) and [MapLibre createRef](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/create-ref.ts#L28) determine which SDK functions are actually available through a wrapper ref. Renderer instance fields and React-owned setters cannot be assumed to pass through merely because the declarations mention them.

Borrowed source, control and gesture-handler objects retain their SDK ownership and lifetime. Inspect their public application operations separately from worker dispatch, tile/GPU buffers, DOM event arbitration and computed projection state. Raw getMap access does not establish facade coverage for subsequent arbitrary operations.

The baseline /mapbox-legacy entry described Mapbox GL JS 1/2 compatibility. Its historical mapping through the selected Mapbox 3 adapter was a project version boundary, not proof of legacy renderer support or a native SDK limitation. Refer to the pinned [wrapper source](https://github.com/visgl/react-map-gl/tree/3df834290bdecf4f5c9b90d7c117d95af12c1f0a) when revisiting that boundary.

## RNMapbox native findings

These findings describe RNMapbox 10.3.7 unless another version is named. They preserve upstream cautions; current facade handling and remaining work belong to the checklist.

### Native setup

The pinned [podspec](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/rnmapbox-maps.podspec) required New Architecture and Mapbox Maps SDK v11, rejecting old architecture and SDK v10. The wrapper requested iOS SDK `~> 11.23.1`; Android's default was 11.23.1. A requested range does not identify the resolved native build.

The [config plugin](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/plugin/src/withMapbox.ts) deprecated RNMapboxMapsDownloadToken and used unauthenticated Maven downloads unless given a legacy token. SDK download credentials, public runtime access tokens and tile-provider credentials have different purposes. Plugin, Podfile and Gradle settings are application configuration, not React component props.

### Interaction, styles, and capture

| Recorded finding | Primary source and consequence |
| --- | --- |
| MarkerView documented live React Native child press feedback on both platforms. Android stopGesturePropagation defaults false and contains child pan/pinch gestures when enabled; iOS already coexists with marker content. | [MarkerView](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MarkerView.tsx). No declared draggable prop does not prove that live dragging is impossible. |
| Camera.triggerKey was documented as unimplemented; onUserTrackingModeChange was deprecated in favor of Viewport.onStatusChanged. | [Camera](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Camera.tsx). Camera prop forwarding does not prove controlled gesture acceptance, rejection or clamping. |
| RasterArraySource and RasterParticleLayer were experimental and required native SDK 11.4.0 or later. Raster-array sourceBounds and tileSize were direct Android options; iOS could derive them from TileJSON. | [RasterArraySource](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/RasterArraySource.tsx) and [RasterParticleLayer](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/RasterParticleLayer.tsx). Investigate TileJSON composition before classifying an option as unavailable. |
| The wrapper Style component documented sources/layers and ignored other style roots. | [Style](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Style.tsx). This omission does not constrain full SDK style documents. |
| fillExtrusionFloodLightGroundRadius was evaluated during tile initialization, could trigger tile reloads, required lights and deprecated feature-state styling. Nonzero fillExtrusionLineWidth enabled experimental wall rendering with other extrusion limitations. | [Generated style declarations](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/utils/MapboxStyles.ts). A transported property name does not certify update timing or combinations. |
| lineCrossSlope accepted 0 or 1, required lineZOffset and lacked vertical caps/round joins. lineOcclusionOpacity did not support data-driven lineOpacity; lineZOffset lacked globe support and required lineElevationReference. | [Generated style declarations](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/utils/MapboxStyles.ts). Preserve these constraints when investigating elevated-line behavior. |
| Model color/mix expressions depending on measureLight were restricted for GeoJSON/vector-tile model sources. Model opacity excluded data-driven expressions other than zoom; modelScale restricted zoom-dependent expressions for those sources. | [Generated style declarations](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/utils/MapboxStyles.ts). modelColorMixIntensity defaulted to 0, so a tint alone had no effect. |
| Formatted text ignored SDF images. SymbolLayer children were deprecated in favor of Image; Terrain.exaggeration was deprecated in favor of the style field. | [Style declarations](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/utils/MapboxStyles.ts), [SymbolLayer](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/SymbolLayer.tsx), [Terrain](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Terrain.tsx). Retain the supported composition rather than relying on deprecated conveniences. |
| Pinch/rotate deceleration and zoomAnimationAmount were Android-specific gesture settings. surfaceView and requestDisallowInterceptTouchEvent were Android only; compassImage documentation referred to the older iOS v10 implementation. | [MapView](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx). Old platform annotations need native source review before becoming a support claim. |
| MapView.setCamera, contentInset and onDidFailLoadingMap had replacements in Camera.setCamera, Camera padding and onMapLoadingError. mapViewImpl/_nativeImpl were private experimental custom-view paths. | [MapView](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx). Distinguish application operations from implementation injection. |
| UserLocation androidRenderMode was Android only; requestsAlwaysUse was iOS only; native renderMode was deprecated in favor of LocationPuck. | [UserLocation](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/UserLocation.tsx). Background permission and physical-sensor behavior need their own evidence. |
| Offline/cache declarations retained pre-v10 deprecation text, including clearAmbientCache and invalidateAmbientCache. | [Offline manager](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/offline/offlineManager.ts). A stale declaration is not evidence of successful v11 behavior; owner exclusions live only in the checklist/requirements. |
| Independent snapshot pitch, heading and zoom depended on centerCoordinate. Bounds supplied another camera route; withLogo was Android specific, and writeToDisk selected temporary file output. | [Snapshot manager](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/snapshot/snapshotManager.ts). Independent images do not inherit mounted React children. |

### Ref reachability and legacy events

The [ref reachability audit](../records/evidence/rnmapbox-map-ref-reachability.json) and [decisions](../records/evidence/rnmapbox-map-ref-decisions.json) distinguish public application effects from generated aliases, React scheduling and bridge queues. Callback-key unions and serialized NativeProps do not create independent renderer operations. Inherited optional React lifecycle declarations do not establish callable functions on an actual instance.

The pinned [MapView source](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx) exposed debounce clear/flush operations that changed legacy callback timing. Its deprecation flags affected observable logging, and its logger property referenced the shared Logger singleton. These effects must not be discarded merely by calling the surrounding storage internal.

Legacy region state updated only with positive debounce; zero debounce bypassed those state writes, and runtime region GeoJSON differed from the null-only public type. The handler field isAnimatingFromUserInteraction had no producer of that exact key in the inspected Android/iOS package. That does not prove the SDK lacks equivalent interaction information.

The [React Native types](https://github.com/facebook/react-native/blob/v0.87.1/types/public/ReactNativeTypes.d.ts) deprecated NativeMethods in favor of HostInstance and deprecated numeric-node-handle measureLayout usage. Composite components need not expose the direct native-view methods that a host instance provides.

## MapLibre native findings

The [Android Gradle configuration](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/android/build.gradle) and [properties](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/android/gradle.properties) selected OpenGL SDK 13.6.1, annotation/scalebar plugins 3.0.2, Turf 6.0.1 and OkHttp 4.12.0. Downloads used public Maven Central/google repositories. Source minSdk 24 took precedence over getting-started text saying 23; compileSdk 35, targetSdk 34 and Kotlin 2.0.21 were defaults.

The pinned [podspec](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/MapLibreReactNative.podspec) used exact SPM MapLibre 6.31.0 from the [public native distribution](https://github.com/maplibre/maplibre-gl-native-distribution), with MLRN.post_install injecting the package dependency. Custom repositories and tile providers can have independent authentication. MapLibre setup did not require a Mapbox token.

The [package metadata](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/package.json) required New Architecture with peer floors React Native 0.80.0 and React 19.1.0. Those floors did not certify arbitrary host combinations, SDK overrides or linked binaries.

| Recorded finding | Primary source and consequence |
| --- | --- |
| Android touchZoom=false also disabled doubleTapZoom/doubleTapHoldZoom. Frame scheduling was preferred on iOS and maximum on Android. | [Map](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx#L552). Similar prop names do not establish identical gesture or timing behavior. |
| Android scaleBarPosition supported top-left only; androidView selected Android surface/texture presentation. | [Map](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx#L552). Distinguish selected wrapper behavior from common UI composition. |
| Live Marker.selected was iOS only. Android ViewAnnotation children were bitmaps; iOS Callout required title. | [Marker](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/marker/Marker.tsx#L112), [ViewAnnotation](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/view-annotation/ViewAnnotation.tsx#L171), [Callout](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/callout/Callout.tsx#L87). These are interaction differences, not just prop renames. |
| NativeUserLocation course semantics differed across platforms. | [NativeUserLocation](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/user-location/NativeUserLocation.tsx#L29). Direction/orientation requires platform-specific interpretation. |
| GeoJSON feature-state serialization dropped null object keys but retained null array elements. Missing state returned null; removal applied on the next rendered frame. | [GeoJSONSource](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/geojson-source/GeoJSONSource.tsx#L271). Query timing, transport and common state behavior need separate review. |
| Vector queries covered loaded tiles in the viewport, while GeoJSON getData described source data. | [Source implementations](https://github.com/maplibre/maplibre-react-native/tree/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources). These query scopes must not be treated as interchangeable. |
| The default Android location engine was documented as unsuitable for emulator location; the google engine changed provider/build dependencies. Permissions requested Android fine/coarse or iOS when-in-use. | [LocationManager](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/location/LocationManager.ts#L173). Mounting a map must not silently start acquisition. |

Style-schema 26.2.1 declarations were broader than the pinned native SDK's parser and generated property registries. The [native style source investigation](../records/evidence/tf10-native-style-sources.json) retains exact-tag file identities and findings. Use that primary investigation and the checklist's explicit exceptions when evaluating roots, expressions, font builds and properties; schema presence alone is not native support.

## Later endpoint declarations

These five groups account for the 20 declaration names added after the baseline extraction. They retain useful API names and exact-version citations without reproducing a field ledger or coverage statuses. The RNMapbox function and callback shapes below were checked against the installed 10.3.8 source during this documentation change.

| Version and API group | Declaration finding and primary citation |
| --- | --- |
| RNMapbox 10.3.8 LocationPuck.model | model contains uri, scale, rotation and opacity. uri accepts a URL or numeric asset reference; scale/rotation use expression-capable number arrays. [LocationPuck source](https://unpkg.com/@rnmapbox/maps@10.3.8/src/components/LocationPuck.tsx). |
| RNMapbox 10.3.8 MapLoadingErrorPayload | error is a string; optional type distinguishes style/sprite/source/glyphs/tile, with optional tileId/sourceId. onMapLoadingError receives an optional payload and may fire alongside successful load callbacks. [MapView source](https://unpkg.com/@rnmapbox/maps@10.3.8/src/components/MapView.tsx). |
| RNMapbox 10.3.8 language functions | normalizeLanguageTag takes and returns a string; setLanguage accepts a string, string array or null and returns Promise<void>. [Normalizer](https://unpkg.com/@rnmapbox/maps@10.3.8/src/utils/normalizeLanguageTag.ts) and [module declaration](https://unpkg.com/@rnmapbox/maps@10.3.8/src/RNMBXModule.ts). |
| Mapbox GL JS 3.33.0 control placement | AddControlOptions includes position/offset; ControlOffset contains x/y. [Published declarations](https://unpkg.com/mapbox-gl@3.33.0/dist/mapbox-gl.d.ts). |
| MapLibre GL JS 6.14.0 globalState | MapOptions and StyleOptions gained globalState. [Published declarations](https://unpkg.com/maplibre-gl@6.14.0/dist/maplibre-gl.d.ts). Constructor state and style replacement have different lifetimes; facade handling belongs to the checklist. |

## Historical recovery

The complete raw extractions, generated signatures, original IDs and old stage/status cells remain recoverable from the [last snapshot commit](https://github.com/RobJacobson/one-map-react/tree/241816e73eb12a38a4b4b729757986500eb2a950/records/inventory-inputs). They are not maintained copies in the working tree. This digest intentionally omits repeated declarations, obsolete stage assignments and copied coverage statuses; consult the cited upstream sources for API details.

Historical evidence retains the meaning and artifact identities of its original checkpoint. The [snapshot retirement record](../records/evidence/inventory-research-retirement.md) records this documentation change and its checks. Neither that record nor this research digest tracks feature completion.
