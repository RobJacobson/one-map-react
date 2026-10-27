import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { WrapperOfflineManager as Mapbox } from "one-map-react/mapbox-native";
import { WrapperOfflineManager as Maplibre } from "one-map-react/maplibre-native";

import { createMapboxOfflineCommands } from "../../../examples/shared/mapbox-offline-commands.js";
import { createMaplibreOfflineCommands } from "../../../examples/shared/maplibre-offline-commands.js";

jest.mock("one-map-react/mapbox-native", () => ({
  WrapperOfflineManager: {
    getPacks: jest.fn(),
    getPack: jest.fn(),
    createPack: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    deletePack: jest.fn(),
    invalidatePack: jest.fn(),
  },
}));
jest.mock("one-map-react/maplibre-native", () => ({
  WrapperOfflineManager: {
    getPacks: jest.fn(),
    getPack: jest.fn(),
    createPack: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    deletePack: jest.fn(),
    invalidatePack: jest.fn(),
  },
}));

type MapboxPack = NonNullable<Awaited<ReturnType<typeof Mapbox.getPack>>>;
type MaplibrePack = Awaited<ReturnType<typeof Maplibre.getPack>>;

const mapboxPack = {
  name: "native-name",
  metadata: {
    oneMapReactOffline: { version: 1, id: "saved" },
    user: { retained: true },
  },
  status: jest.fn(async () => ({ state: "complete", percentage: 100 })),
  pause: jest.fn(async () => {}),
  resume: jest.fn(async () => {}),
} as unknown as MapboxPack;
const maplibrePack = {
  id: "generated",
  metadata: {
    oneMapReactOffline: { version: 1, id: "saved" },
    user: { retained: true },
  },
  status: jest.fn(async () => ({ state: "complete", percentage: 100 })),
  pause: jest.fn(async () => {}),
  resume: jest.fn(async () => {}),
} as unknown as MaplibrePack;

afterEach(() => {
  jest.resetAllMocks();
});

