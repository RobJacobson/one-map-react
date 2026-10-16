import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import shellDeps from "../examples/resolve-shell-deps.cjs";

const { shellMetroResolver } = shellDeps;
import {
  packageCheckOptions,
  selectedVersions,
} from "./package-check-options.mjs";

const options = packageCheckOptions();
const evidence = [];
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const root = resolve(import.meta.dirname, "..");
const toolchain = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
).catalog;
const output = mkdtempSync(join(tmpdir(), "one-map-example-resolve-"));

/** Runs a command and throws when the exit status is nonzero. */
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: "" },
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`
  );

  return result.stdout.trim();
};

try {
  const examplesRoot = join(output, "examples");
  for (const engine of ["mapbox", "maplibre"]) {
    const shellRoot = join(examplesRoot, `web-${engine}`);
    mkdirSync(join(shellRoot, "src"), { recursive: true });
    mkdirSync(join(examplesRoot, "shared"), { recursive: true });
    mkdirSync(join(output, "tests/fixtures"), { recursive: true });
    cpSync(
      join(root, "examples/shared/route-map.tsx"),
      join(examplesRoot, "shared/route-map.tsx")
    );
    cpSync(
      join(root, "examples/pin-shell-deps.js"),
      join(examplesRoot, "pin-shell-deps.js")
    );
    cpSync(
      join(root, "tests/fixtures/map.json"),
      join(output, "tests/fixtures/map.json")
    );
    cpSync(
      join(root, "tests/fixtures/map-fixture.ts"),
      join(output, "tests/fixtures/map-fixture.ts")
    );

    let archive = options.archive;
    if (!archive) {
      run(
        "bun",
        ["pm", "pack", "--destination", output, "--ignore-scripts"],
        join(root, "packages/one-map-react")
      );
      const archives = readdirSync(output).filter((name) =>
        name.endsWith(".tgz")
      );
      assert.equal(archives.length, 1);
      archive = join(output, archives[0]);
    }

    writeFileSync(
      join(shellRoot, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        overrides: { vite: toolchain.vite },
      })
    );
    run(
      "bun",
      [
        "add",
        archive,
        ...selectedVersions(
          [
            "react@19.2.3",
            "react-dom@19.2.3",
            "react-map-gl@8.1.3",
            engine === "mapbox" ? "mapbox-gl@3.32.0" : "maplibre-gl@6.13.0",
          ],
          options.versions,
          `${engine}-web`
        ),
        `vite@${toolchain.vite}`,
        `vite-plus@${toolchain["vite-plus"]}`,
        "@vitejs/plugin-react@5.0.4",
      ],
      shellRoot
    );

    const metro = shellMetroResolver(shellRoot);
    assert.equal(metro.disableHierarchicalLookup, true);
    assert.deepEqual(metro.nodeModulesPaths, [join(shellRoot, "node_modules")]);

    writeFileSync(
      join(shellRoot, "src/main.tsx"),
      `import { createRoot } from "react-dom/client";
import { MapSetup } from "one-map-react";
import { adapter } from "one-map-react/${engine}-web";
import { RouteMap } from "../../shared/route-map";

createRoot(document.getElementById("root")).render(
  <MapSetup adapter={adapter}>
    <RouteMap style={{ width: 400, height: 300 }} />
  </MapSetup>
);
`
    );
    writeFileSync(
      join(shellRoot, "index.html"),
      `<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`
    );
    writeFileSync(
      join(shellRoot, "vite.config.ts"),
      `import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { pinBareImportsToShell } from "../pin-shell-deps.js";

const shellRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [pinBareImportsToShell(shellRoot), react(), {
    name: "selected-engine-isolation",
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (id.includes("/${engine === "mapbox" ? "maplibre-gl" : "mapbox-gl"}/") || id.includes("/@rnmapbox/") || id.includes("/@maplibre/maplibre-react-native/")) {
          throw new Error("Unselected engine in bundle: " + id);
        }
      }
    },
  }],
  build: { minify: false },
});
`
    );

    run("bunx", ["vp", "build"], shellRoot);
    const peers = {};
    for (const peer of [
      "react",
      "react-dom",
      "react-map-gl",
      engine === "mapbox" ? "mapbox-gl" : "maplibre-gl",
    ]) {
      peers[peer] = JSON.parse(
        readFileSync(
          join(shellRoot, "node_modules", peer, "package.json"),
          "utf8"
        )
      ).version;
    }
    evidence.push({
      shell: `${engine}-web`,
      archiveSha256: sha256(archive),
      peers,
      lockfileSha256: sha256(join(shellRoot, "bun.lock")),
      status: "passed",
      scope:
        "Vite production build and selected-engine module isolation; no browser renderer",
    });
    console.log(
      `PASS ${engine} shared example: frozen package, selected install and bundle isolation.`
    );
  }
} finally {
  if (options.evidence)
    writeFileSync(
      options.evidence,
      JSON.stringify({ checks: evidence }, null, 2) + "\n"
    );
  rmSync(output, { recursive: true, force: true });
}
