import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { transformSync } from "@babel/core";
import { expect, test } from "vite-plus/test";

const requireDependency = createRequire(resolve("package.json"));
const requireApp = createRequire(resolve("apps/expo/package.json"));
const requireExpo = createRequire(requireApp.resolve("expo/package.json"));
const requireMetro = createRequire(
  requireExpo.resolve("@expo/metro-config/package.json")
);
const { inlinePlugin, constantFoldingPlugin } = requireMetro(
  "metro-transform-plugins"
);

for (const development of [false, true]) {
  test(`Expo development=${development}: acceptance imports and mounting follow the build mode even with forced true state`, () => {
    const source = readFileSync(resolve("apps/expo/src/app.tsx"), "utf8");
    const compiled = transformSync(source, {
      filename: "app.tsx",
      configFile: resolve("babel.config.cjs"),
    }).code;
    const inlined = transformSync(compiled, {
      configFile: false,
      babelrc: false,
      plugins: [[inlinePlugin, { dev: development, platform: "web" }]],
    }).code;
    const folded = development
      ? inlined
      : transformSync(inlined, {
          configFile: false,
          babelrc: false,
          plugins: [constantFoldingPlugin],
        }).code;
    const imports = [];
    const initialStates = [];
    const changes = [];
    const Acceptance = () => null;
    const exports = {};
    runInNewContext(folded, {
      exports,
      __DEV__: development,
      process: { env: {} },
      require: (name) => {
        imports.push(name);
        if (name.startsWith("react/") || name.startsWith("@babel/runtime/"))
          return requireDependency(name);
        if (name === "react")
          return {
            useState: (initial) => {
              initialStates.push(initial);
              return [true, (next) => changes.push(next)];
            },
          };
        if (name === "@expo/ui") return {};
        if (name === "@one-map/example-map")
          return { publicMapboxToken: () => "pk.fixture" };
        if (name === "react-native")
          return { StyleSheet: { create: (styles) => styles } };
        if (name === "react-native-safe-area-context")
          return { SafeAreaProvider: "SafeAreaProvider" };
        if (name === "./engines") return { configureMapbox: () => {} };
        if (name === "./acceptance")
          return { Acceptance, acceptanceRequested: true };
        throw new Error(`Unexpected app dependency: ${name}`);
      },
    });
    const rendered = exports.App().props.children;
    expect(initialStates).toEqual([development]);
    expect(imports.includes("./acceptance")).toBe(development);
    if (development) {
      expect(rendered.type).toBe(Acceptance);
      rendered.props.close();
      expect(changes).toEqual([false]);
    } else {
      expect(rendered.type).not.toBe(Acceptance);
      expect(typeof rendered.props.openAcceptance).toBe("function");
      expect(folded).not.toMatch(/require\(["']\.\/acceptance["']\)/);
    }
  });
}
