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

Import `./maps` from shared JSX. Camera commands, queries, marker children and style updates are translated on native. A stock web-only application has no dependency on this package. See the [installation and API guide](packages/one-map-react/README.md) and the [shared vessel screen](packages/example-map/reference/VesselMap.tsx).

## Development

Use Bun 1.4.1 and Node.js 24.11 or newer on the 24.x line, or Node.js 26 or newer. Vite+ 1.1.0 supplies formatting, linting, unit/web tests, web example builds, and the unbundled library build. TypeScript 7.0.2 checks the library, tests, and examples. The [desktop vessel reference](packages/example-map/reference/README.md) compiles separately against the two stock react-map-gl entries. Wrapper packages are root development dependencies so the library typechecks against real declarations; they remain optional peers of the published package.

```sh
bun install --frozen-lockfile
bun run validate
```

`validate` checks formatting, documentation links, inventory consistency, types, Vitest unit/web tests, native Jest Testing Library mounts, the cross-package regressions in `tests/`, the library build, and packed-package selection without installing wrapper peers into consumers. `bun run test:peers` installs one selected peer set into temporary consumers outside the workspace. It is not part of `validate`. Neither command launches a browser, Metro session, simulator, or native build. `bun run pack` builds an archive in `artifacts/`.

Run `bun run test` or `vp run test` for the complete test chain; `vp test run` runs only unit/web Vitest tests, and `bun run test:native` runs native Jest tests. `vp check` runs formatting and linting; the separate `typecheck` script remains part of `validate` so all four TypeScript configurations are checked.

## Library ownership and compilation

Each native map owns its camera, attached ref, source registry, interaction callbacks and live marker overlays. The library compiles these components with React Compiler and ships ESM and declarations. Browser convenience imports forward react-map-gl directly. The [library boundary](docs/architecture.md) covers that ownership and the open decisions.

## Examples

The maintained examples are `apps/web` for Vite and `apps/expo` for Expo web, iOS, and Android. Run `bun install` at the repository root, then `bun run dev:web` or `bun run dev:expo`. `dev:expo` serves Metro on port 8081. Both apps import the private shared example package and expose development acceptance scenarios. `validate` does not generate, compile, install, or run a native app.

Set a public `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in the shell or in the root `.env.local` or `.env`. `MAPBOX_ACCESS_TOKEN` is accepted when the new setting is absent. An explicit empty `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` disables Mapbox. Secret tokens are rejected before they enter a client bundle. Restart the development command after changing configuration.

The default map is Seattle at longitude -122.34, latitude 47.61, zoom 11. Both engines use the OpenFreeMap Liberty style. MapLibre starts without a token. Vite and Expo web accept `?engine=maplibre&scenario=tf04`. `?test=1` shows the basemap readback panel. Production exports omit these controls. For native, set `EXPO_PUBLIC_ONE_MAP_TEST_MODE=1` to show the scenario button, and set `EXPO_PUBLIC_ONE_MAP_SCENARIO` and `EXPO_PUBLIC_ONE_MAP_ENGINE` to open one scenario directly. Mapbox selection requires a public token.

Expo uses SDK 57.0.23 with React Native 0.86.3. The app includes RNMapbox 10.3.19 and MapLibre React Native 11.5.1. Configuration pins the Mapbox Maps SDK to 11.33.0 and MapLibre Native to iOS 6.31.0 and Android 13.6.1. Native projects are generated from that configuration and ignored by Git.

## Project documents

Read the [library boundary](docs/architecture.md) and [testing](docs/testing.md). The [project files](FILES.md) show the source layout, and the [documentation index](docs/README.md) points at the current guides.

## License

[MIT](LICENSE).
