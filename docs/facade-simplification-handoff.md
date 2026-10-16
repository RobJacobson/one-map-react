# Facade simplification audit handoff

Audit this checkpoint for behavior preservation, then independently assess whether one-map-react can achieve its purpose with less code and fewer concepts. The owner's paramount goal is simplification and consolidation of unnecessary code. A shorter component is useful only when the complete operation becomes easier to trace and maintain.

This is an audit brief for a fresh agent. Produce findings and concrete recommendations before implementing further changes. Use Ponytail. Read [requirements](requirements.md), the [stage plan](stage-plan.md), the [testing policy](testing-policy.md), and [coding style](coding-style.md) first. Treat historical documents and attached examples as evidence; the owner's request and current requirements determine scope.

## Product goal and original concern

one-map-react supplies a consistent React API over react-map-gl's Mapbox and MapLibre entries, RNMapbox, and MapLibre React Native. Applications select an adapter at setup and write shared map components. Native adapters each cover iOS and Android. The library should translate incompatible interfaces and delegate equivalent behavior to the existing wrappers.

The owner's original reference is Ferryjoy at `/Users/rob/code/ferryjoy/ferryjoy-app/`. Its web/native shims translate source props, layer styles, camera input, and events, while Expo selects platform files. Inspect that reference if available. The separate library needs equivalent explicit selection and package isolation without requiring consumers to depend on filename extensions. Ferryjoy illustrates responsibility size; its smaller feature set does not authorize deleting this library's required APIs.

The owner found the architecture needlessly complex, with difficult monolithic functions such as `src/facade/map.tsx`, and questioned widespread `useMemo` and `useCallback` when targeting React 19.2 and newer. The implementation request approved responsibility splits, consolidation, library-side React Compiler support, and removal of redundant memoization while preserving the public API and behavior. It approved one behavior correction: an omitted UI creation option and its equivalent explicit default must compare equally in either direction.

Full API coverage, selected backend facilities, strict unsupported errors, and existing lifecycle guarantees remain requirements. Measure simplification by the amount of code and state needed to explain a public operation. File count, local function length, and hook counts are supporting observations, not acceptance targets.

## Checkpoint and comparison boundaries

The branch containing this note is `codex/simplify-facade-react-compiler`. Audit the commit containing this file and record its full Git identity before making changes. Its parent is the previous committed TF09 state, `ba029a5`. The checkpoint also preserves release-candidate and example-workspace changes that were already uncommitted when this refactor began. Several files contain both sets of work, so the entire parent-to-checkpoint diff is broader than the simplification.

Pre-existing work includes the `0.1.0-rc.2` package metadata and peer-range changes, selected rendering and native camera/style corrections, wrapper patches, release/inventory records, mixed-engine fixtures, and the new Expo/Vite workspace with `packages/example-map`. Root build configuration and dependencies had already changed for that workspace. Review these separately when attributing changes. The compiler addition itself directly declares the already installed compiler at version `1.0.0` and reuses the existing Babel installation; it does not explain unrelated dependency changes visible against the parent.

The compact [refactor evidence](../records/evidence/facade-simplification.json) owns the source, emitted-output and packed-artifact identities, routine outcomes, compiler diagnostics, and proposed acceptance scope. Its API comparison used the starting working tree, including that pre-existing work. It did not establish that all public declarations match `ba029a5`. The temporary baseline is no longer retained, so independently inspect public changes and state the limits of any comparison you can reproduce.

The local frozen archive named in that record may survive under `/private/tmp`; it is not committed or published. Verify its identity before using it. If missing, rebuild and pack a new artifact and record its actual identity. Historical release and example records apply to their recorded artifacts. Their earlier acceptance results do not certify this refactor, the compiler output, or native coexistence in the new example app. The evidence's `commit: not_created` records the earlier verification checkpoint before the owner subsequently requested this commit.

The staged whitespace check reports whitespace in the pre-existing RNMapbox patch and two retained evidence patches, including unified-diff context lines. Their original bytes are preserved. The staged check passes when those patch files are excluded; this qualification differs from the earlier tracked-only whitespace check in the evidence.

## Implementation map to verify

The following changes describe the current implementation and give review entry points. They are claims to test, rather than an endorsement of the chosen abstractions.

