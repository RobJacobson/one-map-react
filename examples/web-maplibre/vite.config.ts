import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { pinBareImportsToShell } from "../pin-shell-deps.js";

const shellRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  cacheDir: process.env.ONE_MAP_SMOKE_CACHE_ROOT
    ? path.join(
        process.env.ONE_MAP_SMOKE_CACHE_ROOT,
        "web-maplibre/node_modules/.vite"
      )
    : undefined,
  plugins: [pinBareImportsToShell(shellRoot), react()],
  // One React copy. Otherwise the optimizer inlines a second React into
  // react-map-gl and its hooks see a null dispatcher.
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "maplibre-gl",
      "react-map-gl",
      "@vis.gl/react-maplibre",
    ],
  },
  // Keep MapLibre out of the prebundle so its worker stays beside the library.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    fs: {
      allow: ["../.."],
    },
  },
});
