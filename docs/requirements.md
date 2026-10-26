# Thin facade requirements

**Agreed next incompatible-release design; migration in progress:** one-map-react provides one React mapping API over RNMapbox, MapLibre React Native, and the Mapbox and MapLibre entries of react-map-gl. The public API generally follows react-map-gl. Applications choose their backend at setup and use shared map code without maintaining their own translation components.

This document defines the retained architecture and the agreed scope for the next incompatible release. The [migration contract](revised-api-proposal.md) owns exact target signatures and consumer examples; the [implementation plan](revised-api-implementation-plan.md) owns sequencing and separate approval boundaries. The current package retains its broader runtime API; [the package manifest](../packages/one-map-react/package.json) owns its version. All four selected wrapper getters are implemented on the development branch. The working selected refs retain common operations and getWrapperMap; U06 removes their advanced method mirrors. U06 is merged as PR25 and U07 as PR26. U08 native camera target migration is merged as PR27. U09 feature-state lifetime migration is merged as PR28. U10 current-map capture migration is merged as PR29. U11 selected offline manager migration is merged as PR30. U12 independent snapshot migration is implemented and audited with PR31 open; [applicable routine verification is recorded](../records/evidence/revised-api-u12-snapshots.json). U13 common popup migration is implemented and independently audited with PR32 open; [routine verification and provenance are recorded](../records/evidence/revised-api-u13-popups.json); U14 navigation and fullscreen migration is implemented and independently audited with PR33 open; [routine verification and provenance are recorded](../records/evidence/revised-api-u14-navigation.json); U15 scale and attribution migration is implemented and independently audited after reviewed U14 PR33; [routine verification and provenance are recorded](../records/evidence/revised-api-u15-ornaments.json). U15 PR34 is open. U16 geolocation UI migration is implemented and independently audited; [routine verification and provenance are recorded](../records/evidence/revised-api-u16-geolocation-ui.json). U16 PR35 is open. U17 common control layout migration is implemented and independently audited; [bounded routine verification and artifact provenance are recorded](../records/evidence/revised-api-u17-control-layout.json); U17 PR36 is open. U18 acquisition migration is implemented and independently audited; [U18 evidence](../records/evidence/revised-api-u18-location-acquisition.json) records bounded routine verification, archive provenance and remaining gates. A reviewed U18 PR is authorized; U19 follows its reviewed PR automatically under the unit protocol and remains undispatched. Other migration changes remain pending. The [unit plan](revised-api-implementation-plan.md#work-order) owns review and authorization status. No new release or renderer acceptance is claimed. These requirements supersede conflicting historical implementation instructions while preserving the scope and outcomes of original acceptance records.

The following implementation summary describes the current package and historical checkpoints. The [stage plan](stage-plan.md) defines delivery; the [testing policy](testing-policy.md) defines verification. The previous implementation has been retired. TF01 supplies selection; TF02 implements the first shared map for one GeoJSON line, `flyTo`, and `onMove`. TF03 implements web reuse, the native reuse limitation, and load, style, error, and resize callbacks. Its renderer smoke passed. TF04 implements the shared camera, gesture, and interaction contract. Its renderer smoke passed. TF05 implements the five portable source families, eight layer types, clustering configuration, registered images, and update/reset/style-replacement behavior. Its renderer smoke passed. TF06 implements rendered and source queries, cluster queries, and feature state as promise-based map methods. The corrected TF04/TF05 web runs and TF06 web passed. The native source-lifecycle correction passed TF06 acceptance in all six environments; see the [TF06 record](tf06-queries.md). Historical TF04/TF05 runs remain attached to their recorded artifacts. Later migration work follows the revised implementation plan, separately from these historical results.

## Purpose and scope

The next incompatible release deliberately narrows the common API. Full coverage applies to its retained rendering, camera, query, state, setup, display, and selected-wrapper contract. Full upstream parity remains the current TF contract's coverage goal; it is not the next release's goal. A retained feature awaiting implementation remains pending. Deliberate exclusions are scope decisions, not SDK impossibilities or completed implementation.

The next common runtime exports are exactly `MapSetup`, `Map`, `Source`, `Layer`, `Images`, `Marker`, `UserLocation`, and `useMap`. Retain their corresponding rendering, geometry, camera, query, state, image, marker, display-location, adapter, and setup types. Keep GeolocationPosition and UserLocationProps for supplied display data. The migration contract defines the exact removals and selected signatures; its After examples target the future release.

The agreed exclusions are listed below. Selected advanced ref mirror, common native marker drag, current-map capture, common offline, independent snapshot, common popup, navigation/fullscreen, scale/attribution and common geolocation UI removal are implemented in the working tree. The unit plan records each review and verification gate. Remaining exclusions await implementation:

- Common services and location acquisition: remove useMapServices, MapServices, MapSetup.locationProvider, Adapter.services, acquisition-only types and policy, offline storage, map capture/captureEnabled, and independent snapshots. Applications own these operations through application services or selected raw managers. Keep existing offline databases, packs, metadata, and native operation keys intact.
- Common Popup and all six controls: Control, NavigationControl, AttributionControl, ScaleControl, GeolocateControl, and FullscreenControl. Remove their facade types, adapter fields, and selected facade aliases. Selected web Wrapper components, native ornaments/annotations, and application screen UI supply replacements.
- Shared native marker dragging in both live and annotation modes. Web dragging and selected raw native annotation dragging remain available. Common native drag requests must fail clearly; selected native marker types exclude drag callbacks and permit draggable=false.
- Automatic native camera rollback when viewState is unchanged after movement. Changed native targets and explicit commands remain supported; web controlled behavior remains delegated. Native location-follow ownership restrictions remain explicit.
- Automatic feature-state lifetime clearing, replay, reset ordering, or transactions across source/style replacement. Keep explicit set/get/remove operations, argument validation, current source refs, SDK errors, and owner-bound cleanup.
- Source.onClick, facade hitbox additions, synthetic source propagation, SourceClickEvent, and UserLocation.onPress. Applications use Map.onClick with interactiveLayerIds. Pressable location geometry uses application-owned source/layer IDs; raw wrapper source onPress/hitbox facilities remain selected behavior.
- Automatic Images replay or retry into a replacement style. Keep initial usable-style waiting and within-style updates/removals, errors, obsolete-load suppression, and cleanup. Applications remount Images after the replacement style loads.
- Hand-mirrored selected advanced ref methods. Selected refs gain asynchronous getWrapperMap returning the currently attached borrowed wrapper handle or rejecting when detached. The common MapRef stays SDK-free. Wrapper timing, React resource ownership, and existing common method restrictions remain explicit.

Retain all currently implemented source/layer families, source and style updates, clustering, portable terrain/projection/light/hillshade, selected advanced inputs, camera/projection/elevation methods, rendered/source/cluster queries, and explicit feature state. Keep MapSetup, named maps, four adapters, platform aliases, both mixed backend choices, typed selected options, host props, and inexpensive explicit raw wrapper facilities.

Live markers retain activation, interactive children, providers, coordinate updates, anchor/offset/renderMode, default pins, refresh, errors, and cleanup. UserLocation displays supplied positions and accuracy without acquiring location or handling activation. Keep the live native overlay and portal dependency until a separately proved replacement preserves that behavior. Validation, failure propagation, attachment checks, stale-result guards, accessibility, legal attribution, and facade-owned resource cleanup remain required. The [sole coverage checklist](api-coverage.md) assigns each retained or changed group its later implementation owner.

Keep peers, patches, lockfiles, candidate artifacts, and recorded support unchanged during this contract reconciliation. A breaking prerelease version remains a later owner decision; no package bump is authorized by this document.

For current TF08 scope, the owner explicitly excludes RNMapbox's `invalidateAmbientCache()` and `setMaximumAmbientCacheSize(bytes)` from TF08 implementation and acceptance requirements because they are unnecessary for this stage. This exception applies only to these two RNMapbox operations. The remaining cache operations and MapLibre equivalents retain their existing scope. Existing wrapper exports and explicit unsupported errors remain available; this scope decision does not remove public methods.

TF08 acceptance uses browsers, iOS simulators, and Android emulators. The owner does not require physical-device testing, so missing physical-device evidence does not block TF08 acceptance. Simulator and emulator results establish the exercised behavior without certifying physical sensors or device-specific behavior.

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

For genuine incompatibilities, specify the common behavior and implement the smallest conversion or documented composition. Investigate retained camera targets, marker activation, style/image ownership, and query timing with focused examples. The next-release exclusions above retire broader common guarantees explicitly; other advertised behavior must remain intact.

Unsupported requests must fail clearly unless a documented fallback preserves the requested behavior or the application explicitly selects a documented degradation. Distinguish unavailable functionality, invalid input, and operational failure. Preserve useful upstream errors where possible; no particular error-class hierarchy or general diagnostic policy engine is required.

## Full coverage without duplicate implementation

Maintain the [grouped Markdown checklist](api-coverage.md) as the sole coverage record. Account for every retained public API through a bounded group of unchanged forwarded fields or an explicit contract/exception row, with a common operation, selected wrapper route, composition, genuine unsupported boundary, or internal-only disposition and reason. Record deliberately excluded current APIs and their migration owners in the same checklist, separately from SDK limitations. Preserve useful upstream findings and citations in [research notes](upstream-research.md); use upstream declarations for detailed names, signatures, and defaults. Retained backend-specific features remain required. The agreed getWrapperMap route replaces only selected advanced method mirrors; raw SDK access alone does not complete a retained common conversion or lifecycle guarantee.

Group unchanged forwarded fields under the forwarding implementation and its tests. Use explicit entries for conversions and exceptions. Coverage of a field does not require a separate implementation function, test case, decision document, or runtime acceptance run for that field.

Check wrapper omissions against supported extension paths and underlying SDK capabilities before declaring a limitation. An omission may require a targeted extension; it does not authorize building a general replacement binding. Unresolved feasibility stays visible and prevents claiming that feature complete.

Upstream citations and historical IDs remain useful research references. Old stage assignments, mapping proposals, and verification cells are recoverable through Git and must not become another maintained coverage record. Review changes against the grouped checklist during implementation and peer upgrades; do not maintain a parallel per-field status ledger. Next-release completeness requires every retained API and deliberate migration exclusion to be accounted for, with unresolved work visible. Current-route checkmarks do not establish completion of the next-release contract.

## Simplicity and contribution

Contributors should be able to trace a public operation to its wrapper call through a small number of relevant modules. Keep conversion tables and local helpers close to the adapter that uses them. File count and line count are not acceptance targets.

Preserve the [coding guide](coding-style.md) and [documentation style guide](STYLE_GUIDE.md). Use their readability and ownership guidance without mechanical splitting or repository-wide cleanup. No feature deletion is justified solely by a desire to reduce code size.

Compatibility versions must be chosen and verified before support is claimed. Existing version records are research baselines, not proof that the replacement supports those versions. Record version-sensitive workarounds and the condition under which they can be removed.

## Transition from the previous implementation

TF01 was authorized and the previous implementation was removed after checking its external backup at `/Users/rob/code/mapbox-code/one-map-backup-2026-10-10`. The [foundation record](tf01-foundation.md) describes verification, retained material, and the new package. The backup is a local recovery aid, not part of the public package or a required contributor resource.

Useful upstream research, style guides, fixtures, and the license remain in the repository. Historical code and obsolete execution instructions remain outside it. No historical-code commit or archive branch is needed. [TF02](tf02-shared-map.md) is complete. The six-environment smoke passed. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7. [TF03](tf03-reuse.md) is complete. Its renderer smoke passed. [TF04](tf04-camera.md) is implemented in the package. Its renderer smoke passed.

Do not copy the previous implementation wholesale and refactor it into compliance. Reuse a small piece only when its responsibility fits these requirements. Historical tests may be reused when they assert a retained public behavior; tests of retired machinery do not define replacement requirements.
