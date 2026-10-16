# Mapbox native example

React Native 0.87 shell around the shared Seattle route map, using `one-map-react/mapbox-native`. The `app.json` name is `OneMapMapbox`; the generator uses the same name so the native module matches `AppRegistry`.

The generated app pins the native **Mapbox Maps SDK** to exactly **11.23.1** on both platforms. The iOS Podfile sets `$RNMapboxMapsVersion = '= 11.23.1'`; Android's root `buildscript.ext` sets `RNMapboxMapsVersion = '11.23.1'`. This SDK version is separate from the npm wrapper `@rnmapbox/maps@10.3.7`. The deprecated native SDK v10 is outside the release matrix. Generated config tests establish the settings; native linking and renderer acceptance remain separate.

TF07 controls require the included `react-native-teleport@1.2.1` peer. The adapter provides its portal setup; adding it requires a fresh native build before runtime acceptance. The manifest pins Teleport’s React DOM peer to the React 19.2.3 baseline through an override.

The manifest also applies the package's [Android event patch](../../packages/one-map-react/patches/rnmapbox-10.3.7-per-view-events.patch) to `@rnmapbox/maps@10.3.7`. Its manager-wide event throttle omits the native view identifier, so two maps can suppress each other's load or input events. The patch preserves the throttle and scopes its cache to each view. It requires a native rebuild and does not change iOS. Remove it when the selected wrapper includes per-view event cache keys.

From the repository root, `bun run build` writes the package `dist/` this shell imports. Then generate the ignored `ios/` and `android/` trees. This command copies the template `Gemfile` as well. It does not install JavaScript packages or CocoaPods, and it does not build or launch an app:

```sh
bun scripts/setup-native-example.mjs native-mapbox
```

Set the public Mapbox token in the shell or a gitignored `.env` file before Metro bundles the app. The shell variable `MAPBOX_ACCESS_TOKEN` wins. Otherwise the bundle reads `.env` in this directory, then `.env` at the repository root. Copy the root `.env.example` to either place and set the token there, or export the variable in the shell that starts Metro. Do not commit a token. Babel inlines that public value into the local bundle, so a secret token must not be used. Restart Metro after changing it.

Then, from this directory:

```sh
bun install
bundle install
cd ios && bundle exec pod install && cd ..
bun run ios
# or
bun run android
```

Do not install `@maplibre/maplibre-react-native` in this example. Runtime builds are acceptance work; do not launch them from routine checks.