describe("U11 selected offline application commands", () => {
  test("read-only discovery retains native names, generated IDs and legacy user data", async () => {
    jest.mocked(Mapbox.getPacks).mockResolvedValue([mapboxPack]);
    jest.mocked(Mapbox.getPack).mockResolvedValue(mapboxPack);
    jest.mocked(Maplibre.getPacks).mockResolvedValue([maplibrePack]);
    jest.mocked(Maplibre.getPack).mockResolvedValue(maplibrePack);
    for (const commands of [
      createMapboxOfflineCommands(),
      createMaplibreOfflineCommands(),
    ]) {
      const records = await commands.command("offline-list");
      expect(records).toEqual([
        expect.objectContaining({ id: "saved", user: { retained: true } }),
      ]);
      await commands.command("offline-status", { id: "saved" });
      commands.dispose();
    }
    expect(Mapbox.getPack).toHaveBeenCalledWith("native-name");
    expect(Maplibre.getPack).toHaveBeenCalledWith("generated");
    expect(Mapbox.createPack).not.toHaveBeenCalled();
    expect(Maplibre.createPack).not.toHaveBeenCalled();
    expect(Mapbox.deletePack).not.toHaveBeenCalled();
    expect(Maplibre.deletePack).not.toHaveBeenCalled();
    expect(Mapbox.unsubscribe).not.toHaveBeenCalled();
    expect(Maplibre.removeListener).not.toHaveBeenCalled();
  });

  test("discovery failure propagates and never becomes an empty index", async () => {
    const error = new Error("database unavailable");
    jest.mocked(Mapbox.getPacks).mockRejectedValue(error);
    jest.mocked(Maplibre.getPacks).mockRejectedValue(error);
    await expect(
      createMapboxOfflineCommands().command("offline-list")
    ).rejects.toBe(error);
    await expect(
      createMaplibreOfflineCommands().command("offline-list")
    ).rejects.toBe(error);
  });

  test("RNMapbox creation uses SDK names and NE/SW bounds and preserves persisted failures", async () => {
    jest.mocked(Mapbox.getPacks).mockResolvedValue([]);
    jest
      .mocked(Mapbox.createPack)
      .mockRejectedValue(new Error("persisted then failed"));
    const commands = createMapboxOfflineCommands();
    await expect(
      commands.command("offline-create", { id: "new" })
    ).rejects.toThrow("persisted then failed");
    expect(Mapbox.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "new",
        bounds: [
          [10, 10],
          [-10, -10],
        ],
        metadata: expect.objectContaining({ regionId: "new" }),
      }),
      expect.any(Function),
      expect.any(Function)
    );
    expect(Mapbox.unsubscribe).toHaveBeenCalledWith("new");
    expect(Mapbox.deletePack).not.toHaveBeenCalled();
  });

  test("MapLibre creation uses flat bounds and recovers its generated key after persistence failure", async () => {
    const persisted = {
      ...maplibrePack,
      metadata: { regionId: "new" },
    } as MaplibrePack;
    jest
      .mocked(Maplibre.getPacks)
      .mockResolvedValueOnce([])
      .mockResolvedValue([persisted]);
    jest
      .mocked(Maplibre.createPack)
      .mockRejectedValue(new Error("observer setup failed"));
    const commands = createMaplibreOfflineCommands();
    await expect(
      commands.command("offline-create", { id: "new" })
    ).rejects.toThrow("observer setup failed");
    expect(Maplibre.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        bounds: [-10, -10, 10, 10],
        metadata: expect.objectContaining({ regionId: "new" }),
      }),
      expect.any(Function),
      expect.any(Function)
    );
    expect(Maplibre.removeListener).toHaveBeenCalledWith("generated");
    expect(Maplibre.deletePack).not.toHaveBeenCalled();
    expect(await commands.command("offline-list")).toEqual([
      expect.objectContaining({ id: "new", nativeId: "generated" }),
    ]);
  });

  test("RNMapbox teardown during async subscription removes only its key and suppresses late callbacks", async () => {
    jest.mocked(Mapbox.getPacks).mockResolvedValue([mapboxPack]);
    jest.mocked(Mapbox.getPack).mockResolvedValue(mapboxPack);
    let finish = () => {};
    jest.mocked(Mapbox.subscribe).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const commands = createMapboxOfflineCommands();
    const pending = commands.command("offline-subscribe", { id: "saved" });
    const rejected = expect(pending).rejects.toThrow("detached");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    commands.dispose();
    finish();
    await rejected;
    const [, progress, error] = jest.mocked(Mapbox.subscribe).mock.calls[0];
    progress(mapboxPack, {
      name: "native-name",
      state: "active",
      percentage: null,
    });
    error?.(mapboxPack, { name: "native-name", message: "stale" });
    expect(Mapbox.unsubscribe).toHaveBeenCalledWith("native-name");
    expect(
      jest
        .mocked(Mapbox.unsubscribe)
        .mock.calls.every((args: unknown[]) => args[0] === "native-name")
    ).toBe(true);
  });

  test("MapLibre failed subscription releases its key and allows an explicit retry", async () => {
    jest.mocked(Maplibre.getPacks).mockResolvedValue([maplibrePack]);
    jest.mocked(Maplibre.getPack).mockResolvedValue(maplibrePack);
    jest
      .mocked(Maplibre.addListener)
      .mockRejectedValueOnce(new Error("SDK observer failure"))
      .mockResolvedValue(undefined);
    const commands = createMaplibreOfflineCommands();
    await expect(
      commands.command("offline-subscribe", { id: "saved" })
    ).rejects.toThrow("SDK observer failure");
    expect(Maplibre.removeListener).toHaveBeenCalledWith("generated");
    await commands.command("offline-subscribe", { id: "saved" });
    await expect(
      commands.command("offline-duplicate", { id: "saved" })
    ).rejects.toThrow("already exists");
    expect(Maplibre.removeListener).toHaveBeenCalledTimes(1);
    commands.dispose();
    expect(Maplibre.removeListener).toHaveBeenCalledTimes(2);
  });
  test("MapLibre teardown before creation reveals its generated ID releases the eventual observer", async () => {
    const created = {
      ...maplibrePack,
      metadata: { regionId: "new" },
    } as MaplibrePack;
    jest
      .mocked(Maplibre.getPacks)
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    let finish: (pack: MaplibrePack) => void = () => {};
    jest.mocked(Maplibre.createPack).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const commands = createMaplibreOfflineCommands();
    const pending = commands.command("offline-create", { id: "new" });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    commands.dispose();
    expect(Maplibre.removeListener).not.toHaveBeenCalled();
    finish(created);
    await pending;
    expect(Maplibre.removeListener).toHaveBeenCalledWith("generated");
    expect(Maplibre.deletePack).not.toHaveBeenCalled();
  });

  test("MapLibre late subscription rejection after disposal keeps errors stale and releases only its key", async () => {
    jest.mocked(Maplibre.getPacks).mockResolvedValue([maplibrePack]);
    jest.mocked(Maplibre.getPack).mockResolvedValue(maplibrePack);
    let rejectSetup: (error: Error) => void = () => {};
    jest.mocked(Maplibre.addListener).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSetup = reject;
        })
    );
    const commands = createMaplibreOfflineCommands();
    const pending = commands.command("offline-subscribe", { id: "saved" });
    const rejection = expect(pending).rejects.toThrow("late setup failure");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    commands.dispose();
    const [, progress, error] = jest.mocked(Maplibre.addListener).mock.calls[0];
    progress(maplibrePack, {
      id: "generated",
      state: "active",
      percentage: 3,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    });
    error(maplibrePack, { id: "generated", message: "stale" });
    rejectSetup(new Error("late setup failure"));
    await rejection;
    expect(
      jest
        .mocked(Maplibre.removeListener)
        .mock.calls.every(([id]) => id === "generated")
    ).toBe(true);
    expect(Maplibre.deletePack).not.toHaveBeenCalled();
  });
});

