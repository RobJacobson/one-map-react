import assert from "node:assert/strict";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Installs the version-specific repair shipped by the candidate, then verifies every patched file. */
export const installConsumerPatch = (consumer, peer, run) => {
  const peerRoot = join(consumer, "node_modules", peer);
  const version = JSON.parse(
    readFileSync(join(peerRoot, "package.json"), "utf8")
  ).version;
  const filename = {
    "@rnmapbox/maps@10.3.7": "rnmapbox-10.3.7-tf08.patch",
    "@rnmapbox/maps@10.3.8": "rnmapbox-10.3.8.patch",
    "@maplibre/maplibre-react-native@11.5.0":
      "maplibre-native-11.5.0-tf08.patch",
  }[`${peer}@${version}`];
  assert(filename, `No audited repair for ${peer}@${version}`);
  const shipped = join(
    consumer,
    "node_modules/one-map-react/patches",
    filename
  );
  const patch = readFileSync(shipped, "utf8");
  copyFileSync(shipped, join(consumer, "peer.patch"));
  const manifestPath = join(consumer, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.patchedDependencies = { [`${peer}@${version}`]: "./peer.patch" };
  writeFileSync(manifestPath, JSON.stringify(manifest));
  run("bun", ["install", "--force"], consumer);
  assert.equal(readFileSync(join(consumer, "peer.patch"), "utf8"), patch);
  run("git", ["apply", "--reverse", "--check", shipped], peerRoot);
  const files = [...patch.matchAll(/^diff --git a\/(.+) b\//gm)].map(
    (match) => match[1]
  );
  assert(
    files.some((file) => file.startsWith("src/")),
    "Missing source repair"
  );
  assert(
    files.some((file) => file.startsWith("lib/")),
    "Missing compiled repair"
  );
  assert(
    files.some((file) => file.startsWith("ios/")),
    "Missing iOS repair"
  );
  assert(
    files.some((file) => file.startsWith("android/")),
    "Missing Android repair"
  );
  console.log(
    `PATCH ${peer}@${version}: candidate ${filename}, ${files.length} repaired files verified`
  );
};
