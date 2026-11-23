# one-map-react documentation

Acceptance is deferred until release preparation or an explicit owner request. The [current handoff](revised-api-acceptance-plan.md#current-handoff) links the compact historical checkpoint and remaining release verification. Historical results do not certify the working checkout.

## Next breaking release

Use the [package guide](../packages/one-map-react/README.md) to select stock react-map-gl on web and a native compatibility entry on iOS or Android. The [native compatibility design](native-compatibility-design.md) explains the four stages, their verification and the ownership of camera, marker and query translations.

## Four-backend facade baseline

Read these documents in order:

1. [Testing policy](testing-policy.md): tests selected by changed behavior, runtime permission, and compact evidence.
2. [API coverage checklist](api-coverage.md): current grouped routes, pending next-release dispositions and owners, meaningful exceptions, and open gates.

The [revised shared API and migration proposal](revised-api-proposal.md) records the four-backend design with shared rendering/queries, application-owned services, explicit native exclusions, and before/after consumer changes. Its After examples target the future incompatible release; all four working selected refs expose getWrapperMap. Selected method mirrors are removed in the U06 working implementation; the audit and bounded routine verification are recorded. Other removals remain pending. The earlier [camera, marker, feature-state, and control contract review](https://github.com/RobJacobson/one-map-react/blob/1b8d683f7cf6021aefba832d457c5d4b486fc756/docs/contract-review.md) explains the broader feature-preserving alternative and underlying mechanisms.

The [patch and peer decision report](revised-api-patch-peer-review.md) lists the repairs required on the current native wrappers and preserves the earlier U23 assessment.

## Contributor guidance

The [example workspace checkpoint](examples-workspace.md) describes the new Expo/Vite workspace, development commands, acceptance-scenario migration inventory, and the pending native coexistence gate.

The [native fitBounds.maxZoom memo](native-fitbounds-maxzoom-memo.md) records the current native rejection and the deferred proposal for upstream support in RNMapbox and MapLibre React Native.

Follow the [shared coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md) and [shared documentation style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/documentation-style.md). The [mapping documentation conventions](STYLE_GUIDE.md) add project-specific terminology, comparison, and evidence rules. Follow [agent instructions](AGENTS.md) when editing these documents.

## Preserved research

These references retain upstream comparisons, source links, examples, and incompatibility investigations. Their previous facade contracts and implementation claims are historical; reconcile each proposal with the [native compatibility design](native-compatibility-design.md) when implementing its feature.

- [Maps and camera](maps-and-camera.md): camera, gestures, events, coordinates, and refs.
- [Sources and layers](sources-and-layers.md): source families, layer fields, expressions, updates, queries, and feature state.
- [Markers and controls](markers-and-controls.md): interactive content, annotations, dragging, popups, and controls.
- [Capabilities and extensions](capabilities-and-extensions.md): backend facilities, location, offline storage, snapshots, and limitations.
- [Upstream research notes](upstream-research.md): versioned primary-source citations, declaration caveats, platform differences and historical findings. Current coverage lives only in the grouped checklist above.

Archived implementation documents and source are available only in the local backup; public contributors do not need that backup. [Historical records](../records/README.md) retain provenance, not current stage status.

The old architecture, stage specification, testing plan, implementation status, and operational handoffs have been removed. Do not recreate their frameworks merely to match historical tests or proposals.

The [package guide](../packages/one-map-react/README.md#native-patches-and-linking) records the react-native-teleport dependency that keeps native marker children in the React tree. Common control layout is removed in the working migration. Native integration acceptance passed for the recorded R16 scope only.
