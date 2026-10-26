# Patch and peer review decision

**Historical assessment and completed follow-up.** The U23 assessment body below preserves its pre-repair findings, identities/counts and proposed scope; the original evidence/matrix is unchanged. The owner-approved [U23-F01 reconciliation](revised-api-implementation-plan.md#u23-f01-reconcile-retained-publication-repairs) is implemented and independently audited. The [reconciliation evidence](../records/evidence/revised-api-u23-native-patch-reconciliation.json) owns final identities, bounded verification and remaining acceptance gates. A reviewed follow-up PR is authorized; U24 follows it and remains undispatched.

## Current publication reconciliation

P1-P8 are implemented in the three publication bundles. Pristine forward/reverse application and repaired SDK-output comparison preserve the original version-specific intent and all prior publication section semantics. The original patch files, production library modules, peers, locks, versions and SDK pins are unchanged. RNMapbox 10.3.8 keeps its existing bounds-reset behavior rather than receiving copied 10.3.7 camera hunks.

| Publication bundle | Final sections/hunks | Final SHA-256 |
| --- | --- | --- |
| rnmapbox-10.3.7-tf08.patch | 31/68 | `807c23c9926fdbf94ab2f716de113707ed2a7c3688d177ea9f2b3ea3ca95d7f1` |
| rnmapbox-10.3.8.patch | 36/73 | `0b9cdb09c6b39c1b5527678155246e9116a8db71249fd7fd08d9d1fe1288a788` |
| maplibre-native-11.5.0-tf08.patch | 13/20 | `ae291bf1f563c1c232caa60232b96fbacff479cef2934a448de7c860baa9b7c0` |

Focused proofs cover the repaired source boundaries, extracted Swift/Objective-C++ methods with stubbed SDK boundaries and Node codegen; executable Kotlin checks were skipped because the compiler was unavailable. Static Android checks, routine source/compiled tests and exact archive/isolated cases remain bounded evidence. They do not establish native application builds/linking, device/service behavior or renderer acceptance. The peer/development-host distinctions in the historical assessment remain relevant because no range, version or SDK pin changed.

**Pre-repair U23 assessment body follows unchanged.**

Keep all three active repair bundles. The publication bundles omit eight repair groups still needed by retained behavior; the original working tree contains those repairs. Reconcile the omissions through a separately approved bounded follow-up before U24. The read-only assessment is complete; native implementation readiness is not.

The [review evidence](../records/evidence/revised-api-u23-patch-peer-review.json) owns the complete section/hunk matrix, patch and source hashes, actual callers, manifest identities and prior isolated-check provenance. This review inspected source and records. It ran no installs, builds, codegen, package/peer tests, native linking or renderer acceptance. The consequences below are source-backed risks, not newly observed native failures. Locally installed SDKs contain stronger patches and can mask publication omissions.

## Bundle identity and retained ownership

Original means the preserved working tree; publication means the reviewed branch based on U22 PR42. Counts include rename-only sections, which have no hunks. SHA-256 values identify the actual reviewed files, not interchangeable replacements.

| Combined bundle | Original sections/hunks and SHA-256 | Publication sections/hunks and SHA-256 |
| --- | --- | --- |
| RNMapbox 10.3.7, rnmapbox-10.3.7-tf08.patch | 31/68; `2951f39a3a1c6190a39f781b9f71cf36946aecb148691a751e4adc1766725b3c` | 25/56; `118090860852b786a6681287f52ae3af1af8e0657a7c1853936204afb287a6d4` |
| RNMapbox 10.3.8, rnmapbox-10.3.8.patch | 36/73; `987da5eb58f5d49db078d2387f6a381cb5538a4f785221238fb36c1d7946e59f` | 25/56; `aacec1a77c297c5a0ba0d756f6833ae0b1364285dd473a030d98128ebb35cbe7` |
| MapLibre Native 11.5.0, maplibre-native-11.5.0-tf08.patch | 13/20; `ae291bf1f563c1c232caa60232b96fbacff479cef2934a448de7c860baa9b7c0` | 10/17; `430ef194dfeeefcc8c2e94c507b7dcb68f7633e691e7e75603d13a4061bff3af` |

The original bundles contain 80 sections/161 hunks; publication contains 60/129. Every active hunk has a retained reader. Shared camera commands and bounds, per-map events, terrain/elevation, light values, explicit feature-state operations and detached-view errors still need repairs. Selected application-owned offline, snapshot, network and custom-location operations also remain SDK callers after removal of common services. Declaration and native namespace repairs serve retained imports and build boundaries. No active repair was proven obsolete; remove one only after a verified replacement in the chosen upstream version.

The root patchedDependencies and [isolated consumer selector](../scripts/consumer-peer-patches.mjs) select these combined bundles. The separate 28-line rnmapbox-10.3.7-per-view-events.patch is inactive, but it is still shipped and checked by [package tests](../scripts/test-package.mjs), referenced by the historical [TF07 record](tf07-ui.md), and recorded in the version baseline. Its one section/two hunks duplicate event isolation/teardown intent. Keep it by default; retirement would be a separate shipping/test/history decision, not a prerequisite for the repair follow-up.

Native scale-position/resize refresh and the live-marker portal still have production readers. Common control removal does not authorize removing either.

## Eight publication repair groups

| ID | Affected versions | Missing retained repair | Conditional consequence |
| --- | --- | --- | --- |
| P1 | RNMapbox 10.3.7; MapLibre Native 11.5.0 | Reset removed maxBounds, including RNMapbox Fabric prop removal. | Removed camera bounds may remain active. RNMapbox 10.3.8 already contains the inspected camera defaults/reset behavior; do not copy the 10.3.7 camera hunks into it. |
| P2 | Both RNMapbox versions | Guard removeFeatureState against an absent or changed source family; forward SDK expected errors from explicit set/remove operations. | A detached or family-changed state operation may reach the wrong SDK path, or an SDK error may be reported as success. This is not a querySourceFeatures guard or the removed state-replay journal. |
| P3 | Both RNMapbox versions | Decode boxed integer light/style colors through the correct Swift value. | Retained Map.light and selected style colors may decode incorrectly. |
| P4 | MapLibre Native 11.5.0 | Reject an absent Fabric view with view_not_attached. | A retained native command/query can remain pending rather than reporting missing attachment. |
| P5 | RNMapbox 10.3.8 | Give the native codegen module a distinct RNMapbox namespace, with coherent source, emitted, import and native references. | Co-installed Mapbox and MapLibre SDKs can share generated protocol/class names. Declarations alone do not establish linking safety. |
| P6 | Both RNMapbox versions | Replay cached custom location and heading to newly added provider observers. | A selected native puck may miss an already supplied position/heading until another update. Application ownership of acquisition does not remove this SDK reader. |
| P7 | Both RNMapbox versions | Read live offline pack status on Android and iOS before tile-region persistence. | Application-owned pack.status() may query persistence too early during a live download. The omission is inside shared sections, so equal section/hunk counts do not establish parity. |
| P8 | Both RNMapbox versions | Export the iOS CameraModes.None alias read by NativeCameraModes.None. | Ordinary jumpTo and zero-duration stops need the immediate-camera mapping. This repair is separate from setConnected in the same section and from the deleted controlled-camera rollback. |

These are missing implementations of retained behavior, not proposed contract exclusions. The inspected 10.3.8 camera source and absence of camera hunks in both 10.3.8 bundles establish the version-specific P1 exception; locally patched source is not a general pristine-upstream survey. No native execution in this review establishes any listed failure or proves the original repair sufficient on the release host.

## Declared peers and observed hosts

Both library manifests require React Native ^0.87.1. Both maintained root/Expo manifests use React Native 0.86.3 with Expo 57.0.23. That development host is outside the declared range. Mock/build success there neither certifies the release host nor authorizes relaxing the peer range. Native React/DOM 19.2.3 and the recorded web endpoint tuples retain separate scopes.

Both manifests allow RNMapbox ^10.3.7; the maintained root/Expo selects 10.3.8. MapLibre Native remains ^11.5.0. The original library Teleport minimum is ^1.2.2; the publication minimum is ^1.2.1 and its legacy native consumers pin 1.2.1. The shared installed host has 1.2.2. Prior isolated declarations passed each tree's respective minimum, but do not establish live portal behavior on 1.2.1 or prove it fails. Select the intended release tuple explicitly. The existing declared RN 0.87.1/publication Teleport 1.2.1 minimum remains an option after repairs and required verification, not an automatic peer-policy change.

Maintained web consumers match the React/DOM 19.2.3, react-map-gl 8.1.3, Mapbox GL JS 3.32.0 and MapLibre GL JS 6.13.0 minima. Publication retains four legacy package manifests, inventoried separately: native consumers declare RN 0.87.1 and selected SDK minima, while web consumers match the web minima. Original has no remaining legacy example manifests. Mixed selection is established by its own package cases, not inferred from standalone manifests.

U22 recorded 13 package-selection and eight isolated-peer cases per tree on exact archives. Native isolated cases used RN 0.87.1, RNMapbox 10.3.7 or MapLibre Native 11.5.0, and each tree's Teleport minimum. They checked declarations, resolution and patch application, not RNMapbox 10.3.8 native linking or development-host certification. Newer endpoints and historical TF/rc renderer outcomes retain their recorded artifacts and scopes.

Both Expo configurations intend Mapbox Maps SDK 11.23.1 on iOS and Android. The [native pin helper](../scripts/native-mapbox-version.mjs) writes iOS '= 11.23.1' and Android 11.23.1; the inspected wrapper's iOS default is instead ~> 11.23.1. These are configuration/default identities, not freshly resolved or linked SDK versions. MapLibre's recorded iOS 6.31.0 and Android 13.6.1 defaults likewise do not become new linked-version evidence here.

## Proposed bounded follow-up

Approval is required before any patch change. The concrete proposal is:

1. Reconcile P1-P8 only in publication's three active combined bundles, using version-applicable original repairs as evidence. Inspect the exact missing changes, including omissions inside shared hunks; do not copy whole bundles or add 10.3.7 camera repairs to 10.3.8.
2. Keep peer ranges, locks, versions, SDK pins and application/library source unchanged. Limit other edits to necessary proof and documentation. Leave optional legacy-artifact retirement out of this follow-up.
3. Verify pristine application for RNMapbox 10.3.7, RNMapbox 10.3.8 and MapLibre Native 11.5.0. Run affected routine/static codegen and isolated declaration/patch proofs, adding explicit 10.3.8 coverage alongside the 10.3.7 minimum. Preserve errors, cleanup, generated-symbol coherence and the retained SDK operations; record exact patch/archive identities.
4. Review the bounded result independently. Reconcile release-host/Teleport choices and exact identities before candidate preparation. Native builds, linking and renderer acceptance require separate later permission after applicable routine checks and artifact preparation.

U24 remains undispatched until the owner decides and retained repair gaps are resolved. Completing this read-only assessment does not make the publication candidate ready. No patch, peer, lockfile, source, configuration, version or package artifact was changed by the review.
