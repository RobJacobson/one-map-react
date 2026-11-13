import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const nativeRequire = createRequire(
  require.resolve("react-native/package.json")
);
const codegen = dirname(
  nativeRequire.resolve("@react-native/codegen/package.json")
);
const { combineSchemasInFileList } = require(
  join(codegen, "lib/cli/combine/combine-js-to-schema.js")
);
const generator = require(
  join(codegen, "lib/generators/modules/GenerateModuleObjCpp/index.js")
);
const declarations = [];

// Helper precedes eager generation so its const binding is initialized.
/** Checks source, emitted and native references agree without changing the runtime module name. */
const verifyMapboxNamespace = (root) => {
  const { version } = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8")
  );
  if (version !== "10.3.8") return;

  for (const file of [
    "src/specs/NativeRNMBXMapViewModule.ts",
    "lib/module/specs/NativeRNMBXMapViewModule.js",
    "lib/typescript/src/specs/NativeRNMBXMapViewModule.d.ts",
  ]) {
    assert(existsSync(join(root, file)), `Missing renamed spec: ${file}`);
    assert(!existsSync(join(root, file.replace("NativeRNMBX", "Native"))));
  }
  for (const file of [
    "src/components/MapView.tsx",
    "lib/module/components/MapView.js",
  ]) {
    assert.match(
      readFileSync(join(root, file), "utf8"),
      /specs\/NativeRNMBXMapViewModule/
    );
  }
  for (const file of [
    "src/specs/NativeRNMBXMapViewModule.ts",
    "lib/module/specs/NativeRNMBXMapViewModule.js",
  ]) {
    assert.match(
      readFileSync(join(root, file), "utf8"),
      /getEnforcing(?:<Spec>)?\('RNMBXMapViewModule'\)/
    );
  }
  for (const file of [
    "android/src/main/java/com/rnmapbox/rnmbx/components/mapview/NativeMapViewModule.kt",
    "ios/RNMBX/RNMBXMapViewModule.h",
    "ios/RNMBX/RNMBXMapViewModule.mm",
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    assert.match(source, /NativeRNMBXMapViewModuleSpec/);
    assert.doesNotMatch(source, /\bNativeMapViewModuleSpec/);
  }
  for (const file of [
    "lib/module/specs/NativeMapViewModule.js.map",
    "lib/typescript/src/specs/NativeMapViewModule.d.ts.map",
  ]) {
    const map = JSON.parse(readFileSync(join(root, file), "utf8"));
    assert(
      map.sources.every((source) =>
        source.endsWith("NativeRNMBXMapViewModule.ts")
      )
    );
  }
};

for (const [peer, override] of [
  ["@rnmapbox/maps", process.argv[2]],
  ["@maplibre/maplibre-react-native", process.argv[3]],
]) {
  const root = override
    ? resolve(override)
    : dirname(require.resolve(`${peer}/package.json`));
  const { codegenConfig } = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8")
  );
  const schema = combineSchemasInFileList(
    [join(root, codegenConfig.jsSrcsDir)],
    "ios"
  );
  const output = [
    ...generator.generate(codegenConfig.name, schema).values(),
  ].join("\n");
  const symbols = new Set(
    [
      ...output.matchAll(/(?:@protocol|@interface|class JSI_EXPORT) (\w+)/g),
    ].map((match) => match[1])
  );
  assert(symbols.size > 0, `${peer} generated no native module declarations`);
  declarations.push(symbols);
}
const collisions = [...declarations[0]].filter((symbol) =>
  declarations[1].has(symbol)
);
assert.deepEqual(
  collisions,
  [],
  "Both native peers must generate distinct global module classes/protocols"
);
verifyMapboxNamespace(
  process.argv[2]
    ? resolve(process.argv[2])
    : dirname(require.resolve("@rnmapbox/maps/package.json"))
);

console.log(
  "PASS dual native codegen: real pinned React Native generator emits no shared module classes or protocols."
);
