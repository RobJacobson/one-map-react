import { existsSync } from "node:fs";
import path from "node:path";

import type { ExpoConfig } from "expo/config";

for (const filename of [".env.local", ".env"]) {
  const envFile = path.resolve(__dirname, "../..", filename);
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
if (
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN === undefined &&
  process.env.MAPBOX_ACCESS_TOKEN !== undefined
)
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
if (token && !token.startsWith("pk."))
  throw new Error("Configure a public Mapbox token beginning with pk.");

/** Regenerates the same dual-engine native configuration from a clean checkout. */
const config: ExpoConfig = {
  name: "One Map",
  slug: "one-map-example",
  scheme: "one-map-example",
  version: "1.0.0",
  ios: { bundleIdentifier: "com.onemap.example", supportsTablet: true },
  android: { package: "com.onemap.example" },
  web: { bundler: "metro", name: "One Map" },
  plugins: [
    ["expo-build-properties", { ios: { enableSceneSupport: true } }],
    ["@rnmapbox/maps", { RNMapboxMapsVersion: "11.23.1" }],
    [
      "@maplibre/maplibre-react-native",
      {
        ios: { nativeVersion: "6.31.0" },
        android: { nativeVersion: "13.6.1" },
      },
    ],
  ],
};

export default config;
