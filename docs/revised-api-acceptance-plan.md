# Corrected browser acceptance proposal

**Fixture repair source-audited; execution is not authorized.** The authorized [attempt02](../records/evidence/revised-api-u25-web-attempt-02.json) passed commands 1-4 on both web engines, then command 5 failed with cleared-state=pending and Cannot read properties of undefined (reading 1). Commands 6-9 were not run. All five commands exited normally, owned processes were released, and candidate inputs were unchanged. Subsequent source-backed reproduction locates the throw after source recreation and before the replacement-style request, correcting the initial apparent phase inference without rewriting the attempt record. The approved fixture-only repair and applicable routine checks are complete, independent source audit passed, and [PR47](https://github.com/RobJacobson/one-map-react/pull/47) is open. The new browser-only attempt03 archive and input packet are frozen and independently audited. Commands 1-5 are reruns; commands 6-9 would execute for the first time. New explicit permission is required; no native execution is authorized.

## First-attempt history

The immutable [U25 first-attempt record](../records/evidence/revised-api-u25-web-acceptance.json) records the authorized attempt on archive 408c451d9b8da4642acd1843be1282e88259445f2a8879293682c2598d2a1f79. Its first TF04 command passed the Mapbox scenario, failed on MapLibre camera forwarding with Invalid LngLat object: (undefined, undefined), and hung after emitting results because owned web children survived teardown. The command failed; eight later commands were not run. The prior failure is not erased by repairs or any later passing retry.

The [U24 candidate record](../records/evidence/revised-api-u24-candidate.json) preserves that artifact's six-environment preparation and historical input packet. Its immutable archive and compact evidence are preserved. The superseded U24 temporary harness and the camera/runner-repair temporary harness, publication clone and runtime workspace were removed under the retention policy; their historical recipes are not current inputs. Their recorded native consumer preparation does not establish corrected native readiness or linked SDK identity.

The [style-query repair evidence](../records/evidence/revised-api-u25-style-query-repair.json) owns the proven diagnosis, fixture-only source changes, routine outcomes and new candidate/input preparation. All 29 archive checks passed: 13 package, eight minimum-peer and eight RNMapbox 10.3.8 endpoint cases. Independent browser-input review passed with no findings; no new renderer result is claimed.

## Proven diagnosis and bounded repair

Actual SDK Map-to-Style-to-source-state calls on both web engines reproduce the error with a normally constructed fresh SourceFeatureState. Redundant whole-feature removal queues a deletion; an immediate read reports empty without flushing it, and a subsequent set before SDK coalescing dereferences an uninitialized state namespace. No-remove, coalesce-before-set and previously coalesced-state controls avoid that condition. The actual query-smoke hook reproduces the observed flags and locates the throw before the replacement-style request. These are SDK/source-backed routine reproductions, not another browser run.

The owner-approved change belongs only to the application fixture: read state first, skip redundant removal only if the state is already empty, and always verify empty state. Populated retained state must still be explicitly removed and verified. Do not swallow SDK errors, add arbitrary waits/retries or introduce facade auto-clearing/replay guarantees. Library production modules, public APIs, peers, locks, versions and SDK patches remain outside the repair. The fixture helper is implemented and its 18 focused regression cases pass, including the two actual-SDK failures reproduced before the edit. Current source suites, types, compiler proof, application types and build passed. Compiled suites and mocked native suites were not rerun for this fixture-only repair: the prior camera/runner-repair evidence is reused because library production source and all 164 dist files are unchanged. Independent source audit passed; no renderer rerun has occurred.

The existing recreated-state and cleared-state labels retain the value explicitly-cleared. They mean the application ensured empty state by reading it, conditionally removing populated state and always verifying the result. They do not assert that removeFeatureState was invoked for an already-empty result. These labels do not change the selected renderer's feature-state lifetime contract.

## Corrected artifact

| Field | Prepared identity |
| --- | --- |
| Archive | artifacts/revised-api-u25-f03/one-map-react-0.1.0-rc.2.tgz |
| SHA-256 | 7d0bc9ab110aeea75253ec4de8172885d19f175d6f2d3b442002b2bf16b2afb0 |
| Source review | PR47 source commit f781f24496d3d70468642ac96778dd80bc21d3f6 |
| Byte scope | 171 archive files, including 164 dist files byte-identical to the previous 21424251 candidate; only README differs. |

The package version remains a rehearsal/candidate identity, not a registry release-version decision. Peer ranges, locks, versions and SDK patches are unchanged. The new repair changes only the application fixture and regression proofs; all 164 shipped dist files match the previous 21424251 candidate. Current source and applicable type/compiler/build checks passed, and independent source audit passed. Prior compiled-suite and mocked-native outcomes are reused from the camera/runner-repair evidence, with unchanged library production source and all 164 dist files; those suites were not rerun for this fixture-only repair. The 29 archive consumer checks and new browser-only input verification passed; independent candidate review passed with no findings. No browser rerun, native build/link result or renderer acceptance follows from those routine proofs.

## Proposed web sequence


| Proposed command | Reserved ports | Retained scope |
| --- | --- | --- |
| `bun scripts/tf04-camera-smoke.mjs web` | 4173, 4174, 5173, 5174 | fit, click, stop, web controlled viewState |
| `bun scripts/tf04-camera-smoke.mjs web corrections` | 4173, 4174, 5173, 5174 | gesture updates, logical unmount/reuse, retained proxy ownership |
| `bun scripts/tf05-sources-smoke.mjs web` | 4175, 4176, 5175, 5176, 8798 | source/layer/image families, updates/removal, supported app Images retirement before style replacement |
| `bun scripts/tf05-sources-smoke.mjs web corrections` | 4175, 4176, 5175, 5176, 8798 | same-renderer reuse and stale asynchronous image/unmount correction probes |
| `bun scripts/tf06-queries-smoke.mjs web` | 4177, 4178, 5177, 5178 | rendered/source/cluster queries and explicit renderer-owned feature state |
| `bun scripts/tf07-ui-smoke.mjs web mapbox` | 4187, 5187 | live marker children/activation/provider, selected web controls/popup/browser coordinate emulation |
| `bun scripts/tf07-ui-smoke.mjs web maplibre` | 4188, 5188 | same UI scope for MapLibre web |
| `bun scripts/tf09-rendering-smoke.mjs web mapbox` | 4291, 5291, 8798 | terrain/projection/hillshade/advanced selected facilities; raw-ref capture used for pixel observation |
| `bun scripts/tf09-rendering-smoke.mjs web maplibre` | 4292, 5292, 8798 | same advanced scope for MapLibre web |


One GPT-6 Luna worker at low reasoning runs all nine commands serially. The proposed budget is 20-40 minutes including artifact verification and renderer interactions, based on historical narrower runs and the larger current scope; diagnosis/retries are excluded. TF04/TF05/TF06 group commands internally exercise both engines. Both TF07 and TF09 engine rows remain serial, and shared fixture port 8798 has one owner. Stop at the first failed whole command and report it to the coordinator; no worker source edits or independently chosen restart/retry.

The new browser-only harness contains two independently installed web consumers and the two opposite mixed web-selection entries. It contains no newly prepared native consumer dependency trees, native entry/watch transforms or codegen result. The exact bindings below are part of every proposed invocation; bare argv is insufficient.

## Frozen browser inputs and invocation bindings

Run only from /private/tmp/one-map-u25-f03-hwqmsafr/frozen-harness, never the original dirty checkout or either prior harness. Two independently installed web consumers resolve the exact extracted corrected package; all 171 archive members were verified for each consumer. The frozen initial input inventory contains 13,149 files/links. The source manifest SHA-256 is 211d8ca28f283f4820cf2c5698048ad7a222f98d9cc5f18e3d69774b4bd41eb3; the initial-input manifest SHA-256 is 4bd872973b62db27a3cfa24a7c12b5a671a5b82ee64fa2750fa06b67f40cf89b. The dist digest remains 52763b183574a8cc6a7436a7b9aefcba58793242917bd132570f0e5177b4aa5d, using the drivers' sorted relative-path/raw-byte algorithm; it is distinct from the archive hash. The reviewed queries-smoke.ts fixture hash and PR47 source commit are bound in candidate evidence.

| Consumer | Resolved tuple | Frozen lock SHA-256 |
| --- | --- | --- |
| mapbox-web | react 19.2.3, react-dom 19.2.3, react-map-gl 8.1.3, mapbox-gl 3.32.0 | bd363e383cd68fb7b47ba914fb6a9ae35d8e3e468ca04e512be95621ee9c1e07 |
| maplibre-web | react 19.2.3, react-dom 19.2.3, react-map-gl 8.1.3, maplibre-gl 6.13.0 | 0c0947e27c9de0b957ca33ed3bd83a04c7088a0a213b37f9745e96ce61c28771 |

The two web entries select the existing opposite mixed configurations: Mapbox web with MapLibre native, and MapLibre web with Mapbox native. Their actual web build graphs and backend guards were checked statically. This browser-only freeze does not install native consumers, transform native entries/watch roots or run native codegen; static graphs are not renderer or Metro transport results.

Prepend `/Users/rob/.local/share/vite-plus/package_manager/bun/1.4.1/bun/bin:/Users/rob/.local/share/vite-plus/js_runtime/node/24.22.1/bin` to inherited PATH for every command and child process. Verify Bun 1.4.1, Node 24.22.1 and their frozen executable hashes before execution; mismatch stops for the coordinator. Current web installs used Bun 1.4.1 with frozen locks and install scripts disabled. The small pngjs 7.0.0 runtime was copied byte-for-byte from the prior prepared runtime; its exact bytes are recorded separately. The configured Chrome executable remains an evidence-bound input.

Before every command, run `node /private/tmp/one-map-u25-f03-hwqmsafr/verify-frozen-inputs.mjs` with that PATH. Its SHA-256 is fdde50376a63104d9f8a9d007b69fa069987cecc5369f53fdde88ecf7de39111. Recheck the reserved ports through a read-only listener inventory: they must be free or explicitly owned by this authorized attempt. Stop on unknown listeners; do not kill unrelated processes. Track all worker-started process groups and clean up only owned children.

The coordinator injects the existing public token through MAPBOX_ACCESS_TOKEN without copying .env or recording the secret. No new network credential-validity claim follows from preparation. Each numbered command also has the following exact environment/output bindings. Output parent directories exist; these new attempt03 paths preserve both prior attempts and their logs.

| Command | Additional environment | Stdout record |
| --- | --- | --- |
| 1 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf04 | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-01.log |
| 2 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf04-corrections | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-02.log |
| 3 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf05 | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-03.log |
| 4 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf05-corrections | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-04.log |
| 5 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf06 | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-05.log |
| 6 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf07-mapbox | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-06.log |
| 7 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/cache/u25-attempt-03/tf07-maplibre | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-07.log |
| 8 | TF09_LIBRARY_SHA256=52763b183574a8cc6a7436a7b9aefcba58793242917bd132570f0e5177b4aa5d; TF09_OUTPUT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-mapbox-tf09.json; TF09_RUNTIME_NODE_MODULES=/private/tmp/one-map-u25-f03-hwqmsafr/runtime-tools | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-08.log |
| 9 | TF09_LIBRARY_SHA256=52763b183574a8cc6a7436a7b9aefcba58793242917bd132570f0e5177b4aa5d; TF09_OUTPUT=/private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-maplibre-tf09.json; TF09_RUNTIME_NODE_MODULES=/private/tmp/one-map-u25-f03-hwqmsafr/runtime-tools | /private/tmp/one-map-u25-f03-hwqmsafr/runtime/results/u25-attempt-03/web-09.log |

Commands 1-7 use distinct explicit Vite caches. TF09 sets its cache to a unique owned one-map-rendering- temporary directory internally and creates its own profile; no ineffective external TF09 cache override is proposed. Other browser commands also create temporary profiles. Both TF09 rows require TF09_LIBRARY_SHA256, TF09_OUTPUT and TF09_RUNTIME_NODE_MODULES. The last variable names the runtime-tools directory containing package.json, not its node_modules child; that anchor loads the verified pngjs 7.0.0 runtime.

The plan-bound launcher is `node /private/tmp/one-map-u25-f03-hwqmsafr/runtime/run-u25-one.mjs <ordinal>`, with ordinals 1-9 issued sequentially only after permission. It dispatches the corresponding table row and preserves its exact bindings. The frozen handoff binds its source hash, and the launcher independently pins the packet hash. Syntax/mechanical checks during preparation did not invoke it or run any browser command.

## Native composition limitation


A pure Node probe using the React Native 0.87.1 schema generator found three duplicate global declarations when RNMapbox 10.3.7 and MapLibre Native 11.5.0 were co-installed: NativeMapViewModuleSpec, NativeMapViewModuleSpecBase and NativeMapViewModuleSpecJSI. The equivalent RNMapbox 10.3.8 plus MapLibre Native 11.5.0 probe passed. Preserve the failed 10.3.7 probe in candidate evidence; neither result is an actual native build/link result or renderer acceptance.

The retained mixed-selection contract covers Mapbox web with MapLibre native, and MapLibre web with Mapbox native. It does not require co-installing both native SDKs. The proposed native baseline has four independent environments (Mapbox iOS/Android and MapLibre iOS/Android), each with one native SDK. The 10.3.7 co-installation finding does not authorize another patch or peer-range change; it remains a documented composition limitation.

The development Expo host uses RN 0.86.3 and RNMapbox 10.3.8. Its codegen or routine results do not establish acceptance on the proposed RN 0.87.1 baseline. Fresh resolved and linked native SDK identity remains unverified.


## Later native gate

The corrected browser proposal grants no native permission. Native host readiness, generation/template identity, resolved SDKs, build inputs and produced/installed binary verification require future preparation and separate permission after web result approval. The prior iOS device metadata does not prove a usable CoreSimulator service; Android AVD/serial remains unassigned. Do not infer native build/link compatibility from requested pins, pure Node codegen, mocked checks or the browser-only corrected harness.

The later native scope must separately enumerate four independent single-SDK OS/backend environments, exact commands, exclusive sequential Metro/device/build/port ownership, all required identity-bound manual receipts, duration and retry scope. The reviewed U24 record preserves the earlier recipe and thirteen-receipt requirements; refresh them against the corrected artifact and actual resolved consumers before any native permission request. Physical devices, full VoiceOver/TalkBack, sensor certification and unenumerated TF08 raw-service operations remain excluded.

## Permission and failure handling

Both prior attempt packets remain immutable evidence. The fixture repair and corrected attempt03 input freeze are complete and independently audited; a new explicit owner permission is still required. That decision covers these exact nine serial web commands on the corrected archive and frozen browser inputs only: commands 1-5 rerun, commands 6-9 first execution. No permission has been granted for this rerun. Internal bounded polling/fit attempts within a command are distinct from a new whole-command attempt. Preserve both prior failed attempts and each new attempt's identity/outcome; stop at the first whole-command failure. Changed archive, harness or runtime inputs need coordinator review and relevant renewed permission.

The [testing policy](testing-policy.md#acceptance-timing-and-user-permission) owns permission rules. Retain compact outcome/provenance records and only the small logs/screenshots needed for an active investigation; clear temporary consumers, caches and tools when the checkpoint ends. No merge, tag or registry publication is authorized by this proposal.
