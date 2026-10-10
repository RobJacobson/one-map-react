# one-map-react

A thin React mapping facade under development over RNMapbox, MapLibre React Native, and react-map-gl. Full upstream API coverage and map reuse are project requirements.

**TF01 foundation only:** this package currently exports backend selection descriptors and types. It does not render maps or load the selected wrapper yet.

```ts
import type { Adapter } from "one-map-react";
import { adapter } from "one-map-react/mapbox-web";

const selected: Adapter = adapter;
```

Explicit entries are `mapbox-web`, `maplibre-web`, `mapbox-native`, and `maplibre-native`. Each exports `adapter` with its literal `backend` name. The common entry exports only the `Adapter` and `Backend` types.

The `mapbox` and `maplibre` aliases resolve to web for the `browser` condition, native for `react-native`, and web by default. Browser wins when both conditions are present. Use explicit entries when your toolchain does not apply these conditions. Mixed engine applications can select different entries in their web and native setup modules.

React is required; host runtimes, wrappers, and SDKs are optional peers. Exact peer versions are a candidate baseline for subsequent implementation, not a verified runtime support range. Package selection has been checked with Node, TypeScript, and Bun; renderer behavior, Metro transport, and native linking remain unverified.

Licensed under MIT. See the included LICENSE.
