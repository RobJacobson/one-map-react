# Native acceptance proposal

**Native execution readiness is blocked; preparation and review are authorized.** The owner requests the native gate as native U25 acceptance. The [unit protocol](revised-api-implementation-plan.md#u26-execute-approved-native-checks) retains U26 as its native execution identifier. This proposal owns the separate native permission request against the unchanged PR48 candidate.

The [current browser record](../records/evidence/revised-api-u25-web-attempt-05.json) records all nine approved browser rows passing on that candidate. Commands 1-2 passed in attempt04; commands 3-9 passed in the explicitly approved recovery. The [interrupted attempt04 record](../records/evidence/revised-api-u25-web-attempt-04.json), [attempt03](../records/evidence/revised-api-u25-web-attempt-03.json) and earlier failed attempts remain immutable history. Their source diagnoses and corrections remain in the [popup repair evidence](../records/evidence/revised-api-u25-popup-repair.json), [source-state repair evidence](../records/evidence/revised-api-u25-style-query-repair.json) and [camera/runner repair evidence](../records/evidence/revised-api-u25-repairs.json). The completed browser harness and runtime tools are retired under the retention policy; their paths are historical provenance rather than current execution inputs.

## Candidate and scope

| Field | Identity | Verification boundary |
| --- | --- | --- |
| Archive | artifacts/revised-api-u25-f04/one-map-react-0.1.0-rc.2.tgz | The existing rehearsal archive is reused without repacking. |
| Archive SHA-256 | 8f8b93f57eeed914c5796dc302aab635628803a03be71cb9c50e639ccfac654d | Exact archive identity, distinct from the dist digest. |
| Dist digest | 52763b183574a8cc6a7436a7b9aefcba58793242917bd132570f0e5177b4aa5d | The TF07/TF09 sorted relative-path and raw-byte algorithm. |
| Source basis | PR48 source f76b24e4000ea72cf86b2952f811323a471e0628, reviewed head c293272c1fbf0dcab7a571cdbdaec6d0942a0d4d | Documentation preparation changes no source or archive bytes. |
| Package bytes | 171 archive members, including 164 dist files | The package README remains frozen with the candidate. |

The native scope has four independent single-SDK environments: Mapbox iOS, Mapbox Android, MapLibre iOS and MapLibre Android. The proposed minimum baseline retains React Native 0.87.1, RNMapbox 10.3.7 or MapLibre React Native 11.5.0 and the publication tuple's Teleport 1.2.1. Requested pins are inputs; resolved, linked and installed identities require later evidence. Peer ranges, locks, versions and patches stay unchanged.

## Native composition limitation

The retained mixed-selection contract covers Mapbox web with MapLibre native and MapLibre web with Mapbox native. It does not require co-installing both native SDKs. The [candidate record](../records/evidence/revised-api-u24-candidate.json) preserves the RN 0.87.1 pure-Node codegen collision with RNMapbox 10.3.7 plus MapLibre 11.5.0 and its passing 10.3.8 control. Neither control is build/link or renderer acceptance. The maintained Expo host's RN 0.86.3 and RNMapbox 10.3.8 results do not certify this proposed baseline.

## Preparation gates

The inspected installed Metro resolver selects generic browser capture-rendering.ts for the fixture's explicit ./capture-rendering.js import on both engines and both native platforms. An extensionless control selects capture-rendering.native.ts. The frozen TF09 native capture path would therefore throw; a prerequisite repair is required before an acceptance request. Source and fixtures remain unchanged because this planning task authorizes no repair.

Host readiness is also unresolved. The separately attempted CoreSimulator query timed out and no Android AVD is available. No usable iOS target or assigned Android serial has been established. The coordinator must resolve prerequisite repair and host setup, then refresh the native inputs and independent review before requesting acceptance permission.

The initial preparation freeze inventories 33,896 entries. Two isolated single-SDK JavaScript installs used Bun 1.4.4 with install scripts disabled; both match all 171 archive members and 44 reviewed expected patched files across the consumers. Both consumers subsequently passed frozen-lock installs under actual Bun 1.4.1, with unchanged locks. The owned runtime-bin/bun link enforces Bun 1.4.1 for parent and child commands. Mixed native App/watch variants were constructed and their Babel transforms/watch roots passed. All four actual native resolver selections choose generic setup.ts and its opposite web backend; extensionless controls choose setup.native.ts. The backend guard would reject the actual selection. This confirmed resolver defect joins capture resolution as a prerequisite repair; no Metro transport result is claimed.

No native generation, build, installation, Metro process, device boot or renderer flow has been run for this preparation. Isolated JavaScript installs with scripts disabled, static resolution and read-only host inventory are preparation checks. Their results cannot establish native compatibility or runtime acceptance.

The frozen publication TF07 scene has one map, a plain-text annotation and no delayed-image annotation refresh reference. The core thirteen receipts cannot establish named/multiple-map provider ownership and retained local state, annotation refresh, resize/orientation, or the current camera target at two densities. Those retained checks need an authorized fixture/plan correction before acceptance permission. The original dirty-tree focused fixture is outside these inputs and cannot be silently overlaid.

The coordinator must also confirm an operator and tools capable of the physical/visual receipts. Callback counters cannot establish touch bounds, nested scrolling, rotation or host accessibility behavior. This proposal covers application location/UI through TF07 and capture used for TF09 rendering observations. Broader retained raw offline, cache, import, snapshot and service acceptance needs an explicit owner scope disposition; those operations remain unverified.

## Conditional command sequence

These are inspected command routes, not an executable approval packet. Target IDs, native dependency resolution, generated projects and binary hashes remain future inputs. The [native planning evidence](../records/evidence/revised-api-u25-native-plan.json) owns the preparation checks and blocker ledger. A repaired and reviewed input freeze must supply concrete target and identity bindings before dispatch.

The proposed working directory is /private/tmp/one-map-u25-n01-nz92pixo/native-harness. Prepend /private/tmp/one-map-u25-n01-nz92pixo/runtime-bin:/Users/rob/.local/share/vite-plus/js_runtime/node/24.22.1/bin to the inherited PATH. Verify those tool identities again before a later execution request. The coordinator supplies the existing public MAPBOX_ACCESS_TOKEN without copying .env or recording the secret. Pinned-peer source review found no mandatory Mapbox download-secret token prerequisite; no new secret credential is presumed.

| Preparation order | Working directory relative to the harness | Conditional command | Effect |
| --- | --- | --- | --- |
| 1 | . | `bun scripts/setup-native-example.mjs native-mapbox` | Generates ios/android/Gemfile via CLI20.2.0 init RN0.87.1; no JS install, pods, build or launch. |
| 2 | examples/native-mapbox | `bundle install` | Resolve future iOS dependencies and record resulting lock identity. |
| 3 | examples/native-mapbox/ios | `bundle exec pod install` | Resolve future iOS dependencies and record resulting lock identity. |
| 4 | . | `bun scripts/setup-native-example.mjs native-maplibre` | Generates ios/android/Gemfile via CLI20.2.0 init RN0.87.1; no JS install, pods, build or launch. |
| 5 | examples/native-maplibre | `bundle install` | Resolve future iOS dependencies and record resulting lock identity. |
| 6 | examples/native-maplibre/ios | `bundle exec pod install` | Resolve future iOS dependencies and record resulting lock identity. |

Generation uses the inspected setup script's CLI 20.2.0 and requested RN 0.87.1 template. Record the actually resolved CLI/template versions and integrity, generated project tree, Gemfile and native lockfiles. Record resolved Pods, Gradle dependencies, codegen and linked SDK identities before build. Configuration requesting Mapbox Maps 11.23.1 on both operating systems is not evidence of the linked version.

| Scenario order | Conditional command from the harness | Native scope |
| --- | --- | --- |
| 1 | `bun scripts/tf04-camera-smoke.mjs ios` | mapbox-ios, maplibre-ios |
| 2 | `bun scripts/tf04-camera-smoke.mjs android` | mapbox-android, maplibre-android |
| 3 | `bun scripts/tf05-sources-smoke.mjs ios` | mapbox-ios, maplibre-ios |
| 4 | `bun scripts/tf05-sources-smoke.mjs android` | mapbox-android, maplibre-android |
| 5 | `bun scripts/tf06-queries-smoke.mjs ios` | mapbox-ios, maplibre-ios |
| 6 | `bun scripts/tf06-queries-smoke.mjs android` | mapbox-android, maplibre-android |
| 7 | `bun scripts/tf06-queries-smoke.mjs ios lifetimes mapbox` | mapbox ios feature-state lifetimes |
| 8 | `bun scripts/tf06-queries-smoke.mjs ios lifetimes maplibre` | maplibre ios feature-state lifetimes |
| 9 | `bun scripts/tf06-queries-smoke.mjs android lifetimes mapbox` | mapbox android feature-state lifetimes |
| 10 | `bun scripts/tf06-queries-smoke.mjs android lifetimes maplibre` | maplibre android feature-state lifetimes |
| 11 | Per-environment build/identity gate, then `bun scripts/tf07-ui-smoke.mjs ios mapbox` and `bun scripts/tf09-rendering-smoke.mjs ios mapbox` | Mapbox iOS |
| 12 | Per-environment build/identity gate, then `bun scripts/tf07-ui-smoke.mjs android mapbox` and `bun scripts/tf09-rendering-smoke.mjs android mapbox` | Mapbox Android |
| 13 | Per-environment build/identity gate, then `bun scripts/tf07-ui-smoke.mjs ios maplibre` and `bun scripts/tf09-rendering-smoke.mjs ios maplibre` | MapLibre iOS |
| 14 | Per-environment build/identity gate, then `bun scripts/tf07-ui-smoke.mjs android maplibre` and `bun scripts/tf09-rendering-smoke.mjs android maplibre` | MapLibre Android |

TF04/TF05/TF06 ordinary commands start Metro, build, install and launch both engine shells sequentially. The lifetime rows also own native build/install/launch. These drivers require the assigned iPhone 18 Pro to be the unique available named and sole booted iOS target, and the assigned Android emulator to be the sole connected device. Some legacy operations use unscoped device commands. Every invocation requires a fresh listener inventory; entering a legacy freePort path with an unknown listener is forbidden because it can terminate unrelated processes.

| Environment | Shell relative to the harness | Conditional build/install/launch command from that shell | Application identifier |
| --- | --- | --- | --- |
| mapbox-ios | examples/native-mapbox | `bun run ios -- --no-packager --port 8081 --udid UDID_TO_ASSIGN` | org.reactjs.native.example.OneMapMapbox |
| mapbox-android | examples/native-mapbox | `bun run android -- --no-packager --port 8081 --device SERIAL_TO_ASSIGN` | com.onemapmapbox |
| maplibre-ios | examples/native-maplibre | `bun run ios -- --no-packager --port 8081 --udid UDID_TO_ASSIGN` | org.reactjs.native.example.OneMapMaplibre |
| maplibre-android | examples/native-maplibre | `bun run android -- --no-packager --port 8081 --device SERIAL_TO_ASSIGN` | com.onemapmaplibre |

UDID_TO_ASSIGN and SERIAL_TO_ASSIGN are unresolved prerequisites, not literal dispatch values. Despite --no-packager, these commands build, install and launch. Record their input identities and produced binary before flows. For Android, compare the produced APK with installed base.apk obtained through the assigned serial's pm path and pull. For iOS, compare the produced CFBundleExecutable with the installed app container's executable. Hash equality and the actual linked SDK inventory form the coordinator's gate; historical binary hashes cannot substitute.

TF07 owns its Metro process and launches the installed app after checking the installed hash. Bind TF07_METRO_PORT=8081, TF07_NATIVE_BINARY_SHA256 to the independently verified installed binary, TF07_IOS_UDID or ANDROID_SERIAL to the assigned target, and TF07_MANUAL_REPORT to a unique nonexistent result path. The driver creates its receipt with exclusive creation and a fresh runId. All thirteen outcomes are required for each environment: live-child-button, nested-scroll, live-activation, annotation-activation, offset-touch-bounds, popup-follow-dismissal, map-feature-click, navigation-location, style-remount, host-accessibility, sdk-ornaments, camera-target-and-gesture and marker-prop-rejection. Preserve installedBinarySha256, libraryDistSha256, environment and runId when recording observations.

TF09 serves its fixture; it does not build, install, start Metro or launch the app. After TF07 cleanup, start owned Metro from the selected shell with ONE_MAP_SMOKE=tf09 and `bun run start -- --port 8081 --reset-cache`. Changing ONE_MAP_SMOKE requires a Metro restart/reset because Babel inlines it. Launch the selected installed app with the assigned target. Android needs owned reverse mappings for tcp:8081 and tcp:8798; iOS uses simulator loopback. Restore only mappings owned by this attempt.

Bind TF09_LIBRARY_SHA256 to the candidate's dist digest, TF09_OUTPUT to a unique environment result JSON, TF09_RUNTIME_NODE_MODULES to a reviewed runtime directory containing package.json and pngjs, TF09_NATIVE_IDENTITY to the externally verified binary/build identity, and TF09_PEER_EVIDENCE to the reviewed patched-file inventory. The reviewed native-peer-evidence.json inventory is prepared and all 44 expected patched files match. The isolated pngjs 7.0.0 runtime is prepared and its encode/decode roundtrip passed; its bytes are recorded in the preparation handoff. Generated projects, Pods, Gradle resolution, linked binaries and assigned targets remain future inputs. Expected patched bytes must come from reviewed reconciliation evidence; hashing arbitrary installed files cannot establish the expected identity.

The estimated allowance is 2-4 hours with warm caches, including serial native builds/flows and 52 manual receipts. Fresh framework, dependency or build caches can exceed four hours. This candidate has no measured native duration; host setup, diagnosis and retries are excluded. Driver timeouts are limits rather than predictions.

## Resource ownership and failure handling

One GPT-6 Luna worker at medium reasoning must exclusively own Metro port 8081, fixture ports 8797-8799, native build directories, simulator/emulator targets, installations and input tools. All four environments run sequentially. The worker reports its first attempt and stops at the first failed command or unexpected identity mismatch. It makes no source changes and chooses no whole-command retry.

The coordinator verifies the archive, templates, consumers and resolved peers before dispatch. Produced native binaries and installed readback must match before any scenario uses them. TF07 requires all thirteen run-bound manual receipts from [the smoke contract](../scripts/tf07-smoke-contract.mjs), together with real fixture readback. TF09 requires coordinator verification of the produced and installed binary outside the driver; a truthy TF09_NATIVE_IDENTITY string alone is insufficient.

## Permission boundary

The current proposal is conditional and cannot authorize runnable acceptance. The owner must first authorize the prerequisite fixture/coverage repairs and host setup, and settle the remaining scope and operator gates. A later acceptance permission request must name the completed preparation checkpoint, exact candidate, four target identities, source-backed commands, expected duration and first-failure stop. Any required native generation, build, installation, Metro transport, device boot and flow work must be explicitly included. Until those inputs and independent review are complete, native execution remains unverified and awaits permission.

Physical devices, full VoiceOver/TalkBack audits, sensor certification and unenumerated TF08 raw-service operations remain excluded. The owner-excluded RNMapbox invalidateAmbientCache and setMaximumAmbientCacheSize operations retain their exclusions. Approval grants no merge, tag or registry publication. The [testing policy](testing-policy.md#acceptance-timing-and-user-permission) owns permission and retry rules; its [retention policy](testing-policy.md#storage-and-tooling) requires compact outcome/provenance records and cleanup of temporary consumers, caches, binaries and nonessential logs after the checkpoint.
