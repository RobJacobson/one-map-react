# Instructions for one-map-react contributors and agents

What to read and when:
- **Before implementation:** the [library boundary](docs/architecture.md) and [testing](docs/testing.md).
- **First-party code, tests, scripts, and examples:** the [shared coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md). Bring affected existing code into compliance; generated and upstream code keep their required conventions.
- **New apps or requested migrations:** the [default architecture](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/default-architecture.md).
- **Markdown:** the [shared documentation style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/documentation-style.md) and the `technical-writing` skill. Keep `FILES.md` through depth 3 (root = 0). Describe the current implementation. Use the [mapping names](#mapping-names) below.

**Renderer runs.** Ask before a real-renderer browser suite, a Metro session that talks to a map SDK, a native build or installation, or the same run launched through another script. Finish implementation and the matching routine checks first. Implementing a feature does not grant that permission. If you did not run the renderer, report that check as unverified.

Routine formatting, documentation, type, unit, mocked adapter/component, library build, and package/selection checks may run during development. Inspect an aggregate command so it does not launch a browser, Metro, or a native build.

On a requested commit, use a one-line Conventional Commit subject, a blank line, and a bullet-point summary of the major changes.

## Mapping names

Use **backend** for the selected implementation and **platform** for web, iOS, or Android. Name a specific SDK when describing renderer behavior.

Use these names: one-map-react, RNMapbox (`@rnmapbox/maps`), MapLibre React Native (`@maplibre/maplibre-react-native`), react-map-gl, Mapbox GL JS, and MapLibre GL JS. Preserve upstream API spelling.

For a nontrivial difference, use a four-column table in this order: RNMapbox, MapLibre React Native, react-map-gl, proposed one-map-react API. The last column states whether the difference is a rename, a data conversion, a behavioral adaptation, a fallback, or an unsupported feature. Link the inspected source or official documentation beside each material claim.

A missing React wrapper component does not prove the renderer lacks the capability.

## Audit and fix completion

An audit authorizes investigation and a report. Change code only when a fix is requested. Preserve the full intended behavior with the smallest change that does so.

- Map workflows, state transitions, and resource ownership across callers and adapters. Check overlap, stale results, replacement, cancellation, failure, and teardown against the contract.
- Report concrete correctness and contract failures. Do not fill a finding quota.
- Fix the root cause on every affected path and search for the same pattern elsewhere. Add a regression that fails before the fix and passes after, review new failure modes, and run applicable routine checks.
- Before claiming completion, account for every finding and path: fixed and verified (name the checks), implemented but unverified, still open, and outside scope. State any gap between the request and the inspected or tested behavior. Passing checks cover only the behavior they exercise.

A check you did not run stays unverified.
