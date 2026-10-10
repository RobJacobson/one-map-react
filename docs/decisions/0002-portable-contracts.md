# Portable contract implementation

**Historical decision.** This record describes the previous implementation. Preserve its upstream evidence and observed failures, but assess its design choices against the [thin-facade requirements](../requirements.md). Its instructions and acceptance results do not govern or certify the replacement.

**Agreed design:** These are accepted implementation decisions for S02 and S03. Runtime behavior remains unverified until the owning feature stages provide evidence. Existing wrapper comparisons and equivalent examples remain in [maps and camera](../maps-and-camera.md), [sources and layers](../sources-and-layers.md), [markers and controls](../markers-and-controls.md), and [capabilities and extensions](../capabilities-and-extensions.md).

## Public values and ownership

The common entry exports one-map-react-owned longitude/latitude tuples, screen-point tuples, southwest/northeast bounds, full padding, camera view state, feature identifiers, feature arrays, sources, layers, normalized events, diagnostics, errors, map refs, the provider, and useMap. It does not import backend packages. Backend SDK classes and wrapper-specific setup remain in the selected adapter entry.

OneMapProvider chooses an adapter and owns a named-map registry. Every Map has a stable nonempty ID unique within its provider. useMap(id) resolves that ID; useMap() resolves the enclosing map. Access outside the appropriate context, a missing map ID, and duplicate IDs have explicit errors. Ref registration and cleanup preserve instance ownership so stale cleanup cannot unregister a newer instance.

Map owns initialization, its internal native camera, readiness, event subscriptions, and disposal. Commands before readiness reject with MapNotReadyError. Camera promises acknowledge validation and dispatch. Feature-state values use stable string IDs and JSON values excluding null, undefined, and non-finite numbers. Source/layer identities stay fixed until remount, and the adapter records source refs for source-scoped operations.

## Validation and failures

Validate finite coordinates, padding, duration, camera limits, bounds order, query geometry, identifiers, and JSON state before dispatch. Geographic bounds may cross the antimeridian; preserve that intent during conversion. Screen rectangles require top-left then bottom-right ordering. Configuration errors follow React's error path; asynchronous operations reject; backend event errors reach onError once with a useful cause.

UnsupportedFeatureError describes a substantiated unavailable contract. InvalidMapOptionError describes malformed or contradictory arguments. MapNotReadyError describes required map/source readiness. MapBackendError preserves an operational failure. Pending adapter implementation is recorded separately and must not be reclassified as an SDK limitation.

## Capabilities and diagnostics

Keep narrow capability flags and a typed supports(feature, options) query. The same feature-specific validation drives option support and actual operation checks. Permission denial, missing resources, and readiness do not change backend capability. Capability verification records remain separate from implementation availability.

Unsupported requests fail strictly. Only named documented presentation degradations may be explicitly allowed; no global ignore switch exists. Repeated diagnostics deduplicate by provider, map, feature, operation, and consequence. Development and production follow the same policy. Never silently discard a query filter, camera constraint, or interaction request.

## Packaging

Publish ECMAScript modules (ESM), declarations, and source maps while preserving adapter modules. React is required and shared; React DOM, React Native, and backend packages are optional peers with exact initial supported baselines. Conditional aliases choose browser before react-native, then the default web target; selected adapter imports remain isolated. CommonJS facade builds and server-rendered maps are outside the initial contract. Explicit Node-only Metro setup helpers have CommonJS entries documented in [the selection decision](0003-adapter-selection.md). The common entry still imports safely without a DOM or backend.