- [Shared Map](../packages/one-map-react/src/facade/map.tsx) selects the adapter, validates common map inputs, attaches the imperative ref, registers named maps, constructs the map-access session, and forwards common notifications. Its local attachment hook owns the retained deferred ref. The main file is smaller, but some complexity moved into the interaction and native presentation modules.
- [Interaction ownership](../packages/one-map-react/src/facade/use-map-interactions.ts) collects source registration, hit queries, propagation, subscriptions, error reporting, and late-result guards. Inspect every caller in sources, adapters, and controls. Confirm this creates one understandable owner and does not become another monolithic coordinator.
- [Map access context](../packages/one-map-react/src/facade/map-context.tsx) holds the map reference, readiness, low-frequency camera configuration, and interaction operations. Movement observations no longer live in this context. Source and map-access consumers should remain unaffected by camera movement.
- [Native presentation](../packages/one-map-react/src/adapters/shared/native-map-presentation.tsx) wraps each built-in native adapter's map with shared ownership for layout, ornaments, overlay placement, gesture locks, and location-follow information. A separate camera context observes the existing movement subscription and supplies native camera-dependent controls. Marker projection still uses movement subscriptions. Check whether the wrapper and contexts are the smallest useful arrangement.
- [Native UI](../packages/one-map-react/src/adapters/shared/native-ui.tsx), [marker overlays](../packages/one-map-react/src/adapters/shared/native-marker-overlay.tsx), [ornament positioning](../packages/one-map-react/src/adapters/shared/native-ornament-position.ts), and [geolocation](../packages/one-map-react/src/facade/use-geolocation-control.ts) consume the revised contexts. Internal test fixtures changed with them. The exported [Adapter interface](../packages/one-map-react/src/contracts/adapter.ts) remains the custom-adapter boundary.
- [Facade UI](../packages/one-map-react/src/facade/ui.tsx) delegates creation checks to adapter implementations. [Web UI](../packages/one-map-react/src/adapters/web/ui.tsx) retains selected SDK checks; native UI compares effective creation values using existing defaults. Shared frozen-value/comparison helpers remain where lifecycle ownership requires them.
- [Web method forwarding](../packages/one-map-react/src/adapters/web/method-forwarders.ts) supplies a small typed helper and an explicit list for equivalent delegates in the two selected web entries. Each invocation resolves the current attached wrapper handle and preserves its receiver. Engine-specific operations stay in their selected implementations. Challenge the helper if direct forwarding would be clearer or its type assertions conceal a mismatch.
- Resource identity in map setup, deferred refs, native registries, and capture gates uses lazy state or refs. Performance-only caches were removed from compiler-eligible paths, including derived user-location data and web map calculations. Explicit stabilization remains for context values and skipped lifecycle/subscription code. Resource ownership must not rely on React retaining a memo cache.

Trace actual imports and calls rather than assuming these descriptions establish isolation. In particular, verify that shared facade imports cannot pull in native peers and that existing custom adapters still work without adopting internal native presentation contexts.

## Audit A: behavior and compiler correctness

Review the changed production paths together with their callers and fixtures. Focus on observable behavior and resource ownership. Preserve useful upstream failures; a successful empty query is not a substitute for a failed operation.

1. Trace map attachment, deferred calls before attachment and after detachment, named registration, callback replacement, Strict Mode setup/cleanup, and remount. Confirm registries, proxies, subscriptions, and pending capture ownership remain stable across ordinary rerenders and do not leak through suspended renders.
2. Trace web and native clicks from wrapper event to source callback and map callback. Preserve source activation independently of `interactiveLayerIds`, topmost-source selection, `stopPropagation`, exactly one map notification, genuine query failures, source replacement, and suppression or rejection of late asynchronous work. Strict re-querying remains where upstream pointer hits cannot preserve failure reporting.
3. Trace native marker drag and controls through the portal host and their original React ancestry. Check overlay stacking and measured placement, ornament offsets, gesture locking, release and unmount restoration, controlled-camera updates, and location-follow conflicts. Check effects against both native wrappers, not just the internal fixture context.
4. Verify that movement does not invalidate map-access/source consumers or native presentation consumers unnecessarily. Native camera controls must still observe camera changes and controlled state; marker projection must retain the existing movement subscription path. Distinguish intended observations from avoidable context churn.
5. Check omission-to-default and default-to-omission updates for each UI implementation. Freeze content-dependent marker defaults once. Preserve genuine creation-change errors requiring remount, native scale placement, and explicit unsupported requests such as native popup focus. Do not apply a common default where the backends intentionally differ.
6. Check every consolidated web method's declared and runtime signature, overloads, return shape, synchronous errors, receiver, and current-handle lookup. Exercise detachment and handle replacement. Ensure the list contains only equivalent operations and does not erase selected SDK typing.
7. Inspect package exports and declarations, optional peer boundaries, both conditional aliases and both mixed engine choices. Separate the refactor's compatibility claim from public changes already present in the starting tree.

Compiler review begins at [the build plugin](../scripts/react-compiler.mjs), [library pack configuration](../packages/one-map-react/vite.config.ts), and [compiler assertions](../scripts/react-compiler.test.mjs). Confirm the plugin receives original library TypeScript/TSX before syntax lowering, targets React `"19"`, preserves emitted ESM layout and declarations, and stays local to the library build. Consumers should receive compiled output using React's `react/compiler-runtime` without compiler configuration or an extra runtime package.

Inspect diagnostics per function and emitted code for the actual target component. A compiler runtime import from an unrelated helper does not establish that a component compiled. The recorded successful targets are shared `Map`, `WebMap`, `UserLocation`, `NativePresentationProvider`, and `NativeCameraProvider`; other functions in their files can still be skipped. The evidence lists 17 skip diagnostics, which is not a count of distinct skipped functions. Confirm skips remain visible and that compiler exceptions are not silently swallowed.

