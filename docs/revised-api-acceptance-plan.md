# Acceptance proposal

**All nine approved browser rows passed on the refreshed PR19 candidate; native readiness and acceptance remain unverified.** This proposal records the completed browser gate and owns the separate later native gates. The [impact evidence](../records/evidence/pr19-acceptance-impact.json) binds the preparation; the [current browser outcome](../records/evidence/revised-api-u25-web-attempt-07.json) owns runtime results. No browser, native or host-readiness command ran during this refresh.

The [historical browser outcome](../records/evidence/revised-api-u25-web-attempt-05.json) records all nine rows passing on f04, with commands 1-2 from attempt04 and commands 3-9 from approved recovery. That outcome is unchanged and does not certify f05. Earlier interrupted and failed attempts remain unchanged. Their retired browser harness and runtime tools are not current execution inputs.

## Candidate and scope

| Field | Identity | Verification boundary |
| --- | --- | --- |
| Archive | artifacts/revised-api-u25-f05/one-map-react-0.1.0-rc.2.tgz | New durable archive; f04 remains unchanged. |
| Archive SHA-256 | 33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276 | Exact archive bytes from a fresh library build and scripts-disabled pack. |
| Dist digest | f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5 | Exact TF07/TF09 sorted-path and raw-byte algorithm. |
| Source basis | Merged main cbacadfb1213eaf9a50efd3e33a06ba592ebf530 | PR19 retained compiler changes plus current harness repairs. |
| Package contents | 171 members, including 164 dist files | Exactly five JavaScript members changed from f04; all declarations and other members match. |
| Contract and dependency inputs | Unchanged exports, API declarations, peers, repository locks, version and patches | No new runtime or native readiness claim. |

PR19 changes useFrozenValue across initial camera and marker anchors, useStableOptions across map/source/layer/marker creation, the shared Map attachment proxy, web padding and native marker overlay compilation. Browser camera/correction, source/correction, query, UI and rendering rows therefore all receive fresh coverage. Named-map proxy detach/replacement is covered by routine mocks; the browser corrections row does not assert that observation. Native camera, sources, queries and core/retained UI remain future four-environment coverage; web padding is web-only and overlay compilation is native-only. No retired API is restored.

## Browser outcome

All nine approved browser rows passed on the unchanged f05 candidate. The [current outcome](../records/evidence/revised-api-u25-web-attempt-07.json) combines rows 1-4 from attempt06 with rows 5-9 from the separately approved continuation. The [partial attempt](../records/evidence/revised-api-u25-web-attempt-06.json) preserves the worker working-directory error before row 5 started. No passing row was repeated. Commands 6-9 reported the expected f05 dist digest; the post-run check verified all 13,155 frozen inputs, free reserved ports and no owned runner processes.

The completed scope covers both web engines through the original nine rows: camera, padding/gesture corrections, sources/images, lifecycle corrections, queries/state, UI and targeted rendering. Detailed observations and unexercised areas remain in the outcome record. Named-proxy detach/replacement remains mocked coverage; web results do not establish native overlay behavior or broader accessibility, sensor and service guarantees.

The completed packet and continuation hashes are historical provenance in the outcome record. Their browser consumers, caches, runtime tools and raw logs are retired after audit. Any future browser rerun requires current preparation and separate approval. The durable f05 archive, compact outcomes and native recovery inputs remain available.

The next decision is host readiness under the separate scope below. The recreated native consumers pass bounded static proofs against f05; host and full native execution still require separate approvals. No host, native build/install or Metro permission is implied by the completed browser run.

The native scope remains four independent single-SDK environments: Mapbox iOS, Mapbox Android, MapLibre iOS and MapLibre Android. The proposed baseline retains React Native 0.87.1, RNMapbox 10.3.7 or MapLibre React Native 11.5.0 and Teleport 1.2.1. Requested pins do not establish resolved, linked or installed identities.

## Native composition limitation

