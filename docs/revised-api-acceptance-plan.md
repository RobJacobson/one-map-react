# Native acceptance proposal

**Source and routine input verification pass; native execution readiness remains blocked by host, target and operator gates.** The owner requests the native gate as native U25 acceptance. The [unit protocol](revised-api-implementation-plan.md#u26-execute-approved-native-checks) retains U26 as its native execution identifier. This proposal owns the separate native permission request against the unchanged PR48 candidate.

The [current browser record](../records/evidence/revised-api-u25-web-attempt-05.json) records all nine approved browser rows passing on that candidate. Commands 1-2 passed in attempt04; commands 3-9 passed in the explicitly approved recovery. The [interrupted attempt04 record](../records/evidence/revised-api-u25-web-attempt-04.json), [attempt03](../records/evidence/revised-api-u25-web-attempt-03.json) and earlier failed attempts remain immutable history. Their source diagnoses and corrections remain in the [popup repair evidence](../records/evidence/revised-api-u25-popup-repair.json), [source-state repair evidence](../records/evidence/revised-api-u25-style-query-repair.json) and [camera/runner repair evidence](../records/evidence/revised-api-u25-repairs.json). The completed browser harness and runtime tools are retired under the retention policy; their paths are historical provenance rather than current execution inputs.

The approved resolver and retained native fixture/receipt repairs passed independent source audit, with [PR50](https://github.com/RobJacobson/one-map-react/pull/50) open at source commit 704e7e67815f4fe1c2c7e792dc48c76098a26c80. The [repair evidence](../records/evidence/revised-api-u25-native-harness-repairs.json) owns routine results, the refreshed input freeze and remaining gates. The [prior native-plan evidence](../records/evidence/revised-api-u25-native-plan.json) remains immutable evidence of its blocked planning checkpoint. The next proposed decision is host readiness only; native application generation, builds, installation, Metro and flows need later explicit permission. No host setup or native runtime has been performed.

## Candidate and scope

| Field | Identity | Verification boundary |
| --- | --- | --- |
| Archive | artifacts/revised-api-u25-f04/one-map-react-0.1.0-rc.2.tgz | The existing rehearsal archive is reused without repacking. |
| Archive SHA-256 | 8f8b93f57eeed914c5796dc302aab635628803a03be71cb9c50e639ccfac654d | Exact archive identity, distinct from the dist digest. |
| Dist digest | 52763b183574a8cc6a7436a7b9aefcba58793242917bd132570f0e5177b4aa5d | The TF07/TF09 sorted relative-path and raw-byte algorithm. |
| Package source basis | PR48 source f76b24e4000ea72cf86b2952f811323a471e0628, reviewed head c293272c1fbf0dcab7a571cdbdaec6d0942a0d4d | The package archive and library bytes remain unchanged. |
| Native harness source | PR50 source 704e7e67815f4fe1c2c7e792dc48c76098a26c80 | Reviewed resolver, supplemental fixture, driver and receipt corrections; no runtime acceptance. |
| Package bytes | 171 archive members, including 164 dist files | The package README remains frozen with the candidate. |

The native scope has four independent single-SDK environments: Mapbox iOS, Mapbox Android, MapLibre iOS and MapLibre Android. The proposed minimum baseline retains React Native 0.87.1, RNMapbox 10.3.7 or MapLibre React Native 11.5.0 and the publication tuple's Teleport 1.2.1. Requested pins are inputs; resolved, linked and installed identities require later evidence. Peer ranges, locks, versions and patches stay unchanged.

## Native composition limitation

The retained mixed-selection contract covers Mapbox web with MapLibre native and MapLibre web with Mapbox native. It does not require co-installing both native SDKs. The [candidate record](../records/evidence/revised-api-u24-candidate.json) preserves the RN 0.87.1 pure-Node codegen collision with RNMapbox 10.3.7 plus MapLibre 11.5.0 and its passing 10.3.8 control. Neither control is build/link or renderer acceptance. The maintained Expo host's RN 0.86.3 and RNMapbox 10.3.8 results do not certify this proposed baseline.

## Prepared inputs and remaining gates

The actual installed Metro resolver now selects the native capture helper on all four engine/platform rows. The two opposite mixed-selection variants also select their native backend on all four rows. Browser, generic TypeScript/TSX, actual JavaScript, package-resolution and original-error controls pass. Both installed Babel application/screen/selector graphs transform tf07-retained. These are static and routine proofs; no Metro process or transport was run.

The refreshed initial manifest inventories 33,900 entries, including 314 source entries. Two fresh single-SDK consumers passed actual Bun 1.4.1 frozen-lock installs with scripts disabled and unchanged locks. Each matches all 171 archive members; all 44 reviewed expected patched files match. The separate pngjs 7.0.0 runtime has 29 manifest entries and passed encode/decode roundtrip. The complete freeze binds those inputs, two tool symlinks and seventeen proof inputs. Its SHA-256 is 443c7aaa576cad78bd3a61cbc80b0702b07c0798d738b8b9d1dfd29d47b30309. The conditional command packet SHA-256 is f14a542daa91a865c637b90f72d977078e98ccd0f7d3efd20b4d386477fa6370.

The separate retained fixture and six-receipt contract cover named simultaneous maps, provider/local state, delayed annotation image refresh, measured layout/orientation, isolated camera targets and actual density/touch bounds. The thirteen core receipts and the original rich focused fixture remain unchanged. The [supplemental operator procedure](tf07-ui.md#retained-native-supplemental-procedure) owns the physical steps. Source, mocked and static checks do not establish the required native observations.

Host readiness remains unresolved: the refreshed bounded CoreSimulator query timed out after ten seconds, and no Android AVD or avdmanager is configured. No usable available/booted iOS target or Android serial has been established. An operator and tools capable of the physical/visual receipts also require confirmation. Generated projects, native dependency resolutions, linked SDKs and produced/installed binary identities remain future inputs. None may be inferred from requested pins or JavaScript installs.

The proposed retained scope includes application location/UI through TF07 and capture used for TF09 rendering observations. Broader raw offline, cache, import, snapshot and service acceptance needs an explicit owner scope disposition; those operations remain unverified. Physical devices, full VoiceOver/TalkBack and sensor certification retain their exclusions.

## Next decision: host readiness only

The next proposed approval covers host readiness, separately from native application generation, builds, installation and acceptance. The [repair evidence](../records/evidence/revised-api-u25-native-harness-repairs.json) binds this host proposal. The latest read-only iOS service query still timed out after ten seconds, and Android has no configured AVD or avdmanager. No host setup has been authorized or performed.

For Android, the proposal downloads the official ARM64 [command-line tools archive](https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip), verifies SHA-256 835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e, and extracts it into this task's temporary host-tools directory. The archive is 156,083,281 bytes. This adds no SDK image and replaces no installed SDK or Android Studio files. Use Android Studio's existing Java runtime, the existing SDK at /Users/rob/Library/Android/sdk, and task-owned ANDROID_USER_HOME and ANDROID_AVD_HOME directories.

| Android step | Proposed command or gate | Required outcome |
| --- | --- | --- |
| ADB ownership preflight | Read-only listeners/process executable/version inventory on ports 5037/5554/5555, before any adb command or emulator boot | Unknown, unowned or mismatched ADB server stops this phase before adb can replace it. |
| Profile inventory | Temporary tool's `avdmanager list device` | The exact pixel_6 profile is listed; otherwise stop. |
| Create task-owned AVD | `avdmanager create avd --name one-map-u25 --package 'system-images;android-37.1;google_apis_playstore_ps16k;arm64-v8a' --device pixel_6` | Existing image revision 9; new task-owned destination; no --force or overwrite. |
| Boot assigned emulator | Existing SDK's `emulator -avd one-map-u25 -port 5554 -no-snapshot-save` | Ports 5554/5555 are free and owned exclusively by this task. |
| Readiness | Assigned serial's adb device, boot_completed, ABI, image/API, wm size and wm density queries | Exactly one assigned emulator-5554, boot complete within 180 seconds, actual size/density recorded. |

Only a free port 5037 and explicit host-readiness approval permit starting the exact existing SDK adb server. Record the owned daemon PID, executable path and version. Legacy bare adb commands must resolve to that same binary. Stop if another device appears; restore only owned forwards and terminate only the owned daemon.

For iOS, the proposal first repeats the bounded read-only inventory. If startup is needed, reverify the intended iPhone 18 Pro metadata for UDID 8B7D7CE4-228E-409F-A156-A597D4E448A5 and use `open -a Simulator --args -CurrentDeviceUDID 8B7D7CE4-228E-409F-A156-A597D4E448A5`. This startup may boot that intended test simulator; it grants no default-last-device launch. Repeat the bounded inventory afterward and require the actual available runtime and booted identity. Metadata alone cannot establish readiness.

Only a target from the verified available-device list may receive a later `xcrun simctl boot` when none is booted. An absent compatible runtime/target, an unrelated booted target preventing exclusivity, continued service failure, or a requested system/license/privileged change stops this phase. The proposal includes no service reset, device erase, runtime download or shutdown of an unowned target.

One exclusive native-host worker would run this phase serially and stop at its first unexpected failure. The estimate is 15-30 minutes plus the 156 MB download; service failure can stop it earlier. Its outputs are confirmed target identities, tool/archive identity, observed display dimensions/density, resource ownership and cleanup instructions. The coordinator then refreshes the literal native acceptance request for separate approval. This phase includes no Metro, native project generation, Pods/Gradle/Xcode build, app installation/launch or test input.

## Conditional command sequence

These are inspected command routes, not an executable approval packet. Target IDs, native dependency resolution, generated projects and binary hashes remain future inputs. The [repair evidence](../records/evidence/revised-api-u25-native-harness-repairs.json) binds the current reviewed packet. Host readiness must supply literal confirmed targets, and the later full native approval must cover generation, dependency resolution, build, installation, Metro and flows before dispatch.

The proposed working directory is /private/tmp/one-map-u25-n02-6_rk_f7z/native-harness. Prepend /private/tmp/one-map-u25-n02-6_rk_f7z/runtime-bin to the inherited PATH for every parent and child command. Its reviewed bun and node symlinks bind actual Bun 1.4.1 and Node 24.22.1; bypass the Vite Plus dispatch shim. Verify those tool identities again before a later execution request. The coordinator supplies the existing public MAPBOX_ACCESS_TOKEN without copying .env or recording the secret. Pinned-peer source review found no mandatory Mapbox download-secret token prerequisite; no new secret credential is presumed.

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
| mapbox-ios | examples/native-mapbox | `bun run ios -- --no-packager --port 8081 --udid UDID_TO_ASSIGN --mode Debug --buildFolder /private/tmp/one-map-u25-n02-6_rk_f7z/runtime/builds/mapbox-ios` | org.reactjs.native.example.OneMapMapbox |
| mapbox-android | examples/native-mapbox | `bun run android -- --no-packager --port 8081 --device SERIAL_TO_ASSIGN` | com.onemapmapbox |
| maplibre-ios | examples/native-maplibre | `bun run ios -- --no-packager --port 8081 --udid UDID_TO_ASSIGN --mode Debug --buildFolder /private/tmp/one-map-u25-n02-6_rk_f7z/runtime/builds/maplibre-ios` | org.reactjs.native.example.OneMapMaplibre |
| maplibre-android | examples/native-maplibre | `bun run android -- --no-packager --port 8081 --device SERIAL_TO_ASSIGN` | com.onemapmaplibre |

UDID_TO_ASSIGN and SERIAL_TO_ASSIGN are unresolved prerequisites, not literal dispatch values. Despite --no-packager, these commands build, install and launch. Record their input identities and produced binary before flows. For Android, compare the produced APK with installed base.apk obtained through the assigned serial's pm path and pull. For iOS, use showBuildSettings with the same derivedDataPath as the standalone run-ios buildFolder, then compare the produced CFBundleExecutable with the installed app container's executable. Legacy grouped commands may build elsewhere; discover each command's actual output instead of assuming the standalone build path. Hash equality and the actual linked SDK inventory form the coordinator's gate; historical binary hashes cannot substitute.

TF07 owns its Metro process and launches the installed app after checking the installed hash. Bind TF07_METRO_PORT=8081, TF07_NATIVE_BINARY_SHA256 to the independently verified installed binary, TF07_IOS_UDID or ANDROID_SERIAL to the assigned target, and TF07_MANUAL_REPORT to a unique nonexistent result path. The driver creates its receipt with exclusive creation and a fresh runId. All thirteen outcomes are required for each environment: live-child-button, nested-scroll, live-activation, annotation-activation, offset-touch-bounds, popup-follow-dismissal, map-feature-click, navigation-location, style-remount, host-accessibility, sdk-ornaments, camera-target-and-gesture and marker-prop-rejection. Preserve installedBinarySha256, libraryDistSha256, environment and runId when recording observations.

Each environment runs its core command and then the separate retained command with a new receipt and runId. Under /private/tmp/one-map-u25-n02-6_rk_f7z/runtime/results/native-attempt-01, the exact retained bindings are:

| Environment | Conditional retained command from the harness | TF07_MANUAL_REPORT basename | Result basename |
| --- | --- | --- | --- |
| mapbox-ios | `bun scripts/tf07-ui-smoke.mjs ios mapbox retained` | mapbox-ios-tf07-retained-manual.json | mapbox-ios-tf07-retained-result.json |
| mapbox-android | `bun scripts/tf07-ui-smoke.mjs android mapbox retained` | mapbox-android-tf07-retained-manual.json | mapbox-android-tf07-retained-result.json |
| maplibre-ios | `bun scripts/tf07-ui-smoke.mjs ios maplibre retained` | maplibre-ios-tf07-retained-manual.json | maplibre-ios-tf07-retained-result.json |
| maplibre-android | `bun scripts/tf07-ui-smoke.mjs android maplibre retained` | maplibre-android-tf07-retained-manual.json | maplibre-android-tf07-retained-result.json |

The report and result paths must be absent before the first attempt; the driver creates the receipt with wx and all six outcomes unverified. Use the same verified-binary and assigned-target environment bindings as the core command, with TF07_METRO_PORT=8081. Preserve installedBinarySha256, libraryDistSha256, environment and the new runId. Core and retained commands each own their Metro and installed-binary readback; stop their owned processes/forwards and recheck free ports between commands. No external competing Metro is allowed.

The coordinator must run the reviewed identity-aware density-closeout recipe bound in the current packet after the four retained results. Each independent baseline JSON must include exact environment, libraryDistSha256, installedBinarySha256 and nativeTarget, tied to the verified build/install evidence. It verifies each current result envelope, current wx receipt, independently verified binary/library/target baseline, distinct runIds and judged observations before calling judgeNativeDensityMatrix. Each engine needs at least two distinct actual window.scale values. If the four approved rows do not provide them, stop and propose an extra target/density run for separate approval. No synthetic density prop or automatic host/density mutation can close this gate.

TF09 serves its fixture; it does not build, install, start Metro or launch the app. After core and retained TF07 cleanup, recheck the actual installed binary against the coordinator baseline before starting TF09. Start owned Metro from the selected shell with ONE_MAP_SMOKE=tf09 and `bun run start -- --port 8081 --reset-cache`. Changing ONE_MAP_SMOKE requires a Metro restart/reset because Babel inlines it. Launch the selected installed app with the assigned target. Android needs owned reverse mappings for tcp:8081 and tcp:8798; iOS uses simulator loopback. Restore only mappings owned by this attempt.

Bind TF09_LIBRARY_SHA256 to the candidate's dist digest, TF09_OUTPUT to a unique environment result JSON, TF09_RUNTIME_NODE_MODULES to a reviewed runtime directory containing package.json and pngjs, TF09_NATIVE_IDENTITY to the externally verified binary/build identity, and TF09_PEER_EVIDENCE to the reviewed patched-file inventory. The reviewed native-peer-evidence.json inventory is prepared and all 44 expected patched files match. The isolated pngjs 7.0.0 runtime is prepared and its encode/decode roundtrip passed; its bytes are recorded in the preparation handoff. Generated projects, Pods, Gradle resolution, linked binaries and assigned targets remain future inputs. Expected patched bytes must come from reviewed reconciliation evidence; hashing arbitrary installed files cannot establish the expected identity.

The future full native run has a provisional half-day allowance of 3-6 hours for four serial environments and 76 manual outcomes: 52 unchanged core outcomes plus 24 supplemental outcomes. Fresh dependency/build caches can exceed that allowance. No current native duration is measured; host setup, diagnosis and retries are excluded. Refresh the estimate against confirmed targets before requesting full native approval. Driver timeouts are limits rather than predictions.

## Resource ownership and failure handling

One GPT-6 Luna worker at medium reasoning must exclusively own Metro port 8081, fixture ports 8797-8799, native build directories, simulator/emulator targets, installations and input tools. All four environments run sequentially. The worker reports its first attempt and stops at the first failed command or unexpected identity mismatch. It makes no source changes and chooses no whole-command retry.

The coordinator verifies the archive, templates, consumers and resolved peers before dispatch. Prebuilt core, retained and TF09 flows require matching produced binaries and installed readback before execution. Accept grouped legacy results only after the command's per-engine produced/installed and linked-SDK reconciliation. TF07 requires the thirteen unchanged core receipts from [the core smoke contract](../scripts/tf07-smoke-contract.mjs) plus the six separate [retained receipts](../scripts/tf07-retained-contract.mjs) per environment, with actual renderer/host readback and coordinator density closeout. The strict core, retained and TF09 paths require produced/installed and target identity verification before their flows. TF09 requires coordinator verification of the produced and installed binary outside the driver; a truthy TF09_NATIVE_IDENTITY string alone is insufficient.

## Permission boundary

The current request is the bounded host-readiness phase above. It grants no native application generation, dependency resolution, build, installation, Metro, application launch or test input. After host readiness and operator/scope resolution, the coordinator must refresh the literal target and identity bindings and obtain separate full native execution permission. The reviewed source and frozen JavaScript inputs do not establish runtime readiness or acceptance. Changed inputs or whole-command retries require the relevant review and new permission.

Physical devices, full VoiceOver/TalkBack audits, sensor certification and unenumerated TF08 raw-service operations remain excluded. The owner-excluded RNMapbox invalidateAmbientCache and setMaximumAmbientCacheSize operations retain their exclusions. Approval grants no merge, tag or registry publication. The [testing policy](testing-policy.md#acceptance-timing-and-user-permission) owns permission and retry rules; its [retention policy](testing-policy.md#storage-and-tooling) requires compact outcome/provenance records and cleanup of temporary consumers, caches, binaries and nonessential logs after the checkpoint.
