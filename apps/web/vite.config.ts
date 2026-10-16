import path from "node:path";

import { publicMapboxToken } from "@one-map/example-map";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite-plus";

export default defineConfig(({ mode }) => {
  const root = path.resolve(import.meta.dirname, "../..");
  const env = loadEnv(mode, root, ["EXPO_PUBLIC_", "MAPBOX_ACCESS_TOKEN"]);
  const token = publicMapboxToken(
    env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? env.MAPBOX_ACCESS_TOKEN
  );
  return {
    plugins: [react()],
    envDir: root,
    define: {
      "import.meta.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN": JSON.stringify(token),
    },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "mapbox-gl",
        "maplibre-gl",
        "react-map-gl",
      ],
    },
    server: { port: 5173, strictPort: true },
  };
});
