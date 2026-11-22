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
import { join, resolve } from "node:path";

import { build } from "vite-plus";

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
  let archive = options.archive;
  if (!archive) {
    run(
      "bun",
      ["pm", "pack", "--destination", output, "--ignore-scripts"],
      join(root, "packages/one-map-react")
    );
    const archives = readdirSync(output).filter((file) =>
      file.endsWith(".tgz")
    );
    assert.equal(archives.length, 1);
    archive = join(output, archives[0]);
  }
  for (const engine of ["mapbox", "maplibre"]) {
    const shellRoot = join(output, engine);
    mkdirSync(shellRoot);
    const reference = join(root, "packages/example-map/reference");
    for (const file of ["VesselMap.tsx", "vessel-fixture.ts"]) {
      cpSync(join(reference, file), join(shellRoot, file));
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
        ...selectedVersions(
          [
            "@types/react@19.2.18",
            "@types/geojson@7946.0.16",
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

    writeFileSync(
      join(shellRoot, "index.html"),
      '<main id="root"></main><script type="module" src="/main.tsx"></script>'
    );
    writeFileSync(
      join(shellRoot, "main.tsx"),
      `
import { createRoot } from "react-dom/client";
import { VesselMap } from "./VesselMap";
createRoot(document.getElementById("root")).render(<VesselMap Controls={() => null} MarkerContent={() => null} />);
`
    );
    writeFileSync(
      join(shellRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "Bundler",
          target: "ES2022",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        files: ["VesselMap.tsx"],
      })
    );
    for (const stock of [true, false]) {
      if (stock) {
        assert(!existsSync(join(shellRoot, "node_modules/one-map-react")));
        cpSync(
          join(reference, engine === "mapbox" ? "maps.mapbox.ts" : "maps.ts"),
          join(shellRoot, "maps.ts")
        );
      } else {
        run("bun", ["add", archive], shellRoot);
        writeFileSync(
          join(shellRoot, "maps.ts"),
          `export * from "one-map-react/${engine}";`
        );
      }
      writeFileSync(
        join(shellRoot, "vite.config.ts"),
        `
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
export default defineConfig({
  plugins: [react(), {
    name: "selected-engine-isolation",
    generateBundle() {
      const modules = [...this.getModuleIds()];
      if (!modules.some(id => id.includes("/${engine}-gl/"))) throw new Error("Missing selected SDK");
      const forbidden = ${JSON.stringify([engine === "mapbox" ? "maplibre-gl" : "mapbox-gl", "@rnmapbox/maps", "@maplibre/maplibre-react-native", ...(stock ? ["one-map-react"] : [])])};
      for (const id of modules) {
        if (forbidden.some(pkg => id.includes("/" + pkg + "/"))) throw new Error("Unexpected module: " + id);
      }
    }
  }],
  build: { minify: false },
});
`
      );
      run(
        join(root, "node_modules/.bin/tsc"),
        ["-p", "tsconfig.json"],
        shellRoot
      );
      run("bunx", ["vp", "build"], shellRoot);
    }
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
        "Direct stock and packed alias TypeScript and Vite builds, with selected-engine isolation; no browser renderer",
    });
    console.log(
      `PASS ${engine} shared example: frozen package, selected install and bundle isolation.`
    );
  }
  // Include development routes, where native imports in a shared scene can
  // survive even when the production basemap renders stock components.
  await build({
    root: join(root, "apps/web"),
    define: { "import.meta.env.DEV": "true" },
    build: { write: false, minify: false },
    logLevel: "error",
    plugins: [
      {
        name: "verify-stock-browser-scenes",
        generateBundle() {
          const ids = [...this.getModuleIds()];
          assert(
            ids.some((id) => id.endsWith("/scenarios/web-queries-app.js")),
            "Missing web development scenarios"
          );
          for (const id of ids) {
            assert(
              ![
                "/one-map-react/",
                "/@rnmapbox/maps/",
                "/@maplibre/maplibre-react-native/",
              ].some((path) => id.includes(path)),
              `Browser scenario imported native code: ${id}`
            );
          }
        },
      },
    ],
  });
  console.log(
    "PASS maintained Vite basemap and development routes load stock browser components without the native shim."
  );
} finally {
  if (options.evidence)
    writeFileSync(
      options.evidence,
      JSON.stringify({ checks: evidence }, null, 2) + "\n"
    );
  rmSync(output, { recursive: true, force: true });
}
