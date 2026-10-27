# Candidate acceptance proposal

**Prepared candidate; execution is not authorized.** U24 has prepared the reviewed candidate after reconciliation PR44, exact isolated inputs and the source-backed acceptance proposal below. Independent final preparation review passed with no substantive findings; a reviewed U24 PR is authorized. U25 remains undispatched. The next permission decision covers one first-attempt serial sequence of nine web commands only; native generation, Metro, builds, installations and flows require later separate permission after web result approval and target readiness.

## Frozen routine artifact

| Field | Prepared identity |
| --- | --- |
| Archive | one-map-react-0.1.0-rc.2.tgz |
| SHA-256 | `408c451d9b8da4642acd1843be1282e88259445f2a8879293682c2598d2a1f79` |
| Byte audit | All 171 archive files match the frozen publication tree, including 164 dist files and the frozen README. |
| Routine archive checks | 13 package cases, eight minimum-peer cases and eight RNMapbox 10.3.8 endpoint cases passed on this archive. |

This is the reviewed candidate/rehearsal identity, not a registry release-version decision or accepted renderer artifact. The preserved original rc.11 archive is unchanged. These byte/package/declaration/patch-application checks do not establish browser/GPU execution, Metro transport, native builds/linking or renderer acceptance. Reviewed native observability fixtures and the isolated execution/resource/timing/retry packet are prepared; independent final candidate review passed for this preparation scope.

