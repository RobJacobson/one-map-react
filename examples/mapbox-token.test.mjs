import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { readMapboxAccessToken } from "./mapbox-token.cjs";

const root = mkdtempSync(path.join(tmpdir(), "mapbox-token-"));
const exampleRoot = path.join(root, "examples", "shell");

mkdirSync(exampleRoot, { recursive: true });

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
};

try {
  writeFileSync(path.join(root, ".env"), "MAPBOX_ACCESS_TOKEN=pk.repo\n");
  writeFileSync(
    path.join(exampleRoot, ".env"),
    '# comment\nexport MAPBOX_ACCESS_TOKEN="pk.example"\n'
  );

  assertEqual(
    readMapboxAccessToken(exampleRoot, {
      MAPBOX_ACCESS_TOKEN: "pk.shell",
    }),
    "pk.shell",
    "shell"
  );
  assertEqual(
    readMapboxAccessToken(exampleRoot, { MAPBOX_ACCESS_TOKEN: "  " }),
    "pk.example",
    "example file"
  );
  assertEqual(
    readMapboxAccessToken(exampleRoot, {}),
    "pk.example",
    "example file without shell"
  );

  rmSync(path.join(exampleRoot, ".env"));
  writeFileSync(
    path.join(root, ".env"),
    "MAPBOX_ACCESS_TOKEN='pk.repo' # note\n"
  );
  assertEqual(readMapboxAccessToken(exampleRoot, {}), "pk.repo", "repo file");

  rmSync(path.join(root, ".env"));
  assertEqual(readMapboxAccessToken(exampleRoot, {}), "", "missing");
} finally {
  rmSync(root, { recursive: true, force: true });
}
