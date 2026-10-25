# one-map-react

The new Expo/Vite example workspace is at its minimal checkpoint. See [workspace setup and migration status](docs/examples-workspace.md). Native coexistence acceptance and migration of the legacy scenarios are pending.

one-map-react is being built as a thin React facade over RNMapbox, MapLibre React Native, and react-map-gl. Applications choose a backend at setup and use a shared map API, generally following react-map-gl. The current TF contract targets full upstream API coverage and map reuse. The next incompatible release has an agreed narrower [scope and migration contract](docs/revised-api-proposal.md), with migration in progress. This README and its examples describe the existing API. The development-branch implementation adds getWrapperMap on all four selected refs while retaining advanced methods; API removals remain pending. See the [unit status](docs/revised-api-implementation-plan.md#work-order) for review and verification gates.

TF10 prepares the expanded peer ranges, reconciled inventory and package candidate. Its [release record](docs/tf10-release.md) distinguishes routine checks from the still-open renderer/native acceptance gates. The [package README](packages/one-map-react/README.md) contains installation, shared map, selected extensions and native patch instructions. Exact current host versions and patch identities live in [the support matrix](records/support-matrix.json).

TF02–TF09 historical acceptance remains valid only for its recorded artifacts and exercised scope. It does not certify this candidate. Native Mapbox Maps SDK 11.23.1 is now pinned exactly on both platforms; RNMapbox wrapper10.3.x is a separate version.

## Development

Use Bun 1.4.1 and Node.js 24.11 or newer on the 24.x line, or Node.js 26 or newer. Vite+ 1.1.0 supplies formatting, linting, unit/web tests, web example builds, and the unbundled library build. TypeScript 7.0.2 checks the four explicit library, test, web-example, and native-example configurations. Wrapper packages are root development dependencies so the library typechecks against real declarations; they remain optional peers of the published package.

```sh
bun install --frozen-lockfile
bun run validate
```

`validate` checks formatting, documentation links, inventory consistency, types, Vitest unit/web tests, native Jest Testing Library mounts, standalone regression scripts, the library build, and packed-package selection without installing wrapper peers into consumers. `bun run test:peers` is the checkpoint isolation check that installs one selected peer set into OS-temp consumers; it is not part of `validate`. Neither command launches a browser, Metro session, simulator, or native build. `bun run pack` builds an archive in `artifacts/`.

Run `bun run test` or `vp run test` for the complete test chain; `vp test run` runs only unit/web Vitest tests, and `bun run test:native` runs native Jest tests. `vp check` runs formatting and linting; the separate `typecheck` script remains part of `validate` so all four TypeScript configurations are checked.

## Library ownership and compilation

The [common map](packages/one-map-react/src/facade/map.tsx) owns map access, attachment, and common notifications. [Source interactions](packages/one-map-react/src/facade/use-map-interactions.ts) own hit queries, propagation, and pending-result cleanup. Each native adapter provides its own [presentation context](packages/one-map-react/src/adapters/shared/native-map-presentation.tsx) for gestures, layout, ornaments, and overlays. Native camera observations flow directly from changing and settled adapter callbacks into a separate camera context, which controls and live overlays read without invalidating map-access consumers. Callback guards protect retained web renderers, mutable wrapper callback storage, and facade-owned asynchronous work. Direct native events use wrapper forwarding where it already provides current callbacks. The [callback guard audit](records/evidence/callback-guards.json) records each decision and its wrapper source.

The library build runs React Compiler 1.0.0 on original source before TypeScript and JSX lowering. It targets React 19 and ships compiled ESM with the existing declarations and optional-peer boundaries. Consumers need no compiler configuration or additional runtime package. The build reports skipped functions; lifecycle guards and stabilization remain explicit where the compiler cannot optimize them. Context memoization also preserves isolation when tests load uncompiled source.

`bun run test:compiled` builds the package and runs the web and mocked native regressions against emitted modules, followed by component-specific compiler checks. It is a routine check and launches no real renderer. Source regressions remain under `bun run test`. Renderer acceptance requires separate authorization under the [testing policy](docs/testing-policy.md#acceptance-timing-and-user-permission).

## Selecting a backend

Application setup imports one explicit adapter and wraps the shared map:

```tsx
import { Map, MapSetup, Source, Layer } from "one-map-react";
import { adapter } from "one-map-react/mapbox-web";

<MapSetup adapter={adapter}>
  <Map mapStyle={emptyStyle} initialViewState={initialViewState}>
    <Source id="routes" type="geojson" data={routes}>
      <Layer
        id="route-line"
        type="line"
        paint={{ "line-color": "#2563eb", "line-width": 3 }}
        layout={{ "line-cap": "round" }}
      />
    </Source>
  </Map>
</MapSetup>
```

| Entry | Selected backend |
| --- | --- |
| `one-map-react/mapbox-web` | react-map-gl with Mapbox GL JS |
| `one-map-react/maplibre-web` | react-map-gl with MapLibre GL JS |
| `one-map-react/mapbox-native` | RNMapbox on iOS or Android |
| `one-map-react/maplibre-native` | MapLibre React Native on iOS or Android |

The `mapbox` and `maplibre` aliases choose web under the `browser` condition, native under `react-native`, and web by default. Browser takes precedence when both conditions are enabled. Explicit paths avoid ambiguity when a tool does not apply those conditions. Mixed engines select different entries in web and native setup modules.

React is a required peer. Host runtimes, wrappers, and SDKs are optional peers so applications install only their chosen backend. Exact versions in the package manifest are candidates from the API research baseline.

Native applications also install `react-native-teleport@1.2.1`. Native controls use its portals to retain nested React providers and child state while drawing above the map. The adapter provides the portal setup. Adding this native peer requires linking and rebuilding the application; TF07 portal drawing and touch acceptance passed for the recorded R16 artifact. See the [control portal decision](docs/decisions/0007-native-control-portals.md) and [TF07 runtime record](docs/tf07-ui.md#runtime-checkpoint).

## Examples

Web shells in `examples/web-mapbox` and `examples/web-maplibre` need `bun run build` from the repository root, then `bun install` and `bun run dev` in the shell. Native shells in `examples/native-mapbox` and `examples/native-maplibre` commit the JavaScript app and `Gemfile`; build the package, then generate `ios/` and `android/` with `bun scripts/setup-native-example.mjs`. Mapbox shells read `MAPBOX_ACCESS_TOKEN` from the shell or a gitignored `.env` file. Those installs and launches are not part of `validate`. See [examples/README.md](examples/README.md) and the [TF02 record](docs/tf02-shared-map.md).

## Project documents

Read the [requirements](docs/requirements.md), [stage plan](docs/stage-plan.md), and [testing policy](docs/testing-policy.md). The [documentation index](docs/README.md) links the API research and style guides. The [TF01 record](docs/tf01-foundation.md) describes the reset; the [TF02 record](docs/tf02-shared-map.md) describes the completed shared map.

The `records/` directory preserves historical inventory and compact checkpoint evidence. No historical implementation code is required to develop this project.

## License

[MIT](LICENSE).
