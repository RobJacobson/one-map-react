import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/**/*.ts", "src/**/*.tsx"],
    outDir: "dist",
    unbundle: true,
    dts: true,
    tsconfig: "tsconfig.json",
    format: ["esm"],
    deps: { neverBundle: true },
    exports: false,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  },
});
