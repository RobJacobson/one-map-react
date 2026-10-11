# Thin facade requirements

**Agreed direction; TF01 foundation implemented:** one-map-react provides one React mapping API over RNMapbox, MapLibre React Native, and the Mapbox and MapLibre entries of react-map-gl. The public API generally follows react-map-gl. Applications choose their backend at setup and use shared map code without maintaining their own translation components.

This document defines the replacement architecture. It supersedes conflicting requirements in the historical architecture, implementation specification, API proposals, decisions, and acceptance records. The [stage plan](stage-plan.md) defines delivery; the [testing policy](testing-policy.md) defines verification. The previous implementation has been retired. TF01 supplies selection; TF02 implements the first shared map for one GeoJSON line, `flyTo`, and `onMove`. Remaining APIs begin in later stages.

## Purpose and scope

Preserve full coverage of the public APIs of the supported wrapper versions, including forwarded renderer APIs and backend-specific facilities. Cover components, props, events, hooks, methods, source and layer options, and applicable host properties. Coverage can be provided by direct delegation, conversion, a shared component, or a named backend extension. A pending implementation remains pending; it must not become an unsupported feature to make a stage pass.

The four adapters target Mapbox web, MapLibre web, Mapbox native, and MapLibre native. Each native adapter covers iOS and Android, giving six runtime environments. Both mixed choices must work: Mapbox web with MapLibre native, and MapLibre web with Mapbox native. SDK feature differences remain explicit; full coverage does not claim that every renderer implements every other renderer's features.

Ferryjoy's platform-specific map components illustrate the intended responsibility: rename source props, translate layer properties, adapt camera input and events, and render the selected wrapper. The library generalizes that translation and hides its platform selection from consuming map components. Ferryjoy is an architectural example, not a dependency or the limit of API coverage.

## Delegation and ownership

Use the selected wrapper's public API first. Forward unchanged options and events where their semantics already match. Convert names, values, arguments, return shapes, or event payloads only where the common contract requires it. Preserve expression structure and selected SDK defaults unless a documented common behavior requires a conversion.

The wrapper normally owns renderer construction, destruction, subscriptions, native integration, source/layer updates, and its existing reuse and recovery behavior. The facade owns its translations, backend selection, and any resources it adds. Avoid parallel ownership of a resource already managed correctly by the wrapper.

Additional state or infrastructure needs a concrete reason: identify the public behavior, the incompatible upstream behavior, and the smallest adaptation that resolves it. A short comment and focused regression test are usually enough. Use a decision record for a material contract choice, not for each forwarded property.

Prefer a direct function or component over a general driver, dispatcher, controller, or lifecycle framework. Shared code is useful when adapters have equivalent behavior. Keep a backend-specific exception local when sharing it would require flags and callbacks to recreate its ordering.

A first-party native bridge is an exception. Before adding one, demonstrate the required behavior with the wrapper, check its public methods and supported extension paths, and record why the remaining adaptation needs native code. Existing bridge code and historical tests are evidence to examine, not an instruction to reproduce that bridge.

## Public API and backend selection

Follow react-map-gl naming and component structure where portable. A source supplies map data; a layer describes how it is drawn. Native adapters select the appropriate wrapper components and translate source and layer fields. The common API should hide that translation from application code.

Keep the common package entry and four explicit adapter entries: `one-map-react`, `one-map-react/mapbox-web`, `one-map-react/maplibre-web`, `one-map-react/mapbox-native`, and `one-map-react/maplibre-native`. Preserve the platform-aware aliases `one-map-react/mapbox` and `one-map-react/maplibre`. The engine is selected explicitly; export conditions or platform setup select web/native code at build time. Do not infer the engine from installed packages.

Publish one package with selected wrappers, SDKs, and host runtimes as optional peers where appropriate. Applications install and version their selected peers. The common entry must not require unrelated renderer packages. Test declarations, JavaScript resolution, and native linking at the boundaries where they differ.

Choose the smallest setup and context API that supports selection, enclosing-map access, and named-map access. The old provider/session design is not mandatory. Keep backend types out of portable contracts while exposing typed backend-specific options through selected entries.

Use typed forwarding for ordinary options. Do not require opaque factories, object provenance checks, sorted property reads, or a separate settings controller unless an actual incompatibility requires them. Validate facade-owned constraints and conversion inputs. Delegate renderer-specific validation when it already gives a useful failure. Never expose credentials through error normalization or diagnostics.

Native methods may be asynchronous where web methods are synchronous. Define each common method's timing and result during its implementation; use a promise where a portable result requires one. Resolution must distinguish dispatch acknowledgement from observed completion. Do not add command queues, cancellation systems, or a universal asynchronous dispatcher solely to make signatures uniform.

