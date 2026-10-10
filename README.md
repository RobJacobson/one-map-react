# one-map-react

one-map-react is being built as a thin React facade over RNMapbox, MapLibre React Native, and react-map-gl. Applications will choose a backend at setup and use a shared map API, generally following react-map-gl. Full upstream API coverage and map reuse are requirements.

**Current status: TF01 foundation only.** The package builds and its explicit entries and platform aliases resolve in isolated consumers. It does not yet render maps or load a wrapper. TF02 will add the first shared map example.

## Development

Use Bun 1.4.1 and Node.js 24 (verified with 24.14.0). The build uses TypeScript 7.0.2 and formatting uses Biome 2.5.15.

```sh
bun install --frozen-lockfile
bun run validate
```

`validate` checks formatting, documentation links, types, the library build, and packed-package selection. Temporary consumers are removed after checking. It does not run browser or native renderer tests. `bun run pack` builds an archive in `artifacts/`.

## Selecting a backend

The common entry exports the `Adapter` and `Backend` types. Each explicit entry currently exports a selection descriptor:

```ts
import type { Adapter } from "one-map-react";
import { adapter } from "one-map-react/mapbox-web";

const selected: Adapter = adapter;
```

| Entry | Selected backend |
| --- | --- |
| `one-map-react/mapbox-web` | react-map-gl with Mapbox GL JS |
| `one-map-react/maplibre-web` | react-map-gl with MapLibre GL JS |
| `one-map-react/mapbox-native` | RNMapbox on iOS or Android |
| `one-map-react/maplibre-native` | MapLibre React Native on iOS or Android |

These descriptors identify the intended backend; they do not instantiate adapters or renderers yet. The `mapbox` and `maplibre` aliases choose web under the `browser` condition, native under `react-native`, and web by default. Browser takes precedence when both conditions are enabled. Explicit paths avoid ambiguity when a tool does not apply those conditions.

For mixed engines, an application's `.web` setup module can select `mapbox-web` and its `.native` counterpart can select `maplibre-native`, or the reverse. TF02 will connect selection to shared map components. Metro resolution and native linking remain unverified for the replacement.

React is a required peer. Host runtimes, wrappers, and SDKs are optional peers so applications install only their chosen backend dependencies. The exact versions in the package manifest are candidates retained from the API research, not a claim of renderer compatibility. TF02 must check the chosen versions against the real wrappers before making that claim.

## Project documents

Read the [requirements](docs/requirements.md), [stage plan](docs/stage-plan.md), and [testing policy](docs/testing-policy.md). The [documentation index](docs/README.md) links the API research and style guides. The [TF01 record](docs/tf01-foundation.md) describes the reset and verification; the [TF02 handoff](docs/tf02-handoff.md) defines the next implementation step.

The `records/` directory preserves historical inventory and evidence. It does not describe the new implementation's acceptance. No historical implementation code is required to develop this project.

## License

[MIT](LICENSE).
