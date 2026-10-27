import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { shellMetroResolver } = require("./resolve-shell-deps.cjs");
const root = path.resolve(import.meta.dirname, "..");
const shells = process.argv.slice(2);
if (shells.length !== 2)
  throw new Error(
    "Pass both installed native consumer directories; no Metro server is started."
  );
const temporary = realpathSync(
  mkdtempSync(path.join(tmpdir(), "one-map-resolver-"))
);
const cases = [];
try {
  for (const name of [
    "plain.ts",
    "jsx.tsx",
    "same.js",
    "same.native.ts",
    "platform.ts",
    "platform.native.ts",
    "platform.ios.ts",
    "platform.android.ts",
  ])
    writeFileSync(path.join(temporary, name), "export const value = 1;\n");
  for (const shell of shells) {
    const effective = require(
      path.join(path.resolve(shell), "metro.config.cjs")
    );
    const resolver = {
      ...effective.resolver,
      ...shellMetroResolver(path.resolve(shell)),
    };
    const context = (originModulePath) => ({
      ...resolver,
      originModulePath,
      preferNativePlatform: true,
      assetExts: new Set(effective.resolver.assetExts),
      sourceExts: effective.resolver.sourceExts,
      getPackage: (file) => JSON.parse(readFileSync(file, "utf8")),
      getPackageForModule: () => null,
      redirectModulePath: (file) => file,
      doesFileExist: (file) => existsSync(file) && statSync(file).isFile(),
      fileSystemLookup: (file) =>
        existsSync(file)
          ? {
              exists: true,
              type: statSync(file).isDirectory() ? "d" : "f",
              realPath: realpathSync(file),
            }
          : { exists: false },
      mainFields: ["react-native", "browser", "main"],
      unstable_enablePackageExports: false,
    });
    const resolve = (origin, name, platform) =>
      resolver.resolveRequest(
        { ...context(origin), preferNativePlatform: platform !== "web" },
        name,
        platform
      ).filePath;
    for (const platform of ["ios", "android"]) {
      const capture = resolve(
        path.join(root, "examples/shared/tf09-scene.tsx"),
        "./capture-rendering.js",
        platform
      );
      assert.equal(
        capture,
        path.join(root, "examples/shared/capture-rendering.native.ts")
      );
      for (const pair of [
        "mapbox-web-maplibre-native",
        "maplibre-web-mapbox-native",
      ])
        assert.equal(
          resolve(
            path.join(root, "examples/native-mapbox/App.tsx"),
            `../mixed/${pair}/setup.js`,
            platform
          ),
          path.join(root, "examples/mixed", pair, "setup.native.ts")
        );
      for (const [name, expected] of [
        ["plain.js", "plain.ts"],
        ["jsx.js", "jsx.tsx"],
        ["same.js", "same.js"],
        ["platform.js", `platform.${platform}.ts`],
      ])
        assert.equal(
          resolve(path.join(temporary, "origin.ts"), `./${name}`, platform),
          path.join(temporary, expected)
        );
      assert.equal(
        resolve(path.join(temporary, "origin.ts"), "react", platform),
        path.join(path.resolve(shell), "node_modules/react/index.js")
      );
      for (const missing of [
        "./missing.js",
        "./missing.ts",
        "missing-package",
      ]) {
        const { resolve: metroResolve } = require(
          require.resolve("metro-resolver", { paths: [path.resolve(shell)] })
        );
        let original;
        try {
          metroResolve(
            {
              ...context(path.join(temporary, "origin.ts")),
              resolveRequest: undefined,
            },
            missing,
            platform
          );
        } catch (error) {
          original = error;
        }
        assert(original);
        assert.throws(
          () => resolve(path.join(temporary, "origin.ts"), missing, platform),
          (error) =>
            error.constructor === original.constructor &&
            error.message === original.message
        );
      }
      cases.push(`${path.basename(shell)}:${platform}`);
    }
    assert.equal(
      resolve(
        path.join(root, "examples/shared/tf09-scene.tsx"),
        "./capture-rendering.js",
        "web"
      ),
      path.join(root, "examples/shared/capture-rendering.ts")
    );
    assert.equal(
      resolve(path.join(temporary, "origin.ts"), "./platform.js", "web"),
      path.join(temporary, "platform.ts")
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(
  `PASS actual Metro resolver: ${cases.join(", ")}; native/platform precedence, generic TS/TSX, existing JS, browser fallback, package resolution and original errors.`
);
