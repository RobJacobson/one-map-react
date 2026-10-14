import { describe, expect, jest, test } from "@jest/globals";

import {
  createOfflineService,
  type OfflineBackend,
  type WrapperOfflinePack,
} from "../src/adapters/shared/offline-service.js";
import type { OfflinePackOptions } from "../src/contracts/offline-types.js";

const options: OfflinePackOptions = {
  id: "ferry",
  mapStyle: "https://example.test/style.json",
  bounds: [
    [-123, 37],
    [-122, 38],
  ],
  minZoom: 1,
  maxZoom: 3,
  metadata: { route: "ferry" },
};
const settle = async () => {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
};
const offlineFixture = (kind: OfflineBackend["kind"] = "maplibre") => {
  const packs: WrapperOfflinePack[] = [];
  const native = new Map<
    string,
    {
      progress: (pack: WrapperOfflinePack, value: unknown) => void;
      error: (pack: WrapperOfflinePack, value: unknown) => void;
    }
  >();
  const observe = jest
    .fn<OfflineBackend["observe"]>()
    .mockImplementation(async (id, progress, error) => {
      native.set(id, { progress, error });
    });
  const unobserve = jest.fn((id: string) => {
    native.delete(id);
  });
  const backend: OfflineBackend = {
    kind,
    state: (value) =>
      value === "complete" || value === "active" || value === "inactive"
        ? value
        : "unknown",
    getPacks: async () => packs,
    create: async (input, metadata) => {
      const pack = {
        id: "generated",
        name: input.id,
        metadata,
        bounds: kind === "mapbox" ? [-122, 38, -123, 37] : [-123, 37, -122, 38],
        status: jest
          .fn<WrapperOfflinePack["status"]>()
          .mockResolvedValue({ state: "complete", percentage: 100 }),
        pause: jest
          .fn<WrapperOfflinePack["pause"]>()
          .mockResolvedValue(undefined),
        resume: jest
          .fn<WrapperOfflinePack["resume"]>()
          .mockResolvedValue(undefined),
      };
      packs.push(pack);
      return pack;
    },
    observe,
    unobserve,
    deletePack: jest
      .fn<OfflineBackend["deletePack"]>()
      .mockResolvedValue(undefined),
    invalidatePack: jest
      .fn<OfflineBackend["invalidatePack"]>()
      .mockResolvedValue(undefined),
  };
  return {
    backend,
    service: createOfflineService(backend),
    packs,
    native,
    observe,
    unobserve,
  };
};