for (const backend of ["mapbox", "maplibre"] as const) {
  for (const outcome of ["resolve", "reject"] as const) {
    test(`${backend} blocks replacement until disposed subscription ${outcome}s, then stale callbacks preserve the new owner`, async () => {
      const slots = new Map<string, () => void>();
      let finish = () => {};
      let fail: (error: Error) => void = () => {};
      const setup = new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      let firstSetup = true;
      if (backend === "mapbox") {
        jest.mocked(Mapbox.getPacks).mockResolvedValue([mapboxPack]);
        jest.mocked(Mapbox.getPack).mockResolvedValue(mapboxPack);
        jest
          .mocked(Mapbox.subscribe)
          .mockImplementation(
            (
              id: string,
              progress: (pack: MapboxPack, status: unknown) => void,
              error?: (pack: MapboxPack, error: unknown) => void
            ) => {
              slots.set(id, () => {
                progress(mapboxPack, {
                  name: id,
                  state: "active",
                  percentage: null,
                });
                error?.(mapboxPack, { name: id, message: "old callback" });
              });
              const pending = firstSetup ? setup : Promise.resolve();
              firstSetup = false;
              return pending;
            }
          );
        jest.mocked(Mapbox.unsubscribe).mockImplementation((id: string) => {
          slots.delete(id);
        });
      } else {
        jest.mocked(Maplibre.getPacks).mockResolvedValue([maplibrePack]);
        jest.mocked(Maplibre.getPack).mockResolvedValue(maplibrePack);
        jest
          .mocked(Maplibre.addListener)
          .mockImplementation((id, progress, error) => {
            slots.set(id, () => {
              progress(maplibrePack, {
                id,
                state: "active",
                percentage: 1,
                completedResourceCount: 0,
                completedResourceSize: 0,
                completedTileCount: 0,
                completedTileSize: 0,
                requiredResourceCount: 1,
              });
              error(maplibrePack, { id, message: "old callback" });
            });
            const pending = firstSetup ? setup : Promise.resolve();
            firstSetup = false;
            return pending;
          });
        jest.mocked(Maplibre.removeListener).mockImplementation((id) => {
          slots.delete(id);
        });
      }
      const createCommands =
        backend === "mapbox"
          ? createMapboxOfflineCommands
          : createMaplibreOfflineCommands;
      const old = createCommands();
      const replacement = createCommands();
      const pending = old
        .command("offline-subscribe", { id: "saved" })
        .catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const stale = [...slots.values()][0];
      old.dispose();
      const claim = await replacement
        .command("offline-subscribe", { id: "saved" })
        .then(
          () => "accepted",
          (error: Error) => error.message
        );
      if (outcome === "resolve") finish();
      else fail(new Error("late setup failure"));
      await pending;
      try {
        expect(claim).toMatch(/active or pending/);
        await replacement.command("offline-subscribe", { id: "saved" });
        const current = [...slots.values()][0];
        stale();
        old.dispose();
        expect([...slots.values()]).toEqual([current]);
      } finally {
        old.dispose();
        replacement.dispose();
      }
    });
  }
}