Keep `useActiveCallback`, frozen creation values, unmount guards, and stabilization required by skipped subscriptions or imperative handles unless their replacement has equal semantics. Check lazy-state initializers for captured props that could become stale. Do not rewrite delicate lifecycle code solely to satisfy the compiler. Audit whether the remaining manual caches and callback wrappers have a concrete purpose, and whether any removed one was semantically required.

The [compiled web configuration](../vite.compiled.config.ts) and [compiled native configuration](../jest.compiled.config.cjs) are intended to run representative library regressions against emitted modules. Verify that their resolution rules actually reach `dist`, mocks retain their intended boundary, and source imports cannot accidentally make a compiled test pass. The compiled suite is smaller than the full source suite; report coverage limits.

## Audit B: independent simplification review

Form an independent architecture judgment from the original product goal and [thin-facade requirements](requirements.md) before adopting this implementation's responsibility boundaries. Identify what remains needlessly complex, including any complexity this refactor introduced. A passing suite does not establish that an abstraction earns its maintenance cost.

Trace representative public operations through selection, facade, adapter, wrapper, and renderer boundary: render a source/layer, move the camera, handle a source click, render and drag a marker, show a popup/control, and perform a selected backend query. For each extra owner, cache, registry, validation pass, or conversion, identify the public behavior and actual wrapper incompatibility that requires it. Prefer deleting an unnecessary owner, forwarding an existing API, or merging equivalent code over introducing a general replacement mechanism.

Review the whole library, including native map/ref implementations, web selected entries, source/layer translation, UI, camera, location, capture/offline services, contracts, and setup/context plumbing. Check duplicated responsibilities across facade and adapter boundaries, generic helpers with only one useful case, repeated validation, catch-and-rethrow scaffolding, parallel lifecycle tracking, broad contexts, and type conversions that obscure the underlying calls. Keep genuinely different backend ordering and semantics local when sharing would require a matrix of flags or callbacks.

Assess whether the interaction module and native presentation wrapper reduced the number of things a contributor must understand. A relocation of a large function, another wrapper layer, or a collection of stable functions stored in state may warrant a simpler alternative. Also inspect whether tests, inventory generation, evidence retention, and build configuration impose unnecessary maintenance or storage cost. Preserve historical evidence and required coverage; avoid rebuilding the retired general framework to simplify today's code.

For each recommendation, describe the smaller design, the code it would remove or consolidate, the behavior that must survive, and the focused evidence needed to make the change. Distinguish immediately safe deletion from a change requiring upstream investigation or separately authorized renderer checks. Keep public API changes, feature removal, dependency upgrades, and consumer compiler configuration outside this refactor's scope.

## Verification and acceptance boundary

The [refactor evidence](../records/evidence/facade-simplification.json) records passing source and mocked-native suites, compiled-output suites, formatting/lint, documentation/inventory, TypeScript projects, library builds, packed-package selection, peer checks, and example-resolution checks. Those are previous results for the recorded identities. Reproduce checks where needed to verify a finding or an altered artifact, and report what you personally ran. Inspect aggregate commands before execution, including after any edits.

The existing routine entry points are:

```sh
bun run validate
bun run test:compiled
bun run typecheck:apps
```

Frozen-archive routine checks accept an explicit path and avoid silently substituting a fresh build:

```sh
bun scripts/test-package.mjs --archive /path/to/verified-package.tgz
bun scripts/test-peers.mjs --archive /path/to/verified-package.tgz
bun scripts/test-example-resolution.mjs --archive /path/to/verified-package.tgz
```

These commands are provided for review and routine verification. Mocked components, web bundling, declaration checks, and static native resolution do not establish renderer behavior, native SDK linking, Metro transport, portal interaction, or gesture correctness. Prior routine runs reported fixture `act` warnings and existing tool warnings; the evidence preserves their scope. Diagnose failures instead of suppressing them to obtain a pass.

No acceptance execution is authorized by this handoff or the request to commit. Do not start browser renderer acceptance, mixed Metro acceptance, native generation/build/install for acceptance, or canonical native flows. The [testing policy](testing-policy.md#acceptance-timing-and-user-permission) requires completed review/routine checks followed by explicit permission for the frozen artifact, exact commands, environments, expected duration, and retry scope. The evidence contains a proposed six-environment regression scope and estimated duration; it is a proposal, not permission.

The new Expo/Vite workspace has its own [native coexistence and scenario migration gates](examples-workspace.md). Keep those separate from regression acceptance of this library artifact. Preserve application data, serialize shared native resources when execution is eventually authorized, and retain compact outcomes rather than large generated consumers, binaries, or raw logs.

## Audit deliverable

Lead with findings ordered by severity, with file/line evidence, a concrete failure or maintenance cost, and the smallest proposed correction. Keep correctness findings separate from simplification opportunities. Do not present a hypothetical risk as a demonstrated bug or call an undocumented wrapper omission an SDK limitation.

Report whether the refactor preserves the intended API/behavior within the evidence available, whether compiler integration reaches the claimed components, and whether the architecture is simpler overall. Explain remaining compiler skips and runtime uncertainty. Follow with a short prioritized list of further consolidation opportunities, including useful deletions, and identify which need behavior investigation before implementation. State explicitly if no actionable findings are established.
