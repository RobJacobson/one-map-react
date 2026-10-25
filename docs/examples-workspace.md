# Example workspace checkpoint

**Historical scope.** Native marker drag results and commands below remain attached to their recorded artifacts. The [next-release migration](revised-api-proposal.md#markers-images-popups-and-controls) excludes common native dragging in both render modes; U07 removal is implemented and retires only the native live-drag and annotation-drag acceptance scenarios. Web dragging and selected raw native annotation dragging remain available. Retained native marker interactions await new touch acceptance; these earlier results do not verify the changed implementation.

The new Expo and Vite apps implement the minimal shared-basemap checkpoint. Native coexistence and renderer behavior are unverified. Migration of the existing acceptance scenarios and removal of the old shells wait for the separately authorized native checkpoint. The [testing policy](testing-policy.md) governs that authorization and evidence retention.

## Development setup

Run `bun install` at the repository root. `bun run dev:web` builds the library and shared example package, then watches both alongside the Vite app. `bun run dev:expo` does the same for Metro on port 8081. Both apps import the library's normal built exports through workspace dependencies. Vite emits MapLibre's worker as a separate asset. Expo scripts copy the unchanged pinned worker into the ignored public directory before Metro starts or exports the website. The library's source aliases remain confined to its existing tests and legacy examples.

The default map uses Seattle at longitude -122.34, latitude 47.61, zoom 11, bearing 0, and pitch 0. MapLibre starts without credentials. Both engines use the same [OpenFreeMap Liberty style](https://tiles.openfreemap.org/styles/liberty), which supplies its attribution. The top controls select an engine. Camera state survives keyed renderer replacement; callbacks from a retired map cannot update the replacement. Readiness requires public camera readback to match the requested camera, rather than command acknowledgement alone. Mapbox Native retains bearing and pitch from normalized movement events because its public getters are unavailable.

Set a public `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in the shell or root `.env.local`/`.env`. The existing `MAPBOX_ACCESS_TOKEN` setting is also accepted when the new setting is absent. An explicit empty new setting disables Mapbox. Secret tokens are rejected before configuration enters a client bundle. Restart the development command after changing configuration.

The Vite development URL accepts `?test=1` to show the checkpoint scenario and camera readback controls. Expo exposes the equivalent panel when `EXPO_PUBLIC_ONE_MAP_TEST_MODE=1` is set before starting Metro. Production exports exclude these panels. Only the basemap and switching checkpoint is implemented in these panels; the scenario inventory below remains pending.

Expo uses SDK 57.0.23, React Native 0.86.3, and React 19.2.3. Expo CLI 57.0.25 is pinned to avoid a newer transitive dependency blocked by the existing release-age policy. The build-properties plugin enables the SDK 57 scene lifecycle required by the installed Xcode 27 and iOS 27 SDK. The library's declared React Native peer range remains unchanged until native compatibility is established. Passing routine JavaScript checks does not renew renderer acceptance.

The native app includes RNMapbox 10.3.8 and MapLibre React Native 11.5.0. Root Bun configuration applies the existing exact-version patches unchanged. Expo configuration pins Mapbox Native to 11.23.1 on both platforms and MapLibre Native to iOS 6.31.0 and Android 13.6.1. Both plugins are configured together. Native projects are generated from configuration and ignored by Git. No native generation, compilation, installation, or execution belongs to the routine checks below.

## Acceptance scenario migration inventory

Existing scenario behavior, fixture observations, unsupported results, and historical outcomes remain authoritative for their exercised scope. The destination for migrated map content and scenario behavior is the private shared example package. Platform controls and runner transports retain platform-specific files. Default startup remains one page with one map; development scenarios retain multi-map cases when required by their assertions.

| Family | Existing source and runner | Destination | Migration status |
| --- | --- | --- | --- |
| Basic map and lifecycle | `examples/shared/route-map.tsx`, `lifecycle-smoke.ts`, `web-lifecycle-app.tsx`, native app lifecycle controls; [TF02](tf02-shared-map.md), [TF03](tf03-reuse.md) | Development map/lifecycle scenarios; retain web reuse and external-context cases | Pending native coexistence gate |
| Camera and corrections | `examples/shared/camera-smoke.ts`, `web-camera-app.tsx`, `web-corrections-app.tsx`, `native-camera-screen.tsx`; `scripts/tf04-camera-smoke.mjs` | Shared camera scenario with DOM/native controls | Pending native coexistence gate |
| Sources, layers, images | `examples/shared/sources-map.tsx`, `sources-smoke.ts`, platform source screens; `scripts/tf05-sources-smoke.mjs` | Shared source scenarios and existing local fixtures | Pending native coexistence gate |
| Queries and lifetimes | `examples/shared/queries-map.tsx`, `queries-smoke.ts`, `lifetimes-map.tsx`, `lifetimes-smoke.ts`; `scripts/tf06-queries-smoke.mjs` | Query and source-lifetime scenarios with existing fixture server | Pending native coexistence gate |
| UI and interactions | `examples/shared/tf07-scene.tsx`, platform UI screens; `scripts/tf07-ui-smoke.mjs` | Shared UI scenario with platform children and physical-interaction observations | Pending native coexistence gate |
| Location, offline, capture | `examples/shared/tf08-acceptance-scene.tsx`, platform service screens, native shell offline operations; `scripts/tf08-services-smoke.mjs` | Shared service scenarios; preserve engine-specific storage isolation and populated imports | Pending native coexistence gate |
| Advanced and selected rendering | `examples/shared/tf09-scene.tsx`, platform advanced screens and named probes; `scripts/tf09-rendering-smoke.mjs` | Shared advanced scenarios with platform media and selected-entry probes | Pending native coexistence gate |
| Release and package selection | `examples/mixed/`, `scripts/test-package.mjs`, `test-peers.mjs`, `test-example-resolution.mjs`; [TF10](tf10-release.md) | Temporary packed consumers plus adapted app runners | Existing checks retained; app-runner migration pending |

Applicable browser cases must run through both Expo web and Vite web, giving four browser app/engine combinations. The shared native installation supplies the other four combinations: two engines each on iOS and Android. Existing physical-device exclusions, deferred operations, and full screen-reader audit limits retain their recorded scope. A historical pass does not establish a pass for the new apps or dependency set.

## Verification and native gate

Routine verification includes root formatting/linting, documentation and inventory checks, existing type checks, `bun run typecheck:apps`, unit and mocked native suites, packed consumers, the library/shared-package builds, and browser app exports. `node scripts/example-config.test.mjs` checks token handling, both plugin declarations, and exact SDK settings without generating native projects. The source patch tests select the installed wrapper's existing patch and verify a reversible round trip.

The [checkpoint record](../records/evidence/example-workspace-checkpoint.json) owns source, lockfile, library, and patch identities plus the routine outcomes. The original working-tree changes predate this checkpoint and remain preserved. No commit or publication is part of this work.

Native acceptance requires a separate permission request after review and applicable routine checks are complete. The request must identify the frozen checkpoint, exact commands, assigned simulator/emulator, scope, and expected duration. It covers clean native generation, builds and installations, token-free MapLibre startup, same-binary Mapbox/MapLibre switching, Seattle startup, camera readback, repeated switches, and failure recovery. Build both engines into the same application; do not substitute engine-specific builds.

Stop if coexistence requires any new or modified dependency patch. Keep native execution sequential and preserve first-attempt failures. After this gate passes, migrate the inventory, retire old shells and generated storage, complete final routine checks, and request separately authorized acceptance across all eight app/engine combinations.