The retained mixed-selection contract covers Mapbox web with MapLibre native and MapLibre web with Mapbox native. It does not require co-installing both native SDKs. The [candidate record](../records/evidence/revised-api-u24-candidate.json) preserves the RN 0.87.1 pure-Node codegen collision with RNMapbox 10.3.7 plus MapLibre 11.5.0 and its passing 10.3.8 control. Neither control is build/link or renderer acceptance. The maintained Expo host's RN 0.86.3 and RNMapbox 10.3.8 results do not certify this proposed baseline.

## Prepared inputs and remaining gates

The [current preparation evidence](../records/evidence/revised-api-u25-f05-native-preparation.json) binds two recreated isolated consumers to the unchanged f05 archive and tracked source at 9c67ee3531695ff2c32acce9c012c3bd1ebe61bf. The current harness is /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/native-harness; the direct runtime directory is /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/runtime-bin. Both fresh Bun 1.4.1 installs used --frozen-lockfile --ignore-scripts, retaining each recovery manifest and lock byte. They resolve React Native 0.87.1, React 19.2.3, Teleport 1.2.1, CLI 20.2.0 and only RNMapbox 10.3.7 or MapLibre 11.5.0. No native project was generated.

All 171 archive members and the 164-file dist digest match the root and both installed consumers. Forty-four expected patched peer files match independent pristine registry archives verified against the reviewed integrity identities, then patched with the unchanged reviewed publication patches. Actual installed Metro proves four platform-specific capture selections, generic/web/error controls, both mixed selections and their selected packed entries. Installed Babel transforms both actual App/selector/retained-screen graphs; the thirteen-core/six-retained contract tests and PNG 7.0.0 pixel roundtrip pass. These are static/mocked proofs, with no Metro server or native module execution. Temporary variants change only the selected adapter import/guard in each App and add the existing mixed directory to each consumer's Metro watchFolders; tracked source and archive remain unchanged.

The new local input inventory has 33,966 entries and SHA-256 9c70ef930a3aa7362ae22f84ffcc9cd89782b5962761ec1442d85929434b842f. It freezes tracked-source copies, extracted/installed packages, dependencies, unchanged temporary manifests/locks, variants, proof code/results, PNG runtime and direct runtime identities. The historical f04 native consumers and their freeze remain superseded. The browser inputs remain retired. Generated projects, native locks, linked SDKs and binary identities are future inputs; this inventory does not make the full native run ready to dispatch.

