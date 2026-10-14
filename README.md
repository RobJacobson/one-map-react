# one-map-react

one-map-react is being built as a thin React facade over RNMapbox, MapLibre React Native, and react-map-gl. Applications choose a backend at setup and use a shared map API, generally following react-map-gl. Full upstream API coverage and map reuse are requirements.

**Current status: TF02–TF07 are implemented, and the authorized R16 renderer acceptance passed across all six environments for the recorded exercised scope.** TF07 includes markers, explicit static annotations, popups, controls, source clicks, and `useMap`; full VoiceOver and TalkBack audits are outside this checkpoint. Mapbox Android's opening camera retains the pinned `@rnmapbox/maps` 10.3.7 cold-style-cache behavior. Web `reuseMaps` uses the react-map-gl pool; native remounts create a new map. See the [stage plan](docs/stage-plan.md) and [TF07 record](docs/tf07-ui.md) for implementation and acceptance status.

TF08 implements location/offline/capture APIs. Its authorized acceptance passed on both browsers and exposed native offline, file-output, and location/gesture failures. See [the TF08 record](docs/tf08-location-offline-capture.md) for the exercised scope and remaining work.

## Development

Use Bun 1.4.1 and Node.js 24 (verified with 24.14.0). The build uses TypeScript 7.0.2 and formatting uses Biome 2.5.15. Wrapper packages are root development dependencies so the library typechecks against real declarations; they remain optional peers of the published package.

```sh
bun install --frozen-lockfile
bun run validate
```

`validate` checks formatting, documentation links, types, Jest Testing Library mounts and conversion tests, the library build, and packed-package selection without installing wrapper peers into consumers. `bun run test:peers` is the checkpoint isolation check that installs one selected peer set into OS-temp consumers; it is not part of `validate`. Neither command launches a browser, Metro session, simulator, or native build. `bun run pack` builds an archive in `artifacts/`.

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
