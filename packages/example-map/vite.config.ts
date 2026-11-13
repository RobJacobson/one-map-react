import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/**/*.ts", "src/**/*.tsx"],
    outDir: "dist",
    unbundle: true,
    dts: true,
    tsconfig: "tsconfig.json",
    format: ["esm"],
    // Metro must retain literal requires so it can register delayed native peers.
    outputOptions: { polyfillRequire: false },
    deps: { neverBundle: true },
    exports: false,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  },
});
