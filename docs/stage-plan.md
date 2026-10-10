# Thin facade stage plan

**Agreed delivery plan for the thin-facade direction.** TF01 is complete; TF02–TF10 have not started. [Requirements](requirements.md) define scope and ownership. [Testing policy](testing-policy.md) defines checks and acceptance timing. This plan replaces the old S00–S51 execution sequence; TF identifiers distinguish new work from historical S04 acceptance and inventory assignments.

## How stages complete

Each stage implements the relevant common API and named extensions through the applicable adapters, documents material differences, adds focused tests, and updates a compact coverage summary. A stage is complete when its stated behavior is implemented and the required checks have passed. Missing runtime evidence is reported separately and leaves a required acceptance gate open. No current historical result certifies replacement code.

Use the existing inventory to prevent omissions. Group entries by the actual forwarding or translation path; preserve specific exceptions. Passing an early example does not complete all APIs in its feature family. Expand coverage in the later stages rather than requiring all constructor, host, or advanced rendering fields before a useful map exists.

Finish implementation and routine checks before proposing acceptance. Scope runtime tests to the affected behavior and environments; obtain permission under the testing policy. Do not run the six-environment suite after every stage by default. A shared lifecycle change may justify all six environments; a local property mapping usually does not.

## Stage sequence

| Stage | Dependencies | Deliverable | Completion evidence |
| --- | --- | --- | --- |
| TF01: Fresh foundation and selection | Requirements and plan reviewed; explicit instruction to begin | Retire the old implementation after confirming the local backup. Establish the minimal package, supported development baseline, public entry paths, optional peers, and application setup for all four adapters. Retain useful documentation and fixtures. | Types/build and isolated common/selected consumer checks. Both aliases and mixed engine choices resolve correctly; no renderer acceptance is required merely for scaffolding. |
| TF02: Working shared map | TF01 | A Ferryjoy-equivalent example with initial camera, one GeoJSON source, one line layer, a camera command, a normalized movement or click event, and unmount/remount. The same map component runs through all four adapters. | Focused translation tests and one approved smoke scenario in each of the six environments at the completed checkpoint. This proves the architecture, not full camera/source/layer coverage. |
| TF03: Reuse and lifecycle differences | TF02 | Expose upstream map reuse and external-context facilities where applicable. Cover resize, load/style events, errors, callback/ref updates, cleanup, and Strict Mode. Resolve observed lifecycle incompatibilities with local adaptations. | Tests demonstrate actual reuse rather than recreation, current callbacks/children after remount, and release of facade-owned work. Verify external contexts separately. Record native reuse support or substantiated limitations. Run affected renderer scenarios. |
| TF04: Camera, events, and gestures | TF03 | Complete camera methods/getters, bounds, padding, projection conversions, camera constraints, controlled state, gesture options, interaction events, and wrapper-specific event facilities. | Mapping tests plus affected camera, gesture, interruption, and controlled-camera scenarios. Feasibility and timing differences remain explicit. |
| TF05: Sources, layers, images, and updates | TF04 | Complete source families, layer/property/expression mappings, filters, ordering, registered images, clustering configuration, and style/source replacement. Delegate updates and recovery to wrappers before adding coordination. | Table-driven mapping tests and representative rendering, update, reset/removal, and recovery scenarios. Advanced layer families continue in TF09; every inventory family has an owner. |
| TF06: Queries and feature state | TF05 | Rendered/source queries, query filters, cluster queries, feature identifiers, set/get/remove state, and normalized asynchronous results. | Independent known-feature assertions, coordinate/density checks where conversions occur, empty results versus failures, and state removal/recreation behavior. |
| TF07: Markers, annotations, popups, and controls | TF04–TF06 | Complete marker and annotation variants, dragging, child interaction, popups/callouts, ornaments, navigation/geolocation/fullscreen/custom controls, and host presentation. | Mapping tests plus actual interaction checks for behavior altered by the facade. Keep live and static content semantics explicit. |
| TF08: Location, offline, and capture | TF04–TF07 | Location acquisition/display/following, permissions, offline packs and tile stores, current-map capture, and independent snapshots through the appropriate common or named API. | Focused lifecycle/failure tests and applicable device/service scenarios. Simulators cannot establish device-only claims. |
| TF09: Advanced rendering and backend facilities | TF05–TF08 | Terrain, projection modes, lighting, atmosphere, rain/snow, advanced sources/layers, custom rendering, style imports/configuration, localization, renderer settings, and remaining backend/global facilities. | Forwarding or conversion coverage for each family, targeted runtime scenarios for changed semantics, and verified unsupported outcomes where applicable. |
| TF10: Coverage and release | TF01–TF09 | Reconcile every applicable inventory entry, finish public docs/examples, establish supported peer ranges, remove obsolete execution documents from the release tree, and prepare the package. | Packed-consumer checks and approved six-environment release conformance; targeted extension/device/service checks; no applicable feature left pending or hidden by a capability flag. |

Within TF04–TF09, independent families can proceed when their actual prerequisites exist. Record that dependency adjustment briefly; it must not expand the shared architecture or weaken final coverage. The table provides an understandable default sequence rather than 100 mandatory administrative sub-stages.

## TF02 architecture checkpoint

Review the implementation after the first shared example works. Trace map creation, source/layer rendering, a camera command, and an event to their wrapper calls. Explain every extra state owner and cross-module dispatch step. A web adapter should mostly delegate to react-map-gl; native adapters should visibly translate the differences.

If a first-party bridge, replacement pool, or general lifecycle controller appears necessary, reproduce the underlying problem with the wrapper before expanding that machinery. Decide which part of the public contract requires the adaptation. Keep a working minimal reproduction and one useful regression test.

Do not import application-specific Ferryjoy behavior such as vessel tracking, token environment variable names, or zoom context into the library contract. Use a small local style and fixture source for the shared example.

## TF03 reuse checkpoint

Start with the upstream reuse path. Check instance identity, changed callbacks and children, retained references, mount-time versus mutable options, and final disposal according to the selected wrapper's contract. Include the interaction between reuse and external contexts if the selected API supports both.

Document any consumer-visible restriction, including backend availability and context lifetime. Keep reuse available while investigating differences. A custom pool requires a demonstrated contract gap; provider-local isolation and strict fingerprints are not assumed requirements.

## Coverage ownership

TF02 provides an early working subset; TF04–TF09 finish the API families. Assign ordinary map configuration and host forwarding to TF03 or the family it affects. Assign source schemas to TF05, query methods to TF06, UI composition to TF07, service/native facilities to TF08, and advanced renderer/global options to TF09. TF10 checks the inventory for anything missed by those assignments.

An unchanged forwarded family may share one implementation and forwarding test. Conversions need their own input/output assertions. Known platform limitations need an explicit capability/error contract. Backend-specific APIs remain required named work; a generic raw handle is not a substitute for their mapping.

Historical inventory IDs remain stable reference keys. The old machine-readable stage ledger is historical until deliberately reconciled to this plan; do not run its existing reconciliation script as though it defined the new stage sequence.

## Current status and next action

TF01 is complete. The old implementation and obsolete tooling have been retired after backup verification. The replacement contains package exports, selection descriptors, conditional aliases, a TypeScript build, and isolated package checks. [Foundation evidence](tf01-foundation.md) records the scope and results; renderer compatibility has not been established.

TF02 is next and has not started. Follow the [TF02 handoff](tf02-handoff.md) when the user authorizes it. Full API coverage and map reuse remain required across the subsequent stages.
