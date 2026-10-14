import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "one-map-tf02-"));
const compiler = join(root, "node_modules/.bin/tsc");
const reactPackage = join(root, "node_modules/react");
const reactTypes = join(root, "node_modules/@types/react");

const backends = [
  "react-map-gl",
  "mapbox-gl",
  "maplibre-gl",
  "@rnmapbox/maps",
  "@maplibre/maplibre-react-native",
  "react-native-teleport",
];

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
  ...[
    ["mapbox-web", "maplibre-native"],
    ["maplibre-web", "mapbox-native"],
  ].flatMap((pair, index) =>
    pair.map((backend) => ({
      name: `mixed-${index}-${backend}`,
      conditions: backend.endsWith("native") ? ["react-native"] : ["browser"],
      entries: [[backend, backend]],
    }))
  ),
];

/** Runs a command and includes output only when it fails. */
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

/** Resolves a package specifier with Node under the given export conditions. */
const resolvePackage = (consumer, specifier, conditions) => {
  const conditionArgs = conditions.flatMap((name) => ["--conditions", name]);
  const resolved = run(
    "node",
    [
      ...conditionArgs,
      "--input-type=module",
      "-e",
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    consumer
  );

  return fileURLToPath(resolved);
};

const walkDeclarations = (file, seen = new Set()) => {
  const declaration = file.endsWith(".d.ts")
    ? file
    : file.replace(/\.js$/, ".d.ts");

  if (seen.has(declaration) || !existsSync(declaration)) {
    return;
  }

  seen.add(declaration);
  const text = readFileSync(declaration, "utf8");
  const specifiers = [
    ...text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g),
    ...text.matchAll(/import\(["']([^"']+)["']\)/g),
  ].map((match) => match[1]);

  for (const specifier of specifiers) {
    for (const backend of backends) {
      assert.notEqual(specifier, backend, `${declaration} imports ${backend}`);
      assert.notEqual(
        specifier.startsWith(`${backend}/`),
        true,
        `${declaration} imports ${specifier}`
      );
    }

    if (specifier.startsWith(".")) {
      walkDeclarations(join(dirname(declaration), specifier), seen);
    }
  }
};

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
    assert(
      files.includes("package/patches/rnmapbox-10.3.7-per-view-events.patch")
    );
    for (const file of files) {
      assert.match(
        file,
        /^package\/(?:dist\/.+|patches\/rnmapbox-10\.3\.7-per-view-events\.patch|package.json|README.md|LICENSE)$/
      );
    }

    for (const scenario of cases) {
      await checkConsumer(archive, scenario);
    }

    console.log(
      `PASS ${cases.length} isolated package selections: common runtime, declaration graph, and export paths.`
    );
    console.log(
      `PACKAGE SHA-256: ${createHash("sha256").update(readFileSync(archive)).digest("hex")}`
    );
    console.log(
      "SCOPE: packed publication, common entry without backend types, and selected-entry file resolution; no wrapper installs, Metro, or native builds."
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
};

const checkConsumer = async (archive, scenario) => {
  const consumer = join(output, scenario.name);
  const installed = join(consumer, "node_modules/one-map-react");
  mkdirSync(installed, { recursive: true });
  run(
    "tar",
    ["-xzf", archive, "--strip-components=1", "-C", installed],
    consumer
  );
  cpSync(reactPackage, join(consumer, "node_modules/react"), {
    recursive: true,
  });
  mkdirSync(join(consumer, "node_modules/@types"), { recursive: true });
  cpSync(reactTypes, join(consumer, "node_modules/@types/react"), {
    recursive: true,
  });
  writeFileSync(
    join(consumer, "package.json"),
    '{"private":true,"type":"module"}\n'
  );

  if (scenario.name === "common") {
    walkDeclarations(join(installed, "dist/index.d.ts"));
    writeFileSync(
      join(consumer, "common.mjs"),
      `import * as common from "one-map-react";
console.log(JSON.stringify(Object.keys(common).sort()));
`
    );
    assert.equal(
      run("node", [join(consumer, "common.mjs")], consumer),
      JSON.stringify([
        "AttributionControl",
        "Control",
        "FullscreenControl",
        "GeolocateControl",
        "Images",
        "Layer",
        "Map",
        "MapSetup",
        "Marker",
        "NavigationControl",
        "Popup",
        "ScaleControl",
        "Source",
        "useMap",
      ])
    );
  }

  for (const [entry, backend] of scenario.entries) {
    const resolved = resolvePackage(
      consumer,
      `one-map-react/${entry}`,
      scenario.conditions
    );
    assert.ok(
      resolved.endsWith(`/dist/${backend}.js`),
      `${scenario.name} ${entry} -> ${resolved}`
    );
  }

  const imports = scenario.entries
    .map(
      ([entry], index) =>
        `import { adapter as selected${index} } from "one-map-react/${entry}";`
    )
    .join("\n");
  const declarations = scenario.entries
    .map(
      ([, backend], index) =>
        `const choice${index}: "${backend}" = selected${index}.backend;`
    )
    .join("\n");

  writeFileSync(
    join(consumer, "selection.tsx"),
    `${imports}
import type { Adapter, Backend } from "one-map-react";
import { Map as OneMap, MapSetup, Source, Layer, Marker, Popup, Control, NavigationControl, AttributionControl, ScaleControl, GeolocateControl, FullscreenControl, useMap } from "one-map-react";
${declarations}
const applicationChoice = (adapter: Adapter): Backend => adapter.backend;
void Marker; void Popup; void Control; void NavigationControl; void AttributionControl; void ScaleControl; void GeolocateControl; void FullscreenControl; void useMap;
void MapSetup;
void Source;
void Layer;
void applicationChoice;
const viewState = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};
const style = { version: 8 as const, sources: {}, layers: [] };
void (
  <OneMap mapStyle={style} initialViewState={viewState} />
);
void (
  <OneMap
    mapStyle={style}
    initialViewState={viewState}
    // @ts-expect-error Invalid map props must not type-check.
    definitelyNotAMapProp
  />
);
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
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        lib: ["ES2022"],
        customConditions: scenario.conditions,
      },
      files: ["selection.tsx"],
    })
  );
  run(compiler, ["-p", "tsconfig.json"], consumer);

  const installedPackages = readdirSync(join(consumer, "node_modules"));
  assert.deepEqual(installedPackages.sort(), [
    "@types",
    "one-map-react",
    "react",
  ]);
};

await main();
