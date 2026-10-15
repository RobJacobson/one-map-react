# Shared map examples

`shared/route-map.tsx` renders the TF02 map, GeoJSON source, and line layer. Each shell selects one adapter, sizes the map, and owns the remount and fly-to controls. Metro and Vite pin shared imports to that shell's `node_modules`. Mapbox shells read `MAPBOX_ACCESS_TOKEN` from the shell or a gitignored `.env` file. The shell variable wins. An example `.env` wins over the repository `.env`. Copy `.env.example` to `.env` and set the public token there, or export `MAPBOX_ACCESS_TOKEN` before starting Vite or Metro. Do not commit a token. The examples embed that public value in the local bundle, so a secret token must not be used. Restart Vite or Metro after changing it.

Web shells use Vite+ for development and production builds. From the repository root, `bun run build` writes the package `dist/` that the shells import. Then from `web-mapbox` or `web-maplibre`:

```sh
bun install
bun run dev
```

Native shells commit the JavaScript app, `app.json` registration name, Babel config, Metro config, and the React Native 0.87 `Gemfile`. From the repository root, `bun run build`, then generate `ios/` and `android/` with `bun scripts/setup-native-example.mjs`. Follow the example README for install and launch commands. Generating those directories shows that scaffolding runs; it does not show that the app builds.

Example installs and launches are not part of `validate`. Packed-consumer isolation is `bun run test:peers`.

`bun scripts/tf04-camera-smoke.mjs` is the TF04 renderer smoke. It is not part of `validate`. Web runs fit, click, stop, and a controlled jump. Android and iOS each start Metro on port 8081 with `ONE_MAP_SMOKE` set, then install with `--no-packager`. Android writes `debug_http_host` to this Mac's current LAN address before a cold start. MapLibre also waits for a double tap while pinch zoom is off. Android passes when that double tap does not zoom, because MapLibre Android requires zoom gestures. iOS passes when the double tap zooms. iOS posts the status line to the runner. The runner taps through an XCUITest driver, because Xcode 27 does not deliver SimulatorKit mouse events to the booted simulator. Pass `web`, `android`, or `ios` to run one group.
