import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { encodeLifetimesTile } from "./tf06-lifetimes-fixture.mjs";

// Decode through the existing renderer dependencies; add no fixture-only peer.
const rootRequire = createRequire(import.meta.url);
const rendererRequire = createRequire(rootRequire.resolve("mapbox-gl"));
const vectorRequire = createRequire(
  rendererRequire.resolve("@mapbox/vector-tile")
);
const { VectorTile } = await import(
  vectorRequire.resolve("@mapbox/vector-tile")
);
const { PbfReader } = await import(vectorRequire.resolve("pbf"));

for (const revision of [0, 1, 2, 4, 5]) {
  const tile = new VectorTile(
    new PbfReader(encodeLifetimesTile(revision, 11, 328, 715))
  );
  assert.deepEqual(Object.keys(tile.layers).sort(), ["alternates", "routes"]);
  for (const name of ["routes", "alternates"]) {
    const layer = tile.layers[name];
    assert.equal(layer.version, 2);
    assert.equal(layer.extent, 4096);
    assert.equal(layer.length, 2);
    const features = [layer.feature(0), layer.feature(1)];
    assert.deepEqual(
      features.map((feature) => feature.id),
      [1, 2]
    );
    for (const feature of features) {
      assert.equal(feature.properties.__oneMapSourceRevision, revision);
      const geometry = feature.toGeoJSON(328, 715, 11).geometry;
      assert.equal(geometry.type, "LineString");
      assert.equal(geometry.coordinates.length, 2);
      assert.ok(Math.abs(geometry.coordinates[0][0] - -122.341) < 0.00003);
      const expectedLatitude = feature.id === 1 ? 47.61 : 47.605;
      assert.ok(
        Math.abs(geometry.coordinates[0][1] - expectedLatitude) < 0.00003
      );
    }
  }
}
const empty = new VectorTile(
  new PbfReader(encodeLifetimesTile(3, 11, 329, 715))
);
assert.deepEqual(Object.keys(empty.layers), []);
console.log(
  "PASS TF06 lifetime MVT fixture: IDs, layer namespaces, generation, geometry, and empty-neighbor tile."
);
