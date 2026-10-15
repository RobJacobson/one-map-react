# one-map-react documentation

one-map-react is being built as a thin facade over RNMapbox, MapLibre React Native, and react-map-gl. Full API coverage, mixed backend selection, and map reuse remain requirements. TF01 established the package and selection foundation. TF02 is complete. The six-environment smoke passed. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7, which keeps latitude at 0 on a cold style cache. TF03's reuse and lifecycle API is implemented, and its renderer smoke passed. TF04's camera, gesture, and interaction API is implemented. Its renderer smoke passed.

## Current direction

Read these documents in order:

1. [Requirements](requirements.md): scope, delegation, ownership, public API, and compatibility rules.
2. [Stage plan](stage-plan.md): TF01–TF10, with a working shared map before expanding coverage.
3. [Testing policy](testing-policy.md): tests selected by changed behavior, runtime permission, and compact evidence.

The [TF01 record](tf01-foundation.md) describes backup verification, removal, and foundation checks. The [TF02 record](tf02-shared-map.md) describes the completed shared map and its architecture trace. The [TF02 handoff](tf02-handoff.md) remains the original stage brief. The [Android camera handoff](tf02-android-camera-handoff.md) records why the Mapbox Android opening camera matches the pinned wrapper. The [TF03 record](tf03-reuse.md) describes the completed reuse and lifecycle stage. The [TF04 record](tf04-camera.md) describes the camera, gesture, and interaction implementation. The TF04 renderer smoke passed. Historical S04 acceptance does not certify this replacement.

## Contributor guidance

The [native fitBounds.maxZoom memo](native-fitbounds-maxzoom-memo.md) records the current native rejection and the deferred proposal for upstream support in RNMapbox and MapLibre React Native.

Keep using the [coding guide](coding-style.md) and [documentation style guide](STYLE_GUIDE.md). The coding guide retains formatting, functional programming, naming, public documentation, and cleanup guidance, with local consolidation allowed where it improves readability. Follow [agent instructions](AGENTS.md) when editing these documents.

## Preserved research

These references retain upstream comparisons, source links, examples, and incompatibility investigations. Their previous facade contracts and implementation claims are historical; reconcile each proposal with the current requirements when implementing its feature.

- [Maps and camera](maps-and-camera.md): camera, gestures, events, coordinates, and refs.
- [Sources and layers](sources-and-layers.md): source families, layer fields, expressions, updates, queries, and feature state.
- [Markers and controls](markers-and-controls.md): interactive content, annotations, dragging, popups, and controls.
- [Capabilities and extensions](capabilities-and-extensions.md): backend facilities, location, offline storage, snapshots, and limitations.
- [API inventory](api-coverage.md): completeness checklist and versioned input records. Old stage assignments and verification cells remain historical.

The documents under `decisions/` preserve upstream investigations and the rationale for the retired implementation. Their execution instructions, commands, source paths, and acceptance policies are superseded. Archived implementation documents and source mentioned there are available only in the local backup; public contributors do not need that backup. [Historical records](../records/README.md) retain provenance, not current stage status.

The old architecture, stage specification, testing plan, implementation status, and operational handoffs have been removed. Do not recreate their frameworks merely to match historical tests or proposals.

The [TF07 UI record](tf07-ui.md) describes markers, popups, controls, map access, source activation, and the accepted R16 physical-interaction scope.

The [TF08 proposal](tf08-proposal.md) reviews the current code and pinned wrappers, proposes location/offline/capture APIs, and defines implementation and verification work. The [TF08 record](tf08-location-offline-capture.md) describes the implemented APIs and completed acceptance under the owner-approved scope, including populated database imports/migration and capture inclusion.

The [native control portal decision](decisions/0007-native-control-portals.md) records the optional native dependency that preserves control children’s React context. It applies to the current implementation; native integration acceptance passed for the recorded R16 scope.
