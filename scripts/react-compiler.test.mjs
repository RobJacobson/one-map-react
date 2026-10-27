import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseSync, transformSync, traverse } from "@babel/core";
import compiler from "babel-plugin-react-compiler";

import { reactCompiler } from "./react-compiler.mjs";

// Check the actual component, since another compiled hook in its file proves nothing.
for (const [relative, names] of [
  ["facade/map.tsx", ["Map", "useMapAttachment"]],
  ["facade/source.tsx", ["Source"]],
  ["facade/use-stable-options.ts", ["useStableOptions"]],
  ["adapters/shared/use-frozen-value.ts", ["useFrozenValue"]],
  ["adapters/shared/native-marker-overlay.tsx", ["NativeMarkerOverlay"]],
  ["facade/user-location.tsx", ["UserLocation"]],
  ["adapters/web/map.tsx", ["WebMap", "useWebPadding"]],
  ["adapters/web/images.tsx", ["WebImages", "WebImage"]],
  ["facade/use-map-interactions.ts", ["useMapInteractions"]],
  ["adapters/shared/native-ui.tsx", ["useNativeMarkerActivation"]],
  [
    "adapters/shared/native-map-presentation.tsx",
    ["NativePresentationProvider", "NativeCameraProvider"],
  ],
]) {
  const filename = resolve("packages/one-map-react/src", relative);
  const source = readFileSync(filename, "utf8");
  const options = {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
  };
  const ast = parseSync(source, options);
  const locations = new Map();
  traverse(ast, {
    VariableDeclarator(path) {
      if (names.includes(path.node.id.name)) {
        const init = path.node.init;
        locations.set(
          path.node.id.name,
          init.type === "CallExpression" ? init.arguments[0].start : init.start
        );
      }
    },
  });
  const successes = new Set();
  transformSync(source, {
    ...options,
    plugins: [
      [
        compiler,
        {
          target: "19",
          logger: {
            logEvent: (_file, event) => {
              if (event.kind === "CompileSuccess")
                successes.add(event.fnLoc.start.index);
            },
          },
        },
      ],
    ],
  });
  for (const name of names)
    assert(
      successes.has(locations.get(name)),
      `${relative}: ${name} was skipped`
    );
  const transformed = await reactCompiler().transform.handler(source, filename);
  assert.match(transformed.code, /react\/compiler-runtime/);
  assert(
    transformed.map,
    "Compiler must preserve source mapping for the packer"
  );
  const built = readFileSync(
    resolve("packages/one-map-react/dist", relative.replace(/\.tsx?$/, ".js")),
    "utf8"
  );
  assert(
    /react\/compiler-runtime/.test(built),
    `${relative}: emitted compiler runtime missing`
  );
  assert.doesNotMatch(built, /react-compiler-runtime/);
}
console.log(
  "PASS compiler transform, emitted runtime and selected component compilation."
);
