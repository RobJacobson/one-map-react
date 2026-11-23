# one-map-react

Write a map screen once using the react-map-gl interface. In the browser, import react-map-gl itself. On iOS and Android, import one-map-react's RNMapbox or MapLibre React Native shim. You can choose a different engine on each platform.

```ts
// maps.ts
export { Map, Source, Layer, Marker, useMap } from "react-map-gl/maplibre";
```

```ts
// maps.native.ts
export { Map, Source, Layer, Marker, useMap } from "one-map-react/mapbox-native";
```

Import `./maps` from shared JSX. Vite resolves `maps.ts` by default. Metro selects `maps.native.ts` on iOS and Android. Camera commands, queries, marker children, and style updates are translated on native. A stock web-only application has no dependency on this package. See the [installation and API guide](packages/one-map-react/README.md) and the [shared vessel screen](packages/example-map/reference/VesselMap.tsx).

## Development

Use Bun 1.4.1 and Node.js 24.11 or newer on the 24.x line, or Node.js 26 or newer. Vite+ 1.1.0 supplies formatting, linting, unit/web tests, web example builds, and the unbundled library build. TypeScript 7.0.2 checks the library, tests, and examples. The [desktop vessel reference](packages/example-map/reference/README.md) compiles separately against the two stock react-map-gl entries. Wrapper packages are root development dependencies so the library typechecks against real declarations; they remain optional peers of the published package.

```sh
bun install --frozen-lockfile
bun run validate
```

`validate` checks formatting and documentation links, then builds the packages before checking types. It runs Vitest, native Jest, the cross-package regressions in `tests/`, and packed-package selection. Run `bun run test:peers` to check temporary consumers with installed wrapper peers. Run `bun run pack` to build an archive in `artifacts/`.

Run `bun run test` or `vp run test` for the complete test chain; `vp test run` runs only unit/web Vitest tests, and `bun run test:native` runs native Jest tests. `vp check` runs formatting and linting; the separate `typecheck` script remains part of `validate` so all four TypeScript configurations are checked.

## Library ownership and compilation

Each native map owns its camera, attached ref, source registry, interaction callbacks, and live marker overlays. The library build runs React Compiler and ships ESM and declarations. Browser convenience imports forward react-map-gl directly. The [library boundary](docs/architecture.md) covers that ownership and the open decisions.

## Examples

The maintained examples are `apps/web` for Vite and `apps/expo` for Expo web, iOS, and Android. Run `bun install` at the repository root, then `bun run dev:web` or `bun run dev:expo`. `dev:expo` serves Metro on port 8081. Both apps import the private shared example package and expose development acceptance scenarios. `validate` does not generate, compile, install, or run a native app.

Set a public `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in the shell or in the root `.env.local` or `.env`. `MAPBOX_ACCESS_TOKEN` is accepted when the new setting is absent. An explicit empty `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` disables Mapbox. Secret tokens are rejected before they enter a client bundle. Restart the development command after changing configuration.

The default map is Seattle at longitude -122.34, latitude 47.61, zoom 11. Both backends use the OpenFreeMap Liberty style. MapLibre starts without a token. Mapbox selection requires a public token.

In development, Vite and Expo web both accept `?engine=maplibre&scenario=tf04` to open a scenario directly. In Vite, add `?test=1` to the basemap URL to show the scenario selector and camera readback. In Expo on all platforms, set `EXPO_PUBLIC_ONE_MAP_TEST_MODE=1` to show the **Acceptance scenarios** button and camera readback. On iOS and Android, set `EXPO_PUBLIC_ONE_MAP_SCENARIO` and optionally `EXPO_PUBLIC_ONE_MAP_ENGINE` to open a scenario directly. Production exports omit the acceptance controls.

Expo uses SDK 57.0.23 with React Native 0.86.3. The app includes RNMapbox 10.3.19 and MapLibre React Native 11.5.1. Configuration pins the Mapbox Maps SDK to 11.33.0 and MapLibre Native to iOS 6.31.0 and Android 13.6.1. Native projects are generated from that configuration and ignored by Git.

## Project documents

Read the [library boundary](docs/architecture.md) and [testing](docs/testing.md). The [project files](FILES.md) show the source layout, and the [documentation index](docs/README.md) points at the current guides.

## License

[MIT](LICENSE).