for (const outcome of ["resolve", "reject"] as const) {
  test(`MapLibre pending generated-ID creation ${outcome} blocks replacement until SDK listener setup settles`, async () => {
    const created = {
      ...maplibrePack,
      metadata: { regionId: "new" },
    } as MaplibrePack;
    const slots = new Map<string, () => void>();
    let finish = () => {};
    let fail: (error: Error) => void = () => {};
    const nativeObserver = new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    let persisted = false;
    let stale = () => {};
    jest
      .mocked(Maplibre.getPacks)
      .mockImplementation(async () => (persisted ? [created] : []));
    jest.mocked(Maplibre.getPack).mockResolvedValue(created);
    jest.mocked(Maplibre.removeListener).mockImplementation((id) => {
      slots.delete(id);
    });
    jest
      .mocked(Maplibre.createPack)
      .mockImplementation(async (_options, progress, error) => {
        // Native persistence exposes the generated ID before the SDK installs its listener.
        persisted = true;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        stale = () => {
          progress(created, {
            id: created.id,
            state: "active",
            percentage: 1,
            completedResourceCount: 0,
            completedResourceSize: 0,
            completedTileCount: 0,
            completedTileSize: 0,
            requiredResourceCount: 1,
          });
          error(created, { id: created.id, message: "old create callback" });
        };
        slots.set(created.id, stale);
        await nativeObserver;
        return created;
      });
    jest.mocked(Maplibre.addListener).mockImplementation(async (id) => {
      slots.set(id, () => {});
    });
    const old = createMaplibreOfflineCommands();
    const replacement = createMaplibreOfflineCommands();
    const pending = old
      .command("offline-create", { id: "new" })
      .catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    old.dispose();
    const claim = await replacement
      .command("offline-subscribe", { id: "new" })
      .then(
        () => "accepted",
        (error: Error) => error.message
      );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (outcome === "resolve") finish();
    else fail(new Error("persisted observer failure"));
    await pending;
    try {
      expect(claim).toMatch(/active or pending/);
      await replacement.command("offline-subscribe", { id: "new" });
      const current = [...slots.values()][0];
      stale();
      old.dispose();
      expect([...slots.values()]).toEqual([current]);
      expect(Maplibre.deletePack).not.toHaveBeenCalled();
      expect(await replacement.command("offline-list")).toEqual([
        expect.objectContaining({ id: "new", nativeId: "generated" }),
      ]);
    } finally {
      old.dispose();
      replacement.dispose();
    }
  });
}
