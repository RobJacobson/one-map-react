import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "one-map-tf01-"));
const compiler = join(root, "node_modules/.bin/tsc");

const explicit = [
  "mapbox-web",
  "maplibre-web",
  "mapbox-native",
  "maplibre-native",
];
const cases = [
  { name: "common", conditions: [], entries: [] },
  ...explicit.map((backend) => ({
    name: backend,
    conditions: [],
    entries: [[backend, backend]],
  })),
  ...[[], ["browser"], ["react-native"], ["browser", "react-native"]].map(
    (conditions) => ({
      name: `aliases-${conditions.join("-") || "default"}`,
      conditions,
      entries: ["mapbox", "maplibre"].map((engine) => [
        engine,
        `${engine}-${conditions.includes("react-native") && !conditions.includes("browser") ? "native" : "web"}`,
      ]),
    })
  ),
  // Each pair models a .web/.native setup module; application selection code is shared.
  ...[
    ["mapbox-web", "maplibre-native"],
    ["maplibre-web", "mapbox-native"],
  ].flatMap((backends, pair) =>
    backends.map((backend) => ({
      name: `mixed-${pair}-${backend}`,
      conditions: backend.endsWith("native") ? ["react-native"] : ["browser"],
      entries: [[backend, backend]],
    }))
  ),
];

/** Runs a package check and includes output only when it fails. */
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: "" },
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`
  );
  return result.stdout.trim();
};

/** Packs once, then resolves the real publication in consumers outside the workspace. */
const main = async () => {
  try {
    run(
      "bun",
      ["pm", "pack", "--destination", output, "--ignore-scripts"],
      join(root, "packages/one-map-react")
    );
    const archives = readdirSync(output).filter((name) =>
      name.endsWith(".tgz")
    );
    assert.equal(archives.length, 1);
    const archive = join(output, archives[0]);
    const files = run("tar", ["-tzf", archive], output).split("\n");
    assert(files.includes("package/LICENSE"));
    assert(files.includes("package/README.md"));
    assert(files.includes("package/dist/index.d.ts"));
    assert(files.includes("package/dist/index.js"));
    for (const file of files) {
      assert.match(
        file,
        /^package\/(?:dist\/[^/]+|package.json|README.md|LICENSE)$/
      );
    }
    for (const scenario of cases) {
      await checkConsumer(archive, scenario);
    }
    console.log(
      `PASS ${cases.length} isolated package selections: Node, TypeScript, and Bun bundling.`
    );
    console.log(
      `PACKAGE SHA-256: ${createHash("sha256").update(readFileSync(archive)).digest("hex")}`
    );
    console.log(
      "SCOPE: selection descriptors only; no wrapper loading, renderer, Metro, or native build claims."
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
};

/** No peer packages or workspace links may mask an import from the common/selection entries. */
const checkConsumer = async (archive, scenario) => {
  const consumer = join(output, scenario.name);
  const installed = join(consumer, "node_modules/one-map-react");
  mkdirSync(installed, { recursive: true });
  run(
    "tar",
    ["-xzf", archive, "--strip-components=1", "-C", installed],
    consumer
  );
  writeFileSync(
    join(consumer, "package.json"),
    '{"private":true,"type":"module"}\n'
  );
  const imports = scenario.entries
    .map(
      ([entry], index) =>
        `import { adapter as selected${index} } from "one-map-react/${entry}";`
    )
    .join("\n");
  const values = scenario.entries.map((_, index) => `selected${index}.backend`);
  const runtime = `${imports}
import * as common from "one-map-react";
console.log(JSON.stringify([Object.keys(common), ${values.join(", ")} ]));
`;
  const expected = JSON.stringify([
    [],
    ...scenario.entries.map(([, backend]) => backend),
  ]);
  const entry = join(consumer, "selection.mjs");
  writeFileSync(entry, runtime);
  const conditions = scenario.conditions.map(
    (condition) => `--conditions=${condition}`
  );
  assert.equal(run("node", [...conditions, entry], consumer), expected);

  const declarations = scenario.entries
    .map(
      ([, backend], index) =>
        `const choice${index}: "${backend}" = selected${index}.backend;`
    )
    .join("\n");
  writeFileSync(
    join(consumer, "selection.ts"),
    `${imports}
import type { Adapter, Backend } from "one-map-react";
${declarations}
const applicationChoice = (adapter: Adapter): Backend => adapter.backend;
// @ts-expect-error An arbitrary backend must not type-check.
const invalid: Adapter = { backend: "automatic" };
`
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        lib: ["ES2022"],
        customConditions: scenario.conditions,
      },
      files: ["selection.ts"],
    })
  );
  run(compiler, ["-p", "tsconfig.json"], consumer);

  const result = await Bun.build({
    entrypoints: [entry],
    target: scenario.conditions.includes("browser") ? "browser" : "bun",
    conditions: scenario.conditions,
    format: "esm",
    outdir: join(consumer, "bundle"),
  });
  assert(result.success, result.logs.join("\n"));
  assert.equal(run("node", [result.outputs[0].path], consumer), expected);
  assert.deepEqual(readdirSync(join(consumer, "node_modules")), [
    "one-map-react",
  ]);
};

await main();