The separate retained fixture and six-receipt contract cover named simultaneous maps, provider/local state, delayed annotation image refresh, measured layout/orientation, isolated camera targets and actual density/touch bounds. The thirteen core receipts and the original rich focused fixture remain unchanged. The [supplemental operator procedure](tf07-ui.md#retained-native-supplemental-procedure) owns the physical steps. Source, mocked and static checks do not establish the required native observations.

Host readiness remains unresolved. Prior queries timed out or returned a CoreSimulator service connection failure; no successful available/booted inventory has been established. No Android AVD or avdmanager is configured. No usable available/booted iOS target or Android serial has been established. An operator and tools capable of the physical/visual receipts also require confirmation. Generated projects, native dependency resolutions, linked SDKs and produced/installed binary identities remain future inputs. None may be inferred from requested pins or JavaScript installs.

The proposed retained scope includes application location/UI through TF07 and capture used for TF09 rendering observations. Broader raw offline, cache, import, snapshot and service acceptance needs an explicit owner scope disposition; those operations remain unverified. Physical devices, full VoiceOver/TalkBack and sensor certification retain their exclusions.

## Next decision: host readiness

The [current f05 iOS attempt](../records/evidence/revised-api-u25-f05-ios-readiness-attempt-01.json) stopped at its first approved-driver failure. Xcode selection and Device Hub signature checks passed; simulator inventory timed out after ten seconds, emitting Install Started progress text. That historical attempt did not establish the component or status; the subsequent read-only diagnosis below identifies the correlated first-launch transaction. No assigned-device boot was requested, no cleanup was needed, and no Android, build or acceptance command ran. The prior packet is closed; diagnosis, a refreshed reviewed packet and new approval are required before any retry.

Host readiness requires separate approval after the completed browser gate. The [first host attempt](../records/evidence/revised-api-u25-host-readiness-attempt-01.json) stopped at the obsolete Simulator application lookup. The [iOS retry record](../records/evidence/revised-api-u25-ios-readiness-retry-02.json) stopped in executable preflight before any simulator command because the worker checked Devices instead of the Info.plist-declared DevicesTrampoline. Its corrected executable and Info.plist hashes match the reviewed identities. No target readiness or Android setup is established. Those outcomes remain unchanged.

### Read-only startup diagnosis and guarded query

The [first guarded inventory attempt](../records/evidence/revised-api-u25-f05-inventory-attempt-01.json) stopped in preflight without invoking simctl. Tool/version, archive and all 33,966 frozen inputs matched. The worker observed a PackageKit package_script_service process and treated its activity as uncertain; recent install lifecycle and active sandbox checks were empty. Process presence alone does not establish active installation. The helper was not terminated or changed. The current guard attempt is closed; the bounded follow-up assessment below informs a separate proposal and approval. Simulator and target readiness remain unverified.

The [startup diagnosis](../records/evidence/revised-api-u25-f05-simctl-diagnosis.json) strongly supports first-launch system provisioning consuming the ten-second inventory budget. The selected simctl is a shell launcher that may invoke xcodebuild -runFirstLaunch before delegating to the installed actual tool. Existing incident logs identify Xcode first-launch installation of bundled CoreTypes.pkg and XcodeSystemResources.pkg, including CoreSimulator replacement; PackageKit continued after the query timeout and recorded receipts and the transaction end. The historical parent chain and prior framework version were not captured. These observations establish provisioning activity, not current simulator health or successful target readiness. They do not establish a simulator-runtime download or its absence elsewhere.

The [helper assessment](../records/evidence/revised-api-u25-f05-packagekit-idle.json) found no evidence of active package work in its recorded window. PID 54547 matches the postinstall helper by executable and start time; its client connection was invalidated before the known transaction ended. Two samples 38.5 seconds apart showed sleeping state and unchanged accumulated CPU; the later complete process graph found no helper descendants. Recent filtered logs were empty. This supports observed quiescence consistent with an idle persistent XPC helper, with moderate confidence. Open-file visibility and XPC transaction counts remain unavailable; this does not establish a global absence of installation or guarantee future inactivity. No host repair or process termination is justified by these observations.

The installed framework reports 1174.9.2 and all 33,966 frozen entries plus tool/archive identities still match. The historical inventory-query-proposal.json remains immutable and unexecuted. The new proposed packet is /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/simctl-diagnosis/packagekit-idle/inventory-query-proposal-02.json; SHA-256 e39e294412462da6a8d701c0d1974028a5453c66baad6ed436e981ca761da77e. One exclusive GPT-6 Luna worker at medium reasoning would verify those identities, collect two process samples ten seconds apart with complete installer/helper descendant graphs and fresh installer logs, then recheck immediately before its single query. Mere presence of the positively correlated sleeping helper is allowed only with unchanged CPU totals, no descendants and no newer transaction/script evidence. Active indicators, changed identity or meaningful uncertainty stop preflight for read-only reassessment. Allow about two minutes including preflight. This new proposal requires explicit owner approval; no query ran during this assessment.

The exact proposed command is `/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/Resources/bin/simctl list --json`. Stop after its first result, including success, timeout, invalid JSON or unexpected installation/download output. Do not follow it with boot, GUI launch, first-launch installation, fallback, retry or service cleanup. Direct inventory can start or contact CoreSimulator and write ordinary caches/logs; process exit cannot prove that Apple-managed services stopped. Approval for this diagnostic query would not authorize explicit package/runtime installation, import or download. A valid inventory allows coordinator review of the exact target and runtime; boot readiness remains a separate future request. Android, builds, app installations, Metro and acceptance remain excluded.

### Deferred Android proposal

Android requires its own future approval; it is excluded from the next iOS-only request. For Android, the proposal downloads the official ARM64 [command-line tools archive](https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip), verifies SHA-256 835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e, and extracts it into this task's temporary host-tools directory. The archive is 156,083,281 bytes. This adds no SDK image and replaces no installed SDK or Android Studio files. Use Android Studio's existing Java runtime, the existing SDK at /Users/rob/Library/Android/sdk, and task-owned ANDROID_USER_HOME and ANDROID_AVD_HOME directories.

| Android step | Proposed command or gate | Required outcome |
| --- | --- | --- |
| ADB ownership preflight | Read-only listeners/process executable/version inventory on ports 5037/5554/5555, before any adb command or emulator boot | Unknown, unowned or mismatched ADB server stops this phase before adb can replace it. |
| Profile inventory | Temporary tool's `avdmanager list device` | The exact pixel_6 profile is listed; otherwise stop. |
| Create task-owned AVD | `avdmanager create avd --name one-map-u25 --package 'system-images;android-37.1;google_apis_playstore_ps16k;arm64-v8a' --device pixel_6` | Existing image revision 9; new task-owned destination; no --force or overwrite. |
| Boot assigned emulator | Existing SDK's `emulator -avd one-map-u25 -port 5554 -no-snapshot-save` | Ports 5554/5555 are free and owned exclusively by this task. |
| Readiness | Assigned serial's adb device, boot_completed, ABI, image/API, wm size and wm density queries | Exactly one assigned emulator-5554, boot complete within 180 seconds, actual size/density recorded. |

Only a free port 5037 and explicit host-readiness approval permit starting the exact existing SDK adb server. Record the owned daemon PID, executable path and version. Legacy bare adb commands must resolve to that same binary. Stop if another device appears; restore only owned forwards and terminate only the owned daemon.

### Closed iOS-only attempt recipe

The closed attempt proposed one exclusive GPT-6 Luna worker at medium reasoning, about five minutes, for the exact iPhone 18 Pro target 8B7D7CE4-228E-409F-A156-A597D4E448A5 on iOS 27.0. It includes no Android commands, native project generation, dependency resolution, build, installation, Metro, application launch or test input. Neither this preparation nor the prior failed attempts authorize execution.

The prepared machine-readable packet is /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/ios-readiness-packet.json. It binds literal argv/cwd/timeouts, the frozen inventory and a path-safe driver at /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/ios-readiness.py. Offline injected-runner checks passed success, first-failure, unowned-target and cleanup paths; its first actual outcome is recorded above; this reviewed recipe is not retry authorization. The worker first independently verifies the launch, packet, driver, Python and inventory hashes recorded in the preparation evidence, then uses the literal invocation in ios-readiness-launch.json. The driver requires the expected packet hash and verifies packet, plan, driver, Python and inventory identities before a host subprocess. The driver checks frozen input hashes before any subprocess and reserves a fresh result path before work. It records the failing step and uncertain ownership after a boot timeout.

| Order | Proposed command or preflight | Timeout |
| --- | --- | --- |
| 1 | Frozen input verification; Info.plist-derived CFBundleExecutable DevicesTrampoline, bundle com.apple.dt.Devices and recorded plist/executable hashes | Read-only preflight |
| 2 | `/usr/bin/xcode-select -p`, requiring /Applications/Xcode.app/Contents/Developer | 10 seconds |
| 3 | `/usr/bin/codesign --verify --strict /Applications/Xcode.app/Contents/Applications/DeviceHub.app` | 15 seconds |
| 4 | `/usr/bin/xcrun simctl list --json`, requiring the exact available target/runtime and no unrelated booted or booting target | 10 seconds |
| 5 | `/usr/bin/xcrun simctl boot 8B7D7CE4-228E-409F-A156-A597D4E448A5`, only when Shutdown | 20 seconds |
| 6 | `/usr/bin/xcrun simctl bootstatus 8B7D7CE4-228E-409F-A156-A597D4E448A5 -b` | 120 seconds |
| 7 | `/usr/bin/open /Applications/Xcode.app/Contents/Applications/DeviceHub.app` | 15 seconds |
| 8 | `/usr/bin/xcrun simctl list --json`, requiring the same available target and Booted state | 10 seconds |

Read-only plist and executable byte checks during preparation match the recorded hashes. The recorded attempt passed signature verification and selected-Xcode query, then timed out in inventory. Boot, bootstatus, GUI open and final inventory did not run. The installed CLI-platform-apple 20.2.0 source contains an Xcode 27 DeviceHub fallback; that source observation does not establish host or build readiness.

An already Booted assigned target skips boot and remains unowned. Any other state, incompatible metadata, unrelated booted or booting target, service failure or identity mismatch stops the worker. The proposed cleanup permission covers only `/usr/bin/xcrun simctl shutdown 8B7D7CE4-228E-409F-A156-A597D4E448A5` with a 20-second timeout after this worker's successful boot and a later failure. An uncertain boot timeout is recorded for coordinator review; no shutdown is inferred safe. Successful readiness leaves the assigned target booted and records ownership. No retry, service reset, erase, runtime download, default-device launch or shutdown of unowned targets is included. The coordinator reviews the first result before any Android or full native request.

## Conditional command sequence

These are inspected command routes, not an executable approval packet. Target IDs, native dependency resolution, generated projects and binary hashes remain future inputs. The [repair evidence](../records/evidence/revised-api-u25-native-harness-repairs.json) binds the historical native recipe. Host readiness must supply literal confirmed targets, and the later full native approval must cover generation, dependency resolution, build, installation, Metro and flows before dispatch.

The prepared recipe working directory is /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/native-harness. It remains blocked on host, operator, generated-project, linked-dependency and binary gates. Prepend /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/runtime-bin to the inherited PATH for every parent and child command. Its reviewed bun and node symlinks bind actual Bun 1.4.1 and Node 24.22.1; bypass the Vite Plus dispatch shim. Verify those tool identities again before a later execution request. The coordinator supplies the existing public MAPBOX_ACCESS_TOKEN without copying .env or recording the secret. Pinned-peer source review found no mandatory Mapbox download-secret token prerequisite; no new secret credential is presumed.

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
| 11 | Build/identity gate, then `bun scripts/tf07-ui-smoke.mjs ios mapbox`, `bun scripts/tf07-ui-smoke.mjs ios mapbox retained` and `bun scripts/tf09-rendering-smoke.mjs ios mapbox` serially | Mapbox iOS |
| 12 | Build/identity gate, then `bun scripts/tf07-ui-smoke.mjs android mapbox`, `bun scripts/tf07-ui-smoke.mjs android mapbox retained` and `bun scripts/tf09-rendering-smoke.mjs android mapbox` serially | Mapbox Android |
| 13 | Build/identity gate, then `bun scripts/tf07-ui-smoke.mjs ios maplibre`, `bun scripts/tf07-ui-smoke.mjs ios maplibre retained` and `bun scripts/tf09-rendering-smoke.mjs ios maplibre` serially | MapLibre iOS |
| 14 | Build/identity gate, then `bun scripts/tf07-ui-smoke.mjs android maplibre`, `bun scripts/tf07-ui-smoke.mjs android maplibre retained` and `bun scripts/tf09-rendering-smoke.mjs android maplibre` serially | MapLibre Android |

TF04/TF05/TF06 ordinary commands start Metro, build, install and launch both engine shells sequentially. The lifetime rows also own native build/install/launch. After each grouped TF04/TF05/TF06 command, reconcile the produced and installed binaries plus actual linked SDK identity for both engines before accepting either result. A pre-command baseline cannot prove identity for a flow that internally rebuilt the application. Reconcile the selected engine after each lifetime command as well. These drivers require the assigned iPhone 18 Pro to be the unique available named and sole booted iOS target, and the assigned Android emulator to be the sole connected device. Some legacy operations use unscoped device commands. Every invocation requires a fresh listener inventory; entering a legacy freePort path with an unknown listener is forbidden because it can terminate unrelated processes.

| Environment | Shell relative to the harness | Conditional build/install/launch command from that shell | Application identifier |
| --- | --- | --- | --- |
| mapbox-ios | examples/native-mapbox | `bun run ios -- --no-packager --port 8081 --udid UDID_TO_ASSIGN --mode Debug --buildFolder /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/runtime/builds/mapbox-ios` | org.reactjs.native.example.OneMapMapbox |
| mapbox-android | examples/native-mapbox | `bun run android -- --no-packager --port 8081 --device SERIAL_TO_ASSIGN` | com.onemapmapbox |
| maplibre-ios | examples/native-maplibre | `bun run ios -- --no-packager --port 8081 --udid UDID_TO_ASSIGN --mode Debug --buildFolder /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/runtime/builds/maplibre-ios` | org.reactjs.native.example.OneMapMaplibre |
| maplibre-android | examples/native-maplibre | `bun run android -- --no-packager --port 8081 --device SERIAL_TO_ASSIGN` | com.onemapmaplibre |

UDID_TO_ASSIGN and SERIAL_TO_ASSIGN are unresolved prerequisites, not literal dispatch values. Despite --no-packager, these commands build, install and launch. Record their input identities and produced binary before flows. For Android, compare the produced APK with installed base.apk obtained through the assigned serial's pm path and pull. For iOS, use showBuildSettings with the same derivedDataPath as the standalone run-ios buildFolder, then compare the produced CFBundleExecutable with the installed app container's executable. Legacy grouped commands may build elsewhere; discover each command's actual output instead of assuming the standalone build path. Hash equality and the actual linked SDK inventory form the coordinator's gate; historical binary hashes cannot substitute.

TF07 owns its Metro process and launches the installed app after checking the installed hash. Bind TF07_METRO_PORT=8081, TF07_NATIVE_BINARY_SHA256 to the independently verified installed binary, TF07_IOS_UDID or ANDROID_SERIAL to the assigned target, and TF07_MANUAL_REPORT to a unique nonexistent result path. The driver creates its receipt with exclusive creation and a fresh runId. All thirteen outcomes are required for each environment: live-child-button, nested-scroll, live-activation, annotation-activation, offset-touch-bounds, popup-follow-dismissal, map-feature-click, navigation-location, style-remount, host-accessibility, sdk-ornaments, camera-target-and-gesture and marker-prop-rejection. Preserve installedBinarySha256, libraryDistSha256, environment and runId when recording observations.

Each environment runs its core command and then the separate retained command with a new receipt and runId. Under /private/var/folders/cc/mjmcnnln739f6mxr3r0ky2140000gn/T/one-map-u25-f05-native-avf8woqw/runtime/results/native-attempt-01, the exact retained bindings are:

| Environment | Conditional retained command from the harness | TF07_MANUAL_REPORT basename | Result basename |
| --- | --- | --- | --- |
| mapbox-ios | `bun scripts/tf07-ui-smoke.mjs ios mapbox retained` | mapbox-ios-tf07-retained-manual.json | mapbox-ios-tf07-retained-result.json |
| mapbox-android | `bun scripts/tf07-ui-smoke.mjs android mapbox retained` | mapbox-android-tf07-retained-manual.json | mapbox-android-tf07-retained-result.json |
| maplibre-ios | `bun scripts/tf07-ui-smoke.mjs ios maplibre retained` | maplibre-ios-tf07-retained-manual.json | maplibre-ios-tf07-retained-result.json |
| maplibre-android | `bun scripts/tf07-ui-smoke.mjs android maplibre retained` | maplibre-android-tf07-retained-manual.json | maplibre-android-tf07-retained-result.json |

The report and result paths must be absent before the first attempt; the driver creates the receipt with wx and all six outcomes unverified. Use the same verified-binary and assigned-target environment bindings as the core command, with TF07_METRO_PORT=8081. Preserve installedBinarySha256, libraryDistSha256, environment and the new runId. Core and retained commands each own their Metro and installed-binary readback; stop their owned processes/forwards and recheck free ports between commands. No external competing Metro is allowed.

The coordinator must prepare and review an identity-aware density-closeout recipe before full native execution and run it after the four retained results. That recipe remains a future full-native prerequisite; this preparation does not contain a dispatchable density closeout. Each independent baseline JSON must include exact environment, libraryDistSha256, installedBinarySha256 and nativeTarget, tied to the verified build/install evidence. It verifies each current result envelope, current wx receipt, independently verified binary/library/target baseline, distinct runIds and judged observations before calling judgeNativeDensityMatrix. Each engine needs at least two distinct actual window.scale values. If the four approved rows do not provide them, stop and propose an extra target/density run for separate approval. No synthetic density prop or automatic host/density mutation can close this gate.

TF09 serves its fixture; it does not build, install, start Metro or launch the app. After core and retained TF07 cleanup, recheck the actual installed binary against the coordinator baseline before starting TF09. Start owned Metro from the selected shell with ONE_MAP_SMOKE=tf09 and `bun run start -- --port 8081 --reset-cache`. Changing ONE_MAP_SMOKE requires a Metro restart/reset because Babel inlines it. Launch the selected installed app with the assigned target. Android needs owned reverse mappings for tcp:8081 and tcp:8798; iOS uses simulator loopback. Restore only mappings owned by this attempt.

Bind TF09_LIBRARY_SHA256 to the candidate's dist digest, TF09_OUTPUT to a unique environment result JSON, TF09_RUNTIME_NODE_MODULES to a reviewed runtime directory containing package.json and pngjs, TF09_NATIVE_IDENTITY to the externally verified binary/build identity, and TF09_PEER_EVIDENCE to the reviewed patched-file inventory. The current native-peer-evidence.json and PNG runtime are verified in the new f05 freeze. Verify that freeze again before dispatch; later generated native inputs need their own identities. Generated projects, Pods, Gradle resolution, linked binaries and assigned targets remain future inputs. Expected patched bytes must come from reviewed reconciliation evidence; hashing arbitrary installed files cannot establish the expected identity.

The future full native run has a provisional half-day allowance of 3-6 hours for four serial environments and 76 manual outcomes: 52 unchanged core outcomes plus 24 supplemental outcomes. Fresh dependency/build caches can exceed that allowance. No current native duration is measured; host setup, diagnosis and retries are excluded. Refresh the estimate against confirmed targets before requesting full native approval. Driver timeouts are limits rather than predictions.

## Resource ownership and failure handling

One GPT-6 Luna worker at medium reasoning must exclusively own Metro port 8081, fixture ports 8797-8799, native build directories, simulator/emulator targets, installations and input tools. All four environments run sequentially. The worker reports its first attempt and stops at the first failed command or unexpected identity mismatch. It makes no source changes and chooses no whole-command retry.

The coordinator verifies the archive, templates, consumers and resolved peers before dispatch. Prebuilt core, retained and TF09 flows require matching produced binaries and installed readback before execution. Accept grouped legacy results only after the command's per-engine produced/installed and linked-SDK reconciliation. TF07 requires the thirteen unchanged core receipts from [the core smoke contract](../scripts/tf07-smoke-contract.mjs) plus the six separate [retained receipts](../scripts/tf07-retained-contract.mjs) per environment, with actual renderer/host readback and coordinator density closeout. The strict core, retained and TF09 paths require produced/installed and target identity verification before their flows. TF09 requires coordinator verification of the produced and installed binary outside the driver; a truthy TF09_NATIVE_IDENTITY string alone is insufficient.

## Permission boundary

The nine browser rows are complete. The bounded iOS-only attempt failed as recorded above. No retry is authorized; diagnose the startup message and refresh the packet before requesting further host action. Android readiness and full native acceptance require their own later approvals. It grants no native application generation, dependency resolution, build, installation, Metro, application launch or test input. After host readiness and operator/scope resolution, the coordinator must refresh the literal target and identity bindings and obtain separate full native execution permission. The reviewed source and frozen JavaScript inputs do not establish runtime readiness or acceptance. Changed inputs or whole-command retries require the relevant review and new permission.

Physical devices, full VoiceOver/TalkBack audits, sensor certification and unenumerated TF08 raw-service operations remain excluded. The owner-excluded RNMapbox invalidateAmbientCache and setMaximumAmbientCacheSize operations retain their exclusions. Approval grants no merge, tag or registry publication. The [testing policy](testing-policy.md#acceptance-timing-and-user-permission) owns permission and retry rules; its [retention policy](testing-policy.md#storage-and-tooling) requires compact outcome/provenance records and cleanup of temporary consumers, caches, binaries and nonessential logs after the checkpoint.
