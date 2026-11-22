# one-map-react

Write a map screen once using the react-map-gl interface. In the browser, import react-map-gl itself. On iOS and Android, import one-map-react's RNMapbox or MapLibre React Native shim. You can choose a different engine on each platform.

```ts
// maps.web.ts
export { Map, Source, Layer, Marker, useMap } from "react-map-gl/maplibre";
```

```ts
// maps.native.ts
export { Map, Source, Layer, Marker, useMap } from "one-map-react/mapbox-native";
```

Import `./maps` from shared JSX. Camera commands, queries, marker children and style updates are translated on native. A stock web-only application has no dependency on this package. See the [installation and migration guide](packages/one-map-react/README.md) and the [shared vessel screen](packages/example-map/reference/VesselMap.tsx).

## Development

Use Bun 1.4.1 and Node.js 24.11 or newer on the 24.x line, or Node.js 26 or newer. Vite+ 1.1.0 supplies formatting, linting, unit/web tests, web example builds, and the unbundled library build. TypeScript 7.0.2 checks the library, tests, and examples. The [desktop vessel reference](packages/example-map/reference/README.md) compiles separately against the two stock react-map-gl entries. Wrapper packages are root development dependencies so the library typechecks against real declarations; they remain optional peers of the published package.

```sh
bun install --frozen-lockfile
bun run validate
```

`validate` checks formatting, documentation links, inventory consistency, types, Vitest unit/web tests, native Jest Testing Library mounts, standalone regression scripts, the library build, and packed-package selection without installing wrapper peers into consumers. `bun run test:peers` is the checkpoint isolation check that installs one selected peer set into OS-temp consumers; it is not part of `validate`. Neither command launches a browser, Metro session, simulator, or native build. `bun run pack` builds an archive in `artifacts/`.

Run `bun run test` or `vp run test` for the complete test chain; `vp test run` runs only unit/web Vitest tests, and `bun run test:native` runs native Jest tests. `vp check` runs formatting and linting; the separate `typecheck` script remains part of `validate` so all four TypeScript configurations are checked.

## Library ownership and compilation

Each native map owns its camera, attached ref, source registry, interaction callbacks and live marker overlays. The library compiles these components with React Compiler and ships ESM and declarations. Browser convenience imports forward react-map-gl directly. The [native compatibility design](docs/native-compatibility-design.md) covers the ownership boundaries and remaining verification.

## Examples

The maintained examples are `apps/web` for Vite and `apps/expo` for Expo web, iOS, and Android. Run `bun install` at the repository root, then `bun run dev:web` or `bun run dev:expo`. Both apps import the private shared example package and expose development acceptance scenarios. See the [example workspace guide](docs/examples-workspace.md) for public Mapbox token configuration, scenario selection, native preparation, and verification status. Native builds and renderer acceptance are separate from `validate`.

## Project documents

Read the [requirements](docs/requirements.md), [stage plan](docs/stage-plan.md), and [testing policy](docs/testing-policy.md). The [project files](FILES.md) show the source layout, and the [documentation index](docs/README.md) links the API research and style guides. The [TF01 record](docs/tf01-foundation.md) describes the reset; the [TF02 record](docs/tf02-shared-map.md) describes the completed shared map.

The `records/` directory preserves historical inventory and compact checkpoint evidence. No historical implementation code is required to develop this project.

## License

[MIT](LICENSE).