describe("TF08 persistent native packs", () => {
  test.each(["serialized", "object"] as const)(
    "RNMapbox normalizes %s creation bounds and preserves them after lookup",
    async (format) => {
      const fixture = offlineFixture("mapbox");
      const pointPair = {
        type: "FeatureCollection",
        features: [options.bounds[1], options.bounds[0]].map((coordinates) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates },
        })),
      };
      const create = fixture.backend.create;
      jest
        .spyOn(fixture.backend, "create")
        .mockImplementationOnce(async (...args) => {
          const pack = await create(...args);
          const native = {
            ...pack,
            bounds:
              format === "serialized" ? JSON.stringify(pointPair) : pointPair,
          };
          fixture.packs.splice(0, 1, native);
          return native;
        });

      const created = await fixture.service.createPack(options);
      expect(created.bounds).toEqual(options.bounds);
      const restarted = createOfflineService(fixture.backend);
      expect((await restarted.getPack(options.id))?.bounds).toEqual(
        options.bounds
      );
      expect(pointPair.features[0].geometry.coordinates).toEqual(
        options.bounds[1]
      );
    }
  );
  test("RNMapbox rejects malformed GeoJSON pack bounds rather than inventing a region", async () => {
    const fixture = offlineFixture("mapbox");
    const created = await fixture.service.createPack(options);
    const pack = fixture.packs[0];
    for (const bounds of [
      { type: "FeatureCollection", features: [] },
      {
        type: "FeatureCollection",
        features: [{ geometry: { type: "Polygon", coordinates: [] } }],
      },
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [NaN, 38] },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-123, 37] },
          },
        ],
      },
    ]) {
      fixture.packs.splice(0, 1, { ...pack, bounds });
      await expect(fixture.service.getPack(created.id)).rejects.toThrow();
    }
  });
  test.each(["mapbox", "maplibre"] as const)(
    "%s persists logical identity and user metadata across service recreation",
    async (kind) => {
      const fixture = offlineFixture(kind);
      const created = await fixture.service.createPack(options);
      expect(created.id).toBe("ferry");
      expect(created.metadata).toEqual({ route: "ferry" });
      expect(created.bounds).toEqual(options.bounds);
      const restarted = createOfflineService(fixture.backend);
      expect((await restarted.getPack("ferry"))?.id).toBe("ferry");
      expect(await restarted.getPack("absent")).toBeUndefined();
      await expect(restarted.createPack(options)).rejects.toThrow(
        "already exists"
      );
    }
  );
  test("creates a discoverable handle without equating creation with completion", async () => {
    const fixture = offlineFixture();
    const pack = await fixture.service.createPack(options);
    expect(await pack.status()).toMatchObject({
      id: "ferry",
      state: "complete",
      percentage: 100,
    });
    expect(fixture.packs[0].status).toHaveBeenCalledTimes(1);
  });
  test("subscription reads initial terminal state and shares wrapper callbacks", async () => {
    const fixture = offlineFixture();
    await fixture.service.createPack(options);
    const one = jest.fn();
    const two = jest.fn();
    const releaseOne = fixture.service.subscribe("ferry", one, jest.fn());
    const releaseTwo = fixture.service.subscribe("ferry", two, jest.fn());
    await settle();
    expect(one).toHaveBeenCalledWith(
      expect.objectContaining({ state: "complete" })
    );
    expect(two).toHaveBeenCalledWith(
      expect.objectContaining({ state: "complete" })
    );
    expect(fixture.native.size).toBe(1);
    releaseOne();
    await settle();
    const retained = fixture.native.get("generated");
    retained?.progress(fixture.packs[0], { state: "active", percentage: null });
    expect(two).toHaveBeenLastCalledWith({ id: "ferry", state: "active" });
    const count = one.mock.calls.length;
    releaseTwo();
    await settle();
    retained?.progress(fixture.packs[0], { state: "active" });
    expect(one).toHaveBeenCalledTimes(count);
    expect(fixture.native.size).toBe(0);
    expect(fixture.packs[0].pause).not.toHaveBeenCalled();
  });
  test.each([
    { kind: "mapbox", state: "active", percentage: 75 },
    { kind: "mapbox", state: "complete", percentage: 100 },
    { kind: "maplibre", state: "active", percentage: 75 },
    { kind: "maplibre", state: "complete", percentage: 100 },
  ] as const)(
    "$kind delayed initial status cannot overwrite newer $state progress",
    async ({ kind, state, percentage }) => {
      const fixture = offlineFixture(kind);
      const pack = await fixture.service.createPack(options);
      const nativePack = fixture.packs[0];
      let finishReadback: (value: unknown) => void = () => {};
      jest.mocked(nativePack.status).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishReadback = resolve;
          })
      );
      const progress = jest.fn();
      const error = jest.fn();
      const dispose = fixture.service.subscribe(pack.id, progress, error);
      await settle();

      fixture.native
        .get(pack.backendId)
        ?.progress(nativePack, { state, percentage });
      finishReadback({ state: "active", percentage: 50 });
      await settle();

      expect(progress).toHaveBeenCalledTimes(1);
      expect(progress).toHaveBeenLastCalledWith({
        id: pack.id,
        state,
        percentage,
      });
      expect(error).not.toHaveBeenCalled();
      dispose();
      await settle();
    }
  );

  test.each(["mapbox", "maplibre"] as const)(
    "%s duplicate creation preserves existing progress and error subscribers",
    async (kind) => {
      const fixture = offlineFixture(kind);
      const pack = await fixture.service.createPack(options);
      const progress = jest.fn();
      const error = jest.fn();
      const dispose = fixture.service.subscribe("ferry", progress, error);
      await settle();

      await expect(fixture.service.createPack(options)).rejects.toThrow(
        "already exists"
      );
      const observer = fixture.native.get(pack.backendId);
      observer?.progress(fixture.packs[0], { state: "active", percentage: 25 });
      const failure = new Error("download failure");
      observer?.error(fixture.packs[0], failure);

      expect(progress).toHaveBeenLastCalledWith({
        id: "ferry",
        state: "active",
        percentage: 25,
      });
      expect(error).toHaveBeenCalledWith(failure);
      await pack.resume();
      fixture.native.get(pack.backendId)?.progress(fixture.packs[0], {
        state: "active",
        percentage: 50,
      });
      expect(progress).toHaveBeenLastCalledWith({
        id: "ferry",
        state: "active",
        percentage: 50,
      });
      dispose();
      await settle();
    }
  );
  test.each(["resume", "invalidate"] as const)(
    "%s restores observation when completion arrives during preparatory readback",
    async (operation) => {
      const fixture = offlineFixture();
      const pack = await fixture.service.createPack(options);
      const progress = jest.fn();
      const error = jest.fn();
      const dispose = fixture.service.subscribe("ferry", progress, error);
      await settle();
      const nativePack = fixture.packs[0];
      let finishReadback: (value: unknown) => void = () => {};
      jest.mocked(nativePack.status).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishReadback = resolve;
          })
      );

      const restarted =
        operation === "resume"
          ? pack.resume()
          : fixture.service.invalidatePack(pack.id);
      await settle();
      // Both wrappers remove their callback pair after delivering completion.
      fixture.native.get(pack.backendId)?.progress(nativePack, {
        state: "complete",
        percentage: 100,
      });
      fixture.native.delete(pack.backendId);
      finishReadback({ state: "complete", percentage: 100 });
      await restarted;

      const observer = fixture.native.get(pack.backendId);
      observer?.progress(nativePack, { state: "active", percentage: 40 });
      const failure = new Error("restarted download failure");
      observer?.error(nativePack, failure);
      expect(progress).toHaveBeenLastCalledWith({
        id: "ferry",
        state: "active",
        percentage: 40,
      });
      expect(error).toHaveBeenCalledWith(failure);
      dispose();
      await settle();
    }
  );
  test("failed creation releases its own observer and preserves the persisted pack for recovery", async () => {
    const fixture = offlineFixture();
    const create = fixture.backend.create;
    const failure = new Error("post-create observer failure");
    jest
      .spyOn(fixture.backend, "create")
      .mockImplementation(async (...args) => {
        const pack = await create(...args);
        if (!pack.id) throw new Error("Fixture pack has no native identity.");
        fixture.native.set(pack.id, {
          progress: args[2],
          error: args[3],
        });
        throw failure;
      });

    await expect(fixture.service.createPack(options)).rejects.toBe(failure);
    expect(fixture.native.size).toBe(0);
    expect((await fixture.service.getPack("ferry"))?.metadata).toEqual({
      route: "ferry",
    });
    expect(fixture.backend.deletePack).not.toHaveBeenCalled();
  });
  test("disposing before asynchronous setup retains no native observer", async () => {
    const fixture = offlineFixture();
    await fixture.service.createPack(options);
    const dispose = fixture.service.subscribe("ferry", jest.fn(), jest.fn());
    dispose();
    await settle();
    expect(fixture.observe).not.toHaveBeenCalled();
  });
  test("resume reattaches a completed observer before native dispatch", async () => {
    const fixture = offlineFixture();
    const pack = await fixture.service.createPack(options);
    const dispose = fixture.service.subscribe("ferry", jest.fn(), jest.fn());
    await settle();
    fixture.native
      .get("generated")
      ?.progress(fixture.packs[0], { state: "complete" });
    fixture.native.clear();
    await pack.resume();
    expect(fixture.native.size).toBe(1);
    expect(fixture.packs[0].resume).toHaveBeenCalledTimes(1);
    dispose();
    await settle();
  });
  test("storage errors stay failures and imported packs have explicit backend identity", async () => {
    const fixture = offlineFixture();
    await fixture.service.createPack(options);
    const imported = {
      ...fixture.packs[0],
      id: "imported",
      metadata: { external: true },
    };
    fixture.packs.push(imported);
    expect(
      (await fixture.service.getPack("backend:imported"))?.metadata
    ).toEqual({ external: true });
    jest
      .spyOn(fixture.backend, "getPacks")
      .mockRejectedValue(new Error("database failure"));
    await expect(fixture.service.getPack("missing")).rejects.toThrow(
      "database failure"
    );
  });
  test("duplicate persisted IDs require explicit reconciliation", async () => {
    const fixture = offlineFixture();
    await fixture.service.createPack(options);
    fixture.packs.push({ ...fixture.packs[0], id: "second" });
    await expect(fixture.service.getPacks()).rejects.toThrow(
      "Duplicate persisted"
    );
  });
  test.each([
    { minZoom: -1 },
    { maxZoom: 0 },
    {
      bounds: [
        [170, 1],
        [-170, 2],
      ],
    },
    { metadata: { invalid: undefined } },
    { metadata: { invalid: Infinity } },
  ])(
    "rejects invalid download input %# before native creation",
    async (changes) => {
      const fixture = offlineFixture();
      await expect(
        fixture.service.createPack({
          ...options,
          ...changes,
        } as OfflinePackOptions)
      ).rejects.toThrow();
      expect(fixture.packs).toHaveLength(0);
    }
  );
});
