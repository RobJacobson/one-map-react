# MapLibre native example

React Native 0.87 shell around the shared Seattle route map, using `one-map-react/maplibre-native`. The `app.json` name is `OneMapMaplibre`; the generator uses the same name so the native module matches `AppRegistry`.

From the repository root, `bun run build` writes the package `dist/` this shell imports. Then generate the ignored `ios/` and `android/` trees. This command copies the template `Gemfile` as well. It does not install JavaScript packages or CocoaPods, and it does not build or launch an app:

```sh
bun scripts/setup-native-example.mjs native-maplibre
```

Then, from this directory:

```sh
bun install
bundle install
cd ios && bundle exec pod install && cd ..
bun run ios
# or
bun run android
```

Do not install `@rnmapbox/maps` in this example. Runtime builds are acceptance work; do not launch them from routine checks.
