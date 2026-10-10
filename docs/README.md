# one-map-react documentation

one-map-react is being built as a thin facade over RNMapbox, MapLibre React Native, and react-map-gl. Full API coverage, mixed backend selection, and map reuse remain requirements. TF01 establishes the package and selection foundation; TF02 has not started.

## Current direction

Read these documents in order:

1. [Requirements](requirements.md): scope, delegation, ownership, public API, and compatibility rules.
2. [Stage plan](stage-plan.md): TF01–TF10, with a working shared map before expanding coverage.
3. [Testing policy](testing-policy.md): tests selected by changed behavior, runtime permission, and compact evidence.

The [TF01 record](tf01-foundation.md) describes backup verification, removal, and current checks. The [TF02 handoff](tf02-handoff.md) defines the next stage. Current source contains selection descriptors; it does not yet render maps. Historical S04 acceptance does not certify this replacement.

## Contributor guidance

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