The [unit plan](revised-api-implementation-plan.md#u24-freeze-a-candidate-and-prepare-acceptance) owns the checkpoint gates, and the [testing policy](testing-policy.md#acceptance-timing-and-user-permission) requires explicit permission for the prepared artifact and scope before U25. Earlier TF/rc acceptance remains attached to its recorded artifacts; routine tests, declarations, static/stubbed native proofs and package selection do not renew renderer acceptance.

The proposal must distinguish the two web backends and the four native OS/backend environments, actual publication consumer inputs, native linked SDK identity, separate web/native approval gates and exclusive sequential native resources. The existing publication native consumers use RN 0.87.1 and Teleport 1.2.1; the development Expo host uses RN 0.86.3. These are distinct host scopes, not permission to relax declared ranges or infer native compatibility.

The source-backed argv, exact known environment bindings, isolated input identities and timing basis appear below. Native host readiness and future generated/resolved/build/installed identities remain later gates, not missing web preparation. [Candidate evidence](../records/evidence/revised-api-u24-candidate.json) owns compact provenance and routine outcomes; registry version selection/publication remains a separate decision.

## Isolated consumer inputs

The prepared harness uses local copies of the exact candidate in four independently installed shells. All four resolve 171 verified archive members and the same dist digest, `e884b92cf6e20d46c05897512ebe88ba930f1f8cd774f98c1550e561b08dc7a6`. Install scripts were disabled; these observations do not establish native scaffolding, linking or app installation. Candidate evidence retains the resolved manifest, lock and patched-file identities.

| Acceptance environments | Prepared shell | Resolved tuple |
| --- | --- | --- |
| Mapbox web | examples/web-mapbox | React/React DOM 19.2.3, react-map-gl 8.1.3, mapbox-gl 3.32.0 |
| MapLibre web | examples/web-maplibre | React/React DOM 19.2.3, react-map-gl 8.1.3, maplibre-gl 6.13.0 |
| Mapbox iOS and Android | examples/native-mapbox | React 19.2.3, RN 0.87.1, Teleport 1.2.1, RNMapbox 10.3.7 |
| MapLibre iOS and Android | examples/native-maplibre | React 19.2.3, RN 0.87.1, Teleport 1.2.1, MapLibre Native 11.5.0 |

The prepared entry variants route each shell through the existing mixed-selection consumer while preserving raw selected imports. Mapbox web and MapLibre native use examples/mixed/mapbox-web-maplibre-native; MapLibre web and Mapbox native use examples/mixed/maplibre-web-mapbox-native. Native entries explicitly import setup.native.js, which resolves the corresponding setup.native.ts; the first failed generic-import resolver probe is retained. Runtime backend guards and U24_SELECTION logs must agree with the actual renderer in the authorized run. Static web graphs and filesystem-context Metro resolver observations support this mapping but do not establish Metro transport or mixed renderer acceptance.

## Native composition limitation

A pure Node probe using the React Native 0.87.1 schema generator found three duplicate global declarations when RNMapbox 10.3.7 and MapLibre Native 11.5.0 were co-installed: NativeMapViewModuleSpec, NativeMapViewModuleSpecBase and NativeMapViewModuleSpecJSI. The equivalent RNMapbox 10.3.8 plus MapLibre Native 11.5.0 probe passed. Preserve the failed 10.3.7 probe in candidate evidence; neither result is an actual native build/link result or renderer acceptance.

The retained mixed-selection contract covers Mapbox web with MapLibre native, and MapLibre web with Mapbox native. It does not require co-installing both native SDKs. The proposed native baseline has four independent environments (Mapbox iOS/Android and MapLibre iOS/Android), each with one native SDK. The 10.3.7 co-installation finding does not authorize another patch or peer-range change; it remains a documented composition limitation.

The development Expo host uses RN 0.86.3 and RNMapbox 10.3.8. Its codegen or routine results do not establish acceptance on the proposed RN 0.87.1 baseline. Fresh resolved and linked native SDK identity remains unverified.

## Native fixture observations prepared for review

The reviewed TF07 fixture adds two mandatory manual receipt scenarios while retaining the existing eleven. These are acceptance requirements to execute only after permission, not observed native results from preparation. Requested target labels and callback logs are not renderer proof.

| Receipt scenario | Source-backed controls | Observation required after authorization |
| --- | --- | --- |
| camera-target-and-gesture | Target A (-122.34, 47.61), Target B (-122.32, 47.615), Repeat target, Clear target, Read renderer and Zoom in | Read the actual renderer center/zoom independently of requested labels. Observe changed A/B targets, gesture movement persisting while a target is unchanged, a repeated equal-content target not rolling the camera back, clearing the target releasing it, and an explicit zoom command changing observed zoom. |
| marker-prop-rejection | Reject view draggable, Reject view callback, Reject annotation draggable, Reject annotation callback and Clear rejection | Each deliberate request is rendered inside the Map context and must display the actual native rejection rather than an unrelated missing-context error. Clear rejection must remove the probe without replacing the Map. |

The expected guard message is: Native Marker does not support dragging. Use a selected raw native annotation for SDK dragging. The view/annotation probes exercise draggable and onDrag separately; they do not revive shared native dragging or replace retained live-child/annotation interaction checks.

Every native receipt must match installedBinarySha256, libraryDistSha256, environment and runId for the verified installed binary/library run. All thirteen scenario outcomes must be recorded; missing or failed observations cannot produce acceptance. The old eleven names and existing known-feature/readback/event requirements remain intact. Focused mocked fixture and receipt tests establish wiring/identity requirements only. The run-bound producer, output and observation procedures below form the proposed native scope for a later separate permission decision.

## Source-backed command inventory

The following argv and scheduling constraints come from the inspected drivers and frozen packet. They are proposed acceptance commands, not commands executed during preparation. Run only from the isolated harness, never from the original dirty checkout or an overlay that can resolve its stronger SDK patches. Candidate evidence records the frozen source/lock/dependency/resolver/SDK inputs and tool identities.

The prepared harness root is /private/tmp/one-map-u24-3shiv2no/frozen-harness. It contains the exact 408c451d candidate extracted at packages/one-map-react. Native installed-binary identity and target readiness are not established by that library extraction.

### Web driver argv and resource ownership

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

One proposed GPT-6 Luna worker at low reasoning runs all nine web commands serially, including both TF07 and TF09 engine commands. TF04/TF05/TF06 commands internally exercise both engines; there is no invented per-engine selector. The serial schedule preserves exclusive ownership of the shared fixture port 8798 and all listed server/debugger ports. Keep original app/dev servers outside these reserved resources. Stop at the first failed whole command.

The exact environment/cache/output bindings below are part of each invocation; bare argv is insufficient. In particular, both TF09 web commands require TF09_OUTPUT, TF09_LIBRARY_SHA256 and TF09_RUNTIME_NODE_MODULES.

### Exact invocation bindings

All nine web rows run from /private/tmp/one-map-u24-3shiv2no/frozen-harness. Prepend `/Users/rob/.local/share/vite-plus/package_manager/bun/1.4.1/bun/bin:/Users/rob/.local/share/vite-plus/js_runtime/node/24.22.1/bin` to inherited PATH for every command and child process. Verify Bun 1.4.1 and Node 24.22.1 executable identities against candidate evidence before execution; mismatch stops for the coordinator. The isolated installs used Bun 1.4.4, recorded separately; they are not claimed to have used the acceptance runtime. The configured Chrome 155.0.8059.85 executable is frozen in evidence and was not launched during preparation.

Before every command, run `node /private/tmp/one-map-u24-3shiv2no/verify-frozen-inputs.mjs` with that PATH. It verifies the frozen 326 source files and 46,736 initial input files/links. The source manifest SHA-256 is 69f8541003c2f871d3fcdfad1592c8917924b9bb5ceba6df837ab51d42a39a92; the initial-input manifest SHA-256 is e9a212457423d2f0f8920ad8e96f66187ffc13f508b0188a420f7425b545e008. Recheck the table's ports with a read-only listener inventory before each command: free or explicitly tracked current-run ownership is required; stop on an unknown listener. The preparation inventory found no web listeners, which does not replace the run-time preflight.

The coordinator injects the existing public token through MAPBOX_ACCESS_TOKEN without copying .env or recording the secret. Its network validity has not been exercised. The following additional bindings are exact. Paths are temporary run resources; they do not change package/source contracts.

| Web row | Additional environment | First-attempt stdout record |
| --- | --- | --- |
| 1 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf04 | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-01.log |
| 2 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf04-corrections | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-02.log |
| 3 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf05 | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-03.log |
| 4 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf05-corrections | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-04.log |
| 5 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf06 | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-05.log |
| 6 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf07-mapbox | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-06.log |
| 7 | ONE_MAP_SMOKE_CACHE_ROOT=/private/tmp/one-map-u24-3shiv2no/runtime/cache/tf07-maplibre | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-07.log |
| 8 | TF09_LIBRARY_SHA256=e884b92cf6e20d46c05897512ebe88ba930f1f8cd774f98c1550e561b08dc7a6; TF09_OUTPUT=/private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-mapbox-tf09.json; TF09_RUNTIME_NODE_MODULES=/private/tmp/one-map-u24-3shiv2no/runtime-tools | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-08.log |
| 9 | TF09_LIBRARY_SHA256=e884b92cf6e20d46c05897512ebe88ba930f1f8cd774f98c1550e561b08dc7a6; TF09_OUTPUT=/private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-maplibre-tf09.json; TF09_RUNTIME_NODE_MODULES=/private/tmp/one-map-u24-3shiv2no/runtime-tools | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/web-09.log |

Rows 1-7 have distinct explicit cache roots. TF09 creates its own unique one-map-rendering- temporary root/profile and sets ONE_MAP_SMOKE_CACHE_ROOT internally; no ineffective external TF09 cache override is proposed. All drivers create temporary browser profiles. Output parent directories are prepared; first-attempt results must remain distinct from any later separately authorized attempt. TF09_RUNTIME_NODE_MODULES is the runtime-tools directory containing package.json, not its node_modules child; both web TF09 rows and native TF09 use it to load pngjs 7.0.0.

### Native driver argv and resource ownership

Native permission is a later gate after web result sign-off. One proposed GPT-6 Luna worker at medium reasoning exclusively owns Metro, ports 8081/8797/8798/8799, simulator/emulator input, build directories, installations and logs. All native engines/platforms run sequentially.

| Proposed command | Driver responsibility |
| --- | --- |
| `bun scripts/tf04-camera-smoke.mjs ios` | Builds/installs and interacts with both engine shells sequentially; starts Metro. Explicit native permission required. |
| `bun scripts/tf04-camera-smoke.mjs android` | Builds/installs and interacts with both engine shells sequentially; starts Metro. Explicit native permission required. |
| `bun scripts/tf05-sources-smoke.mjs ios` | Builds/installs and interacts with both engine shells sequentially; starts Metro. Explicit native permission required. |
| `bun scripts/tf05-sources-smoke.mjs android` | Builds/installs and interacts with both engine shells sequentially; starts Metro. Explicit native permission required. |
| `bun scripts/tf06-queries-smoke.mjs ios` | Builds/installs and interacts with both engine shells sequentially; starts Metro. Explicit native permission required. |
| `bun scripts/tf06-queries-smoke.mjs android` | Builds/installs and interacts with both engine shells sequentially; starts Metro. Explicit native permission required. |
| `bun scripts/tf06-queries-smoke.mjs ios lifetimes mapbox` | Per-engine lifetime path; native resource owner remains exclusive. |
| `bun scripts/tf06-queries-smoke.mjs ios lifetimes maplibre` | Per-engine lifetime path; native resource owner remains exclusive. |
| `bun scripts/tf06-queries-smoke.mjs android lifetimes mapbox` | Per-engine lifetime path; native resource owner remains exclusive. |
| `bun scripts/tf06-queries-smoke.mjs android lifetimes maplibre` | Per-engine lifetime path; native resource owner remains exclusive. |
| `bun scripts/tf07-ui-smoke.mjs ios mapbox` | Verifies installed binary and all 13 identity-bound receipts; does not build the app. |
| `bun scripts/tf07-ui-smoke.mjs ios maplibre` | Verifies installed binary and all 13 identity-bound receipts; does not build the app. |
| `bun scripts/tf07-ui-smoke.mjs android mapbox` | Verifies installed binary and all 13 identity-bound receipts; does not build the app. |
| `bun scripts/tf07-ui-smoke.mjs android maplibre` | Verifies installed binary and all 13 identity-bound receipts; does not build the app. |
| `bun scripts/tf09-rendering-smoke.mjs ios mapbox` | Advanced fixture/server/renderer actions; app must be independently prepared/launched with ONE_MAP_SMOKE=tf09. The driver does not build or start the native app. |
| `bun scripts/tf09-rendering-smoke.mjs ios maplibre` | Advanced fixture/server/renderer actions; app must be independently prepared/launched with ONE_MAP_SMOKE=tf09. The driver does not build or start the native app. |
| `bun scripts/tf09-rendering-smoke.mjs android mapbox` | Advanced fixture/server/renderer actions; app must be independently prepared/launched with ONE_MAP_SMOKE=tf09. The driver does not build or start the native app. |
| `bun scripts/tf09-rendering-smoke.mjs android maplibre` | Advanced fixture/server/renderer actions; app must be independently prepared/launched with ONE_MAP_SMOKE=tf09. The driver does not build or start the native app. |

TF07 native invocations require TF07_NATIVE_BINARY_SHA256 and TF07_MANUAL_REPORT, plus TF07_IOS_UDID on iOS or ANDROID_SERIAL on Android. TF09 native requires TF09_LIBRARY_SHA256, TF09_NATIVE_IDENTITY, TF09_OUTPUT, TF09_RUNTIME_NODE_MODULES and an explicit current TF09_PEER_EVIDENCE. Never fall back to historical peer evidence. The preparation/verification recipe and actual known input bindings appear below; future binary/target/output values must be produced or assigned under the relevant permission, not filled with historical identities.

The recorded iOS target metadata is iPhone18Pro, UDID 8B7D7CE4-228E-409F-A156-A597D4E448A5, iOS 27.0. Readiness is unconfirmed because a read-only simulator service query failed/hung; this is not an observed app failure. Android emulator serial remains unassigned. Live target readiness and run-bound build/binary identities must be established for the separately authorized native phase. No boot, build, installation or device gesture was performed during this preparation.

### Expected elapsed time and retry scope

Web budget: 20-40 minutes including artifact verification and renderer interactions. Native budget: 2-4 hours with warm caches for sequential four-environment builds, all 13 manual UI receipts and advanced/lifetime scopes. Fresh framework/build caches can add 20-60 minutes per build and push elapsed time beyond four hours. These are source-backed planning estimates, not measured U24 results.

The basis is the recorded TF04-TF06 warmed-command budgets, TF06 per-lane times/fresh-build estimate, TF07 Android builds of 4m22s and 6m50s with a prior failed preparation of 10m37s, and TF09's 2-5 minutes/browser, 3-8 minutes/installed-native and 20-60 minutes/fresh-build estimates. Candidate evidence owns the exact source records and assumptions; none transfers historical acceptance to this artifact.

Retain the first whole-command attempt. Stop at the first failed command and return diagnosis to the coordinator. Workers do not edit source or choose their own restart/retry. Existing bounded polling/fit attempts inside one command are recorded separately from a new command attempt. A changed archive, harness or native binary needs review and new relevant permission; a passing retry never erases the original failure. Retain compact outcome/identity evidence and keep raw logs/screenshots only while an active investigation needs them.

### Permission and remaining native gates

The final packet and static input freeze are complete and independently audited. U24 stops before U25: explicit owner permission is required for the nine-command web sequence on these exact inputs. Native target readiness/Android serial remain unconfirmed; web result approval and separate native permission must precede generation/build/install/Metro/flows. Future resolved template/SDK and built/installed binary identities are outputs of that separately authorized recipe. The existing drivers exercise the prepared opposite mixed-selection entries; no dedicated mixed real-renderer driver is claimed.

This inventory does not silently include TF08 raw database/cache/sensor operations or revive removed common services/capture guarantees. Physical devices, full VoiceOver/TalkBack and sensor certification remain excluded. Native bounds reset, cached selected provider/pack status and other SDK-repair consequences are not all individually covered by named renderer cases; static/extracted-method proofs remain distinct. Any additional raw-service repair acceptance needs an explicitly enumerated isolated scope and separate permission. Independent final preparation sign-off is recorded; scoped web permission has not been granted. Native permission and web-result sign-off remain separate gates.

### Run-bound native output bindings

These output names reserve future native receipts and identities; no native binary or generated template is asserted to exist. Under later native permission, each environment produces and verifies its own native identity JSON before supplying TF07_NATIVE_BINARY_SHA256 from installedBinarySha256 or TF09_NATIVE_IDENTITY as compact JSON text. Set TF07_METRO_PORT=8081; use TF07_IOS_UDID=8B7D7CE4-228E-409F-A156-A597D4E448A5 only after readiness confirmation, or the actual assigned ANDROID_SERIAL. All native commands inherit the exact acceptance PATH above.

| Environment | Verified identity producer file | TF07_MANUAL_REPORT | TF09_OUTPUT |
| --- | --- | --- | --- |
| mapbox-ios | /private/tmp/one-map-u24-3shiv2no/runtime/native-identities/mapbox-ios.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/mapbox-ios-tf07-manual.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/mapbox-ios-tf09.json |
| mapbox-android | /private/tmp/one-map-u24-3shiv2no/runtime/native-identities/mapbox-android.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/mapbox-android-tf07-manual.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/mapbox-android-tf09.json |
| maplibre-ios | /private/tmp/one-map-u24-3shiv2no/runtime/native-identities/maplibre-ios.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/maplibre-ios-tf07-manual.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/maplibre-ios-tf09.json |
| maplibre-android | /private/tmp/one-map-u24-3shiv2no/runtime/native-identities/maplibre-android.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/maplibre-android-tf07-manual.json | /private/tmp/one-map-u24-3shiv2no/runtime/results/first-attempt/maplibre-android-tf09.json |

TF07 receipt paths must not already exist; the runner writes exclusively. Native TF09 uses the same exact dist and PNG bindings as web, plus TF09_PEER_EVIDENCE=/private/tmp/one-map-u24-3shiv2no/tf09-current-peer-evidence.json. That current pristine-derived attestation's full reviewed file list/hash remains in candidate evidence. TF09_NATIVE_IDENTITY must come from the verified environment-specific producer file, not a requested SDK pin or historical binary.

After the owned TF09 Metro is ready, the iOS launch command is `xcrun simctl launch <confirmed UDID> <application ID> -RCT_jsLocation 127.0.0.1:8081`. Android uses `adb -s <assigned serial> reverse tcp:8081 tcp:8081`, then the equivalent reverse for tcp:8798, then `adb -s <assigned serial> shell am start -n <application ID>/.MainActivity`. Use only the application IDs in the recipe below. These are later native operations, not U24 actions.

## Native preparation recipe for a later permission gate

These are proposed future commands, not preparation performed during U24. Run from the isolated harness root unless a shell directory is specified. Native generation, dependency resolution, builds, installations and Metro execution require separate native permission after web result approval. Native target readiness remains a distinct open gate.

Before every native command, the exclusive worker must perform a read-only ports-free/owned-process preflight for the reserved resources and stop on an unknown existing listener. Track every process started for this run. Legacy TF04/TF05/TF06 native drivers unconditionally send SIGTERM to PIDs found on ports 8081/8799; permission must not authorize killing unrelated host processes or repairing the host. A free port or a known run-owned process is a mandatory precondition, not an assumption. The web-only command branches do not enter these native cleanup paths.

| Step | Exact source-backed command or procedure | Identity/ownership requirement |
| --- | --- | --- |
| Generate Mapbox shell | `bun scripts/setup-native-example.mjs native-mapbox` | Uses pinned CLI 20.2.0 and requests RN 0.87.1; record the actual resolved template version/integrity and generated project hashes. |
| Generate MapLibre shell | `bun scripts/setup-native-example.mjs native-maplibre` | Same template identity requirement; one native SDK per shell. |
| Prepare iOS dependencies | `bundle install` from the selected shell, then `bundle exec pod install` from its ios directory | Record actual resolved CocoaPods/SDK identity, separately from requested pins. |
| Build/install/launch iOS | `bun run ios -- --no-packager --port 8081 --udid <confirmed simulator UDID>` from the selected shell | This builds, installs and launches. The placeholder must be replaced by a confirmed ready target before native permission. |
| Build/install/launch Android | `bun run android -- --no-packager --port 8081 --device <assigned emulator serial>` from the selected shell | This builds, installs and launches. Assign the actual ready serial before native permission; record resolved Gradle dependencies. |
| Prepare TF07 Metro | Let the TF07 driver start `bun run start -- --port 8081 --reset-cache` with ONE_MAP_SMOKE=tf07 | Do not start a competing Metro. The driver launches the verified installed app. |
| Prepare TF09 Metro | `ONE_MAP_SMOKE=tf09 bun run start -- --port 8081 --reset-cache` from the selected shell | The native resource owner starts this separately, then builds/installs/launches the app. The TF09 driver does not perform those steps. |

The generator copies the selected ios/android/Gemfile scaffolding and applies existing project transforms/pins; it does not install JS dependencies, resolve CocoaPods, build, install an app or start Metro. Preserve the already prepared exact-archive JS consumers. Requested CLI/RN versions do not establish the actual template bytes or linked SDK identity. Record those future outputs and stop if they differ from the reviewed inputs before continuing the native phase.

For each authorized build, freeze the produced APK or iOS CFBundleExecutable hash with its build inputs. On Android, use `adb -s <serial> shell pm path <application ID>`, select base.apk, pull it to a temporary installed.apk and require its SHA-256 to equal the frozen produced APK. On iOS, use `xcrun simctl get_app_container <UDID> <application ID> app`, read CFBundleExecutable from Info.plist and require the installed executable hash to equal the frozen built identity. Application IDs are com.onemapmapbox/com.onemapmaplibre on Android and org.reactjs.native.example.OneMapMapbox/org.reactjs.native.example.OneMapMaplibre on iOS. No future binary hash exists yet; historical hashes must not substitute for this producer/verification procedure.

TF07_NATIVE_BINARY_SHA256 is that verified executable/APK SHA-256. Set TF07_MANUAL_REPORT to a unique nonexistent temporary JSON pathname; the driver creates it exclusively, generates a new runId and initializes all thirteen scenarios unverified. The operator records actual observations while preserving installedBinarySha256, libraryDistSha256, environment and runId. The driver repeats installed-binary verification. Failed or missing scenarios cannot pass. Its default 3600000 ms native timeout is an internal bound, not the expected elapsed time.

For TF09 web and native, set TF09_LIBRARY_SHA256 to e884b92cf6e20d46c05897512ebe88ba930f1f8cd774f98c1550e561b08dc7a6, TF09_OUTPUT to the environment-specific temporary result pathname above and TF09_RUNTIME_NODE_MODULES=/private/tmp/one-map-u24-3shiv2no/runtime-tools (prepared pngjs 7.0.0). Native additionally uses TF09_PEER_EVIDENCE=/private/tmp/one-map-u24-3shiv2no/tf09-current-peer-evidence.json and a coordinator-owned TF09_NATIVE_IDENTITY tied to the verified build/installed binary. The driver only requires TF09_NATIVE_IDENTITY to be truthy and records it; it does not verify that binary. External installed-identity verification is mandatory before invoking the driver.

The explicit current peer attestation records reviewed expected patched destination paths/hashes for 31 RNMapbox files and 13 MapLibre files, verified against the selected installed consumer. Do not self-attest arbitrary installed bytes or use historical default evidence. The library digest concatenates sorted dist-relative paths (including their leading slash) and raw file bytes without added separators; it is distinct from the archive hash. Candidate evidence retains the current attestation and digest provenance.

For Android TF09, the exclusive native owner reverses tcp:8081 and tcp:8798 to the host before launch. The iOS simulator uses loopback. The fixture polls 127.0.0.1:8798/command; the TF09 driver owns that server. ONE_MAP_SMOKE is Babel-inlined, so a scenario change requires the owned Metro to restart with reset-cache. Confirm actual app startup/fixture readiness before renderer commands, and preserve first-attempt failures.

## Current native manual receipt mapping

These thirteen scenario IDs are mandatory per installed binary/environment/run. The old eleven names are preserved, but their current observations follow the narrower implemented contract rather than retired source bubbling, common control or native drag guarantees.

| Receipt ID | Current observation after authorization |
| --- | --- |
| live-child-button | Physically activate the live marker's Child button and observe its effect. |
| nested-scroll | Physically scroll text in the nested ScrollView. |
| live-activation | Tap the outer live marker and observe its actual counter. |
| annotation-activation | Tap the annotation and observe its actual counter. |
| offset-touch-bounds | Use offset [24, -12]; inspect shifted content and its actual hit region. |
| popup-follow-dismissal | Observe the application-owned Marker bubble and accessible Close popup action; no removed common focus/dismissal/maxWidth guarantee is asserted. |
| map-feature-click | Observe Map.onClick filtered feature 707 at the actual logical point; no Source bubbling. |
| navigation-location | Exercise application Zoom/Reset north and the injected one-shot application location/display input; no library following/acquisition or sensor certification. |
| style-remount | Use current style/remount controls and verify ordinary children, providers and touches. |
| host-accessibility | Inspect available host/button labels, roles and target size; this is not a full VoiceOver/TalkBack audit. |
| sdk-ornaments | Observe selected native scale/compass/legal defaults and application-owned placement. |
| camera-target-and-gesture | Perform the explicit target/gesture/readback sequence below. |
| marker-prop-rejection | Perform all four guarded requests and recovery checks below. |

### camera-target-and-gesture procedure

1. Press Target A then Read renderer; actual center near [-122.34,47.61], requested label alone does not pass.
2. Physically pan an empty map region, then Read renderer; actual center must differ from A.
3. Press Repeat target (fresh object with identical primitive fields), then Read renderer; camera must remain at panned center rather than snap back.
4. Press Target B then Read renderer; actual center near [-122.32,47.615]. Pan again and repeat B; actual pan must remain.
5. Press Target A again then Read renderer; actual center returns near A (A/B/A target change applies).
6. Press Clear target, then existing Zoom in and Read renderer; requested label none, actual zoom increases, no target rollback.
7. Clear target and remount before completing ordinary TF07 feature/marker receipts; actual fixture feature707 and normal touch flow must still pass.

### marker-prop-rejection procedure

1. For EACH Reject view draggable, Reject view callback, Reject annotation draggable, Reject annotation callback: press once and observe that exact case label plus actual Native Marker does not support dragging message. Waiting, Unexpected rejection or Unexpected drag callback is a failure.
2. After EACH attempt press Clear rejection; result must become No rejection requested while the same map remains mounted. Physically pan/read and activate ordinary marker child to confirm gestures/activation remain usable.
3. These are unsupported common-prop guard observations; they do not restore native facade dragging. The boundary wraps only the deliberate Marker inside Map context.
