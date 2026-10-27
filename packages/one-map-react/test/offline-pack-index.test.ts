import { describe, expect, test } from "vite-plus/test";

import {
  findOfflinePack,
  readOfflinePackIndex,
} from "../../../examples/shared/offline-pack-index.js";

describe("application offline metadata discovery", () => {
  test("retains old IDs and user metadata while keeping native operation keys", () => {
    const metadata = {
      oneMapReactOffline: { version: 1, id: "harbor" },
      user: { test: "tf08", fixtureStyle: "https://example.test/legacy-style" },
    };
    const packs = [{ nativeId: "generated-3", metadata }];
    const before = JSON.stringify(packs);
    const records = readOfflinePackIndex(packs);
    expect(findOfflinePack(records, "harbor")).toMatchObject({
      nativeId: "generated-3",
      user: { test: "tf08", fixtureStyle: "https://example.test/legacy-style" },
    });
    expect(findOfflinePack(records, "backend:generated-3")).toBe(records[0]);
    expect(JSON.stringify(packs)).toBe(before);
    expect(records[0].metadata).toBe(metadata);
  });

  test("supports RNMapbox names, imported aliases and new regionId metadata", () => {
    const records = readOfflinePackIndex([
      {
        nativeId: "old-name",
        metadata: JSON.stringify({
          oneMapReactOffline: { version: 1, id: "old-app" },
          user: {},
        }),
      },
      { nativeId: "imported", metadata: { external: true } },
      { nativeId: "new-generated", metadata: { regionId: "new-app" } },
    ]);
    expect(findOfflinePack(records, "old-app")?.nativeId).toBe("old-name");
    expect(findOfflinePack(records, "backend:imported")?.user).toEqual({
      external: true,
    });
    expect(findOfflinePack(records, "new-app")?.nativeId).toBe("new-generated");
    expect(findOfflinePack(records, "missing")).toBeUndefined();
  });

  test("reports malformed and duplicate records without hiding or mutating them", () => {
    const packs = [
      { nativeId: "one", metadata: { regionId: "duplicate" } },
      {
        nativeId: "two",
        metadata: {
          oneMapReactOffline: { version: 1, id: "duplicate" },
          user: {},
        },
      },
      { nativeId: "bad-json", metadata: "{" },
      {
        nativeId: "bad-envelope",
        metadata: { oneMapReactOffline: { version: 2, id: "old" }, user: {} },
      },
      {
        nativeId: "bad-user",
        metadata: { oneMapReactOffline: { version: 1, id: "old" }, user: [] },
      },
    ];
    const records = readOfflinePackIndex(packs);
    expect(records).toHaveLength(packs.length);
    expect(records.every((record) => record.issues.length > 0)).toBe(true);
    for (const id of [
      "duplicate",
      "backend:one",
      "backend:bad-json",
      "backend:bad-envelope",
      "backend:bad-user",
    ])
      expect(() => findOfflinePack(records, id)).toThrow("metadata issues");
    expect(records[2].metadata).toBe("{");
  });

  test("reports collisions between imported aliases and application identities", () => {
    const records = readOfflinePackIndex([
      { nativeId: "same", metadata: {} },
      { nativeId: "same", metadata: { regionId: "other" } },
    ]);
    expect(() => findOfflinePack(records, "backend:same")).toThrow();
  });
});
