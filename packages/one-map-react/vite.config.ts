import { defineConfig } from "vite-plus";

import { reactCompiler } from "../../scripts/react-compiler.mjs";

export default defineConfig({
  pack: {
    plugins: [reactCompiler()],
    entry: ["src/**/*.ts", "src/**/*.tsx"],
    outDir: "dist",
    unbundle: true,
    dts: { tsconfig: "../../tsconfig.build.json" },
    tsconfig: "../../tsconfig.build.json",
    format: ["esm"],
    deps: { neverBundle: true },
    exports: false,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  },
});