## Map reuse and external contexts

Map reuse is a required feature. Delegate to upstream reuse where it exists, and verify that remounting preserves a reusable renderer while updating the props, callbacks, refs, and children required by the common API. Logical unmount must release facade-owned callbacks and resources even when the wrapper retains its renderer.

Provider-local pooling, exact configuration fingerprints, cross-provider isolation, and universal restoration of initial state are not default requirements. Add a guarantee only when the shared API needs it and upstream reuse does not provide it. For a backend without an equivalent facility, record the investigation and mapping or supported limitation; do not imply native reuse from a web-only result.

Caller-supplied WebGL contexts are a separate API to cover through the selected web adapters. Ordinary reuse must work without a caller-supplied context. Prefer the wrapper's existing context path, document its lifetime constraints, and add only the handling needed for demonstrated problems. Do not promise concurrent context sharing or ownership transfer beyond what the selected implementation supports.

## Lifecycle and platform differences

Translate the wrapper's load, style, movement, and error events into documented common meanings. Preserve distinctions that applications need, such as style load versus map load and command dispatch versus completed animation. Do not make readiness depend on unrelated cosmetic updates.

Cleanup must release facade-owned listeners and prevent stale asynchronous work from changing a replacement map. Test Strict Mode and remount behavior where the facade adds effects. Avoid reproducing the wrapper's entire lifecycle state machine or repairing an upstream behavior that the common API does not promise to change.

Use standard host props and styles for DOM and React Native presentation. Forward inherited host behavior with its platform semantics. Representative tests can establish correct forwarding; individual browser, accessibility, TV, or GPU effects remain upstream responsibilities unless the facade changes them. A host property is not automatically a portable map capability.

For genuine incompatibilities, specify the common behavior and implement the smallest conversion or documented composition. Investigate difficult cases such as controlled camera, dragging, popup interaction, style replacement, and query timing with focused examples. Do not silently weaken an advertised contract to achieve portability.

Unsupported requests must fail clearly unless a documented fallback preserves the requested behavior or the application explicitly selects a documented degradation. Distinguish unavailable functionality, invalid input, and operational failure. Preserve useful upstream errors where possible; no particular error-class hierarchy or general diagnostic policy engine is required.

## Full coverage without duplicate implementation

Retain the upstream inventory as a completeness checklist. Map every applicable entry to a common operation, named extension, composition, genuine unsupported boundary, or an internal-only disposition with a reason. Backend-specific features remain scheduled work. Raw SDK access alone does not complete a feature assigned to a common or named API.

Group unchanged forwarded fields under the forwarding implementation and its tests. Use explicit entries for conversions and exceptions. Coverage of a field does not require a separate implementation function, test case, decision document, or runtime acceptance run for that field.

Check wrapper omissions against supported extension paths and underlying SDK capabilities before declaring a limitation. An omission may require a targeted extension; it does not authorize building a general replacement binding. Unresolved feasibility stays visible and prevents claiming that feature complete.

The old inventory IDs and upstream links remain useful. Their old stage assignments, mapping proposals, and verification cells are historical. Reconcile them to this plan during implementation without regenerating a large ledger merely to rename stages. Release completeness still requires every applicable entry to be accounted for.

## Simplicity and contribution

Contributors should be able to trace a public operation to its wrapper call through a small number of relevant modules. Keep conversion tables and local helpers close to the adapter that uses them. File count and line count are not acceptance targets.

Preserve the [coding guide](coding-style.md) and [documentation style guide](STYLE_GUIDE.md). Use their readability and ownership guidance without mechanical splitting or repository-wide cleanup. No feature deletion is justified solely by a desire to reduce code size.

Compatibility versions must be chosen and verified before support is claimed. Existing version records are research baselines, not proof that the replacement supports those versions. Record version-sensitive workarounds and the condition under which they can be removed.

## Transition from the previous implementation

TF01 was authorized and the previous implementation was removed after checking its external backup at `/Users/rob/code/mapbox-code/one-map-backup-2026-10-10`. The [foundation record](tf01-foundation.md) describes verification, retained material, and the new package. The backup is a local recovery aid, not part of the public package or a required contributor resource.

Useful upstream research, style guides, fixtures, and the license remain in the repository. Historical code and obsolete execution instructions remain outside it. No historical-code commit or archive branch is needed. [TF02](tf02-shared-map.md) is complete. The six-environment smoke passed. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7.

Do not copy the previous implementation wholesale and refactor it into compliance. Reuse a small piece only when its responsibility fits these requirements. Historical tests may be reused when they assert a retained public behavior; tests of retired machinery do not define replacement requirements.
