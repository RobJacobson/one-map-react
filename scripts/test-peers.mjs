import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "one-map-peers-"));
const compiler = join(root, "node_modules/.bin/tsc");
const backends = [
  "react-map-gl",
  "mapbox-gl",
  "maplibre-gl",
  "@rnmapbox/maps",
  "@maplibre/maplibre-react-native",
  "react-native-teleport",
];

const peers = {
  "mapbox-web": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "@types/react@19.2.18",
    "react-map-gl@8.1.3",
    "mapbox-gl@3.32.0",
  ],
  "maplibre-web": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "@types/react@19.2.18",
    "react-map-gl@8.1.3",
    "maplibre-gl@6.13.0",
  ],
  "mapbox-native": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "react-native@0.87.1",
    "@types/react@19.2.18",
    "@rnmapbox/maps@10.3.7",
    "react-native-teleport@1.2.1",
  ],
  "maplibre-native": [
    "react@19.2.3",
    "react-dom@19.2.3",
    "react-native@0.87.1",
    "@types/react@19.2.18",
    "@maplibre/maplibre-react-native@11.5.0",
    "react-native-teleport@1.2.1",
    "@types/geojson@7946.0.16",
  ],
};

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

const installedNames = (consumer) => {
  const names = new Set();
  const walk = (directory, scope = "") => {
    if (!directory || !readdirSync(directory, { withFileTypes: true })) {
      return;
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@") && !scope) {
        walk(join(directory, entry.name), entry.name);
        continue;
      }

      names.add(scope ? `${scope}/${entry.name}` : entry.name);
    }
  };

  walk(join(consumer, "node_modules"));
  return names;
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

    for (const [entry, packages] of Object.entries(peers)) {
      await checkPeerConsumer(archive, entry, packages);
    }

    console.log(
      "PASS packed selected-peer consumers: each explicit entry typechecks with only its peers."
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
};

const checkPeerConsumer = async (archive, entry, packages) => {
  const consumer = mkdtempSync(join(output, `${entry}-`));
  writeFileSync(
    join(consumer, "package.json"),
    '{"private":true,"type":"module"}\n'
  );
  run("bun", ["add", archive, ...packages], consumer);

  const names = installedNames(consumer);
  assert.ok(names.has("one-map-react"));
  const otherBackends = backends.filter(
    (backend) => !packages.some((pkg) => pkg.startsWith(`${backend}@`))
  );
  for (const backend of otherBackends) {
    assert.equal(
      names.has(backend),
      false,
      `${entry} consumer installed ${backend}`
    );
  }

  writeFileSync(
    join(consumer, "consumer.tsx"),
    `import { Map as OneMap, MapSetup, Source, Layer } from "one-map-react";
import { adapter } from "one-map-react/${entry}";
import type { Adapter } from "one-map-react";

const selected: Adapter = adapter;
void MapSetup;
void Source;
void Layer;
void selected;
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
        lib: ["ES2022", "DOM"],
        moduleSuffixes: entry.endsWith("native") ? [".native", ""] : [""],
      },
      files: ["consumer.tsx"],
    })
  );
  run(compiler, ["-p", "tsconfig.json"], consumer);

  if (entry.endsWith("web")) {
    writeFileSync(
      join(consumer, "runtime.mjs"),
      `import { adapter } from "one-map-react/${entry}";
console.log(adapter.backend);
`
    );
    assert.equal(run("node", [join(consumer, "runtime.mjs")], consumer), entry);
  }
};

await main();
