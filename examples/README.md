# Shared map examples

`shared/route-map.tsx` renders the TF02 map, GeoJSON source, and line layer. Each shell selects one adapter, sizes the map, and owns the remount and fly-to controls. Metro and Vite pin shared imports to that shell's `node_modules`. Mapbox shells read `MAPBOX_ACCESS_TOKEN` from the shell or a gitignored `.env` file. The shell variable wins. An example `.env` wins over the repository `.env`. Copy `.env.example` to `.env` and set the public token there, or export `MAPBOX_ACCESS_TOKEN` before starting Vite or Metro. Do not commit a token. The examples embed that public value in the local bundle, so a secret token must not be used. Restart Vite or Metro after changing it.

Web shells are Vite apps. From the repository root, `bun run build` writes the package `dist/` that the shells import. Then from `web-mapbox` or `web-maplibre`:

```sh
bun install
bun run dev
```

Native shells commit the JavaScript app, `app.json` registration name, Babel config, Metro config, and the React Native 0.87 `Gemfile`. From the repository root, `bun run build`, then generate `ios/` and `android/` with `bun scripts/setup-native-example.mjs`. Follow the example README for install and launch commands. Generating those directories shows that scaffolding runs; it does not show that the app builds.

Example installs and launches are not part of `validate`. Packed-consumer isolation is `bun run test:peers`.
