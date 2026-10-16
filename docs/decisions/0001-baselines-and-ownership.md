# Stable baselines and ownership

**Historical decision.** This record describes the previous implementation. Preserve its upstream evidence and observed failures, but assess its design choices against the [thin-facade requirements](../requirements.md). Its instructions and acceptance results do not govern or certify the replacement.

**Agreed design:** The implementation uses the stable package releases resolved on October 8, 2026 in [version-baseline.json](../../records/version-baseline.json). These versions remain fixed until a deliberate baseline change repeats inventory and conformance checks. Older releases and prereleases are outside the initial support claim.

React Native harnesses use the New Architecture and separate selected-backend installs. The native SDK defaults follow the pinned wrappers; they are not independently advanced to newer native releases. [RNMapbox 10.3.7 declares Mapbox SDK 11.23.1](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/package.json); exact resolved iOS and Android build dependencies must still be recorded with runtime evidence. MapLibre React Native 11.5.0 defaults to [Android 13.6.1](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/android/gradle.properties) and [iOS 6.31.0](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/MapLibreReactNative.podspec).

[RNMapbox's pinned config plugin](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/plugin/src/withMapbox.ts) marks download-token configuration deprecated and uses public native downloads. MapLibre uses public Maven Central and GitHub Swift Package distribution through its pinned native configuration linked above. The Mapbox public runtime token remains required for the selected renderer setup and comes from MAPBOX_PUBLIC_TOKEN. Tokens are never included in evidence or committed configuration.

## Compatible React host baseline

The initial metadata lookup selected React and React DOM 19.3.0. Before native runtime implementation, the host baseline was reconciled to stable 19.2.3 for shared web/native consumers, matching the [React Native 0.87.1 template](https://github.com/react-native-community/template/blob/0.87.1/template/package.json) and the embedded Fabric renderer version in the inspected published package. This is a host compatibility choice; it does not establish that 19.3.0 is unsupported. Backend package and native SDK pins remain fixed. Current pinned React type declarations are checked separately from runtime versions.

## Accepted portable defaults

Query results preserve backend order and duplicates while normalizing their container shape. An empty successful result differs from malformed transport, an unavailable operation, and a backend failure.

Feature state resets when an owned source is recreated or the style is replaced. Promise resolution acknowledges dispatch, not animation completion or repaint. Tests observe the resulting renderer state independently.

Markers use live interactive children unless annotation mode is explicitly requested. Popup unmount is teardown and does not emit a user dismissal. Native strict camera control, live dragging, popup composition, query scope, and capture contents remain assigned feasibility work; their absence during implementation does not establish an SDK limitation.

## Runtime test tooling

Playwright 1.64.0 uses its installed Chromium 156.0.8078.4 build. Maestro [CLI 2.11.0](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.11.0) is installed in a temporary test cache after verifying the release SHA-256 checksum. The native component suite uses the pinned React Native Jest preset with Jest 30.5.2 and React Native Testing Library 14.0.1. Tool installation and mocked component success do not establish renderer conformance.

## Evidence

The three [historical inventories](https://github.com/RobJacobson/one-map-react/tree/241816e73eb12a38a4b4b729757986500eb2a950/records/inventory-inputs) record pinned source paths and additional version findings. Native build identities, resolved dependency locks, and real-device evidence remain required before compatibility certification.
