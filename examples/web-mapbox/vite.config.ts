import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { pinBareImportsToShell } from "../pin-shell-deps.js";

const shellRoot = path.dirname(fileURLToPath(import.meta.url));

// Vite bundles this config and cannot bundle the helper's node:fs require.
const { readMapboxAccessToken } = createRequire(import.meta.url)(
  "../mapbox-token.cjs"
) as { readMapboxAccessToken: (exampleRoot: string) => string };

export default defineConfig(() => {
  const mapboxAccessToken = readMapboxAccessToken(shellRoot);

  return {
    cacheDir: process.env.ONE_MAP_SMOKE_CACHE_ROOT
      ? path.join(
          process.env.ONE_MAP_SMOKE_CACHE_ROOT,
          "web-mapbox/node_modules/.vite"
        )
      : undefined,
    plugins: [pinBareImportsToShell(shellRoot), react()],
    // Public token from the shell or a .env file. Only this value
    // reaches the client.
    define: {
      "import.meta.env.MAPBOX_ACCESS_TOKEN": JSON.stringify(mapboxAccessToken),
    },
    // One React copy. Otherwise the optimizer inlines a second React into
    // react-map-gl and its hooks see a null dispatcher. Leave react-map-gl
    // unbundled so its mapbox-gl import is the same module that receives
    // the access token.
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "mapbox-gl",
        "react-map-gl",
        "@vis.gl/react-mapbox",
      ],
    },
    optimizeDeps: {
      include: ["mapbox-gl"],
      exclude: ["react-map-gl"],
    },
    server: {
      fs: {
        allow: ["../.."],
      },
    },
  };
});
