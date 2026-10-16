import { dirname, resolve } from "node:path";

import { defineConfig } from "vite-plus";

/** Reuses web regressions against emitted modules, including their internal contexts. */
export default defineConfig({
  plugins: [
    {
      name: "compiled-library-tests",
      enforce: "pre",
      resolveId: (specifier, importer) => {
        if (importer?.includes("/test/") && specifier.startsWith("../src/")) {
          return resolve(dirname(importer), specifier).replace(
            "/src/",
            "/dist/"
          );
        }
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /^one-map-react$/,
        replacement: resolve("packages/one-map-react/dist/index.js"),
      },
    ],
  },
  test: {
    name: "compiled-web",
    include: ["packages/one-map-react/test/**/*.web.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./packages/one-map-react/test/setup-web.ts"],
  },
});
