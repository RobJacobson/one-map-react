# TF02 handoff: working shared map

**Ready for the next agent; TF02 has not started.** Begin when the user requests TF02. TF01 removed the previous implementation and established the package and selection foundation. Read [requirements](requirements.md), [stage plan](stage-plan.md), [testing policy](testing-policy.md), and [coding style](coding-style.md) before changing code.

## Intended result

Implement one shared React map example with initial camera, one GeoJSON source, one line layer, one camera command, one normalized movement or click event, and unmount/remount. Run that same map component through Mapbox web, MapLibre web, RNMapbox, and MapLibre React Native. Each native adapter covers both iOS and Android. Preserve both mixed engine choices through application setup.

The shared API generally follows react-map-gl. Delegate web behavior to react-map-gl and translate native component names, props, styles, commands, and events where they differ. The purpose is to move the application's compatibility shims into a library, not to build another rendering or lifecycle framework.

## What exists

| Location | Current responsibility |
| --- | --- |
| `packages/one-map-react/src/adapter.ts` | `Adapter` selection descriptor and four-name `Backend` union. |
| `packages/one-map-react/src/index.ts` | Backend-free type exports. No React or renderer imports. |
| Four explicit source entries | Export `adapter` with a literal backend name. No wrapper is loaded. |
| `packages/one-map-react/package.json` | Four explicit paths, common entry, two conditional aliases, optional backend peers, narrow publication contents. |
| `scripts/build.mjs` | Compile source and declarations into a clean package `dist`. |
| `scripts/test-package.mjs` | Pack once, extract into temporary isolated consumers, check Node imports, TypeScript declarations, and Bun selection bundles; clean up afterward. |
| `tests/fixtures/map.json` | Local empty style, view state, route GeoJSON, and marker data. |

Node 24.14.0, Bun 1.4.1, TypeScript 7.0.2, and Biome 2.5.15 were used for TF01. The package's exact peer versions come from the historical research baseline. Backend packages are not installed in the foundation workspace; their runtime compatibility remains unverified. Install and inspect only the versions needed for the selected implementation and consumers. Do not treat the absence of wrapper imports in TF01 as proof of eventual backend isolation.

The `mapbox` and `maplibre` aliases prefer `browser`, then `react-native`, then web fallback. The checks verify these export conditions with Node, TypeScript, and Bun. They do not establish Metro resolution, SDK transport, native autolinking, React context behavior, or rendering. The mixed cases currently verify complementary entry choices separately, not a running shared application.

## Implementation sequence

1. Inspect the wrappers' public APIs for this one scenario. Use the preserved API references and inventory to locate differences, then verify them against the selected wrapper source. The Ferryjoy reference at `/Users/rob/code/ferryjoy/ferryjoy-app/` is an optional local example of web/native translation; it is not a dependency or authority for the library contract.
2. Choose the smallest setup/context interface that connects shared components to the selected adapter. Evolve the descriptor into a useful integration or replace it if a simpler interface results. Preserve the agreed entry paths and explicit selection. Keep the common entry independent of backend SDKs; do not switch among imports of every wrapper at runtime.
3. Implement just the common map, camera input/ref command, GeoJSON source, line layer, and selected event required by the example. Use normal wrapper rendering, subscription, update, and cleanup paths. Document command timing and event fields where web and native differ. Do not add future components that throw “not implemented.”
4. Add focused forwarding and conversion tests with explicit expected wrapper calls or values. Cover cleanup where the facade adds resources. Expand packed-consumer checks to install selected peers and verify actual adapter and declaration isolation. Add ordinary test tools when needed; the old test framework is gone.
5. Provide the shared example and minimal selected consumer setup for web and the native backends. Native consumers must demonstrate selected SDK linking rather than installing every backend together. Update setup docs with commands that actually exist, review the implementation, and run applicable routine checks.
6. At the completed checkpoint, prepare a concrete runtime acceptance request with artifact identity, six environments, commands, scenario, and estimated duration. Obtain explicit permission before browser renderer tests, mixed Metro renderer transport, or native acceptance builds/flows. Record missing runtime results as unverified until that permission and execution occur.

## Keep the boundary small

Wrappers own map construction, renderer teardown, native binding, and their own source/layer updates. Add state only for a demonstrated common behavior. A useful review should trace creation, source/layer rendering, the camera command, and the normalized event directly to their wrapper calls and explain each extra state owner.

No custom native bridge, retained-map pool, operation dispatcher, readiness state machine, general capability registry, or Metro transformer is inherited from the previous implementation. If this scenario exposes a real gap, reproduce it with the wrapper and document the smallest required adaptation. The old Metro investigation is evidence of a possible transport issue, not a reason to restore its transformer before testing the selected toolchain.

Map reuse remains required and is the main subject of TF03. TF02's unmount/remount demonstrates basic cleanup and fresh mounting; it does not by itself prove reuse. Do not preemptively rebuild pooling, external-context ownership, or later-stage camera/query capabilities. Full API coverage remains scheduled in TF04–TF10; this first example is not a reduced final scope.

## Checks and completion

From the repository root, run `bun install --frozen-lockfile` for the current foundation and `bun run validate` for routine checks. Update the lockfile deliberately when adding TF02 dependencies. Add focused tests to the routine command as their owning behavior arrives. `validate` must remain free of automatic renderer acceptance.

TF02 is complete when the shared example, setup, focused tests, and documentation are implemented and its approved smoke scenario has passed in all six environments. A blocked or unapproved runtime run leaves that acceptance gate open; do not mark the stage complete on mocks or package checks alone. Retain a compact artifact/version/environment/result record and remove temporary consumers, builds, and caches when finished.

Historical decisions and JSON evidence describe the retired implementation. Their contracts, old commands, and passing counts do not govern this one. See the [TF01 record](tf01-foundation.md) for reset details. Commit only if requested, using the repository's Conventional Commit subject and bullet-summary convention.
