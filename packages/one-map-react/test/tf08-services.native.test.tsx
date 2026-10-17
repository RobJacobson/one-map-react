import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  OfflineManager,
  StaticMapImageManager,
} from "@maplibre/maplibre-react-native";
import { offlineManager, snapshotManager } from "@rnmapbox/maps";
import { waitFor } from "@testing-library/react-native";

import { mapboxNativeServices } from "../src/adapters/mapbox-native/services.js";
import { maplibreNativeServices } from "../src/adapters/maplibre-native/services.js";

jest.mock("@rnmapbox/maps", () => ({
  locationManager: {},
  offlineManager: {
    createPack: jest.fn(),
    getPack: jest.fn(),
    getPacks: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  },
  snapshotManager: { takeSnap: jest.fn() },
}));
jest.mock("@maplibre/maplibre-react-native", () => ({
  LocationManager: {},
  OfflineManager: {
    createPack: jest.fn(),
    getPacks: jest.fn(),
    removeListener: jest.fn(),
  },
  StaticMapImageManager: { createImage: jest.fn() },
}));

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=";
const image = {
  mapStyle: "https://example.test/style",
  center: [1, 2] as const,
  zoom: 0,
  width: 1,
  height: 1,
  output: "data-url" as const,
};
afterEach(() => {
  jest.resetAllMocks();
});

describe("TF08 native wrapper forwarding", () => {
  test("MapLibre iOS snapshot paths become escaped file URIs without changing Android URIs", async () => {
    jest
      .mocked(StaticMapImageManager.createImage)
      .mockResolvedValue("/var/mobile/Documents/map image #1%.png");
    await expect(
      maplibreNativeServices.staticMapImage?.create({
        ...image,
        output: "file",
      })
    ).resolves.toMatchObject({
      uri: "file:///var/mobile/Documents/map%20image%20%231%25.png",
    });
    jest
      .mocked(StaticMapImageManager.createImage)
      .mockResolvedValue("file:///tmp/map%20image.png");
    await expect(
      maplibreNativeServices.staticMapImage?.create({
        ...image,
        output: "file",
      })
    ).resolves.toMatchObject({
      uri: "file:///tmp/map%20image.png",
    });
    jest
      .mocked(StaticMapImageManager.createImage)
      .mockResolvedValue("relative/map.png");
    await expect(
      maplibreNativeServices.staticMapImage?.create({
        ...image,
        output: "file",
      })
    ).rejects.toThrow("file URI");
  });
  test("RNMapbox translates zero zoom and output options without starting a map", async () => {
    jest.mocked(snapshotManager.takeSnap).mockResolvedValue(png);
    expect(
      await mapboxNativeServices.staticMapImage?.create(image)
    ).toMatchObject({ output: "data-url", mimeType: "image/png" });
    expect(snapshotManager.takeSnap).toHaveBeenCalledWith({
      styleURL: image.mapStyle,
      centerCoordinate: [1, 2],
      zoomLevel: 0,
      heading: 0,
      pitch: 0,
      width: 1,
      height: 1,
      writeToDisk: false,
    });
  });
  test("MapLibre translates bounds and file output and preserves SDK errors", async () => {
    jest
      .mocked(StaticMapImageManager.createImage)
      .mockResolvedValue("file:///tmp/map.png");
    await maplibreNativeServices.staticMapImage?.create({
      mapStyle: image.mapStyle,
      bounds: [
        [1, 2],
        [3, 4],
      ],
      width: 1,
      height: 1,
      output: "file",
    });
    expect(StaticMapImageManager.createImage).toHaveBeenCalledWith({
      mapStyle: image.mapStyle,
      bounds: [1, 2, 3, 4],
      width: 1,
      height: 1,
      output: "file",
    });
    const error = new Error("style failure");
    jest.mocked(StaticMapImageManager.createImage).mockRejectedValue(error);
    await expect(
      maplibreNativeServices.staticMapImage?.create(image)
    ).rejects.toBe(error);
  });
  test("data URL snapshots reject unexpected output dimensions", async () => {
    jest.mocked(snapshotManager.takeSnap).mockResolvedValue(png);
    await expect(
      mapboxNativeServices.staticMapImage?.create({ ...image, width: 2 })
    ).rejects.toThrow("dimensions");
  });
  test("RNMapbox offline creation reverses bounds and verifies discoverability", async () => {
    jest.mocked(offlineManager.getPacks).mockResolvedValue([]);
    jest.mocked(offlineManager.createPack).mockResolvedValue(undefined);
    jest.mocked(offlineManager.getPack).mockResolvedValue(undefined);
    await expect(
      mapboxNativeServices.offline?.createPack({
        id: "route",
        mapStyle: image.mapStyle,
        bounds: [
          [1, 2],
          [3, 4],
        ],
        minZoom: 0,
        maxZoom: 2,
      })
    ).rejects.toThrow("discoverable");
    expect(offlineManager.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "route",
        styleURL: image.mapStyle,
        bounds: [
          [3, 4],
          [1, 2],
        ],
        metadata: { oneMapReactOffline: { version: 1, id: "route" }, user: {} },
      }),
      expect.any(Function),
      expect.any(Function)
    );
    expect(offlineManager.unsubscribe).toHaveBeenCalledWith("route");
  });
  test("RNMapbox creation failure preserves a subscriber attached after persistence", async () => {
    // Only public pack reads are mocked; the wrapper's numeric state declaration is stale.
    const pack = {
      name: "persisted",
      metadata: {
        oneMapReactOffline: { version: 1, id: "persisted" },
        user: {},
      },
      bounds: [3, 4, 1, 2],
      status: async () => ({ state: "active", percentage: 25 }),
    } as unknown as NonNullable<
      Awaited<ReturnType<typeof offlineManager.getPack>>
    >;
    jest.mocked(offlineManager.getPacks).mockResolvedValue([]);
    jest.mocked(offlineManager.getPack).mockResolvedValue(undefined);
    let finishCreation = () => {};
    jest.mocked(offlineManager.createPack).mockImplementationOnce(() => {
      jest.mocked(offlineManager.getPacks).mockResolvedValue([pack]);
      return new Promise<void>((resolve) => {
        finishCreation = resolve;
      });
    });
    let progress: Parameters<typeof offlineManager.subscribe>[1];
    jest
      .mocked(offlineManager.subscribe)
      .mockImplementation(async (_id: string, listener: typeof progress) => {
        progress = listener;
      });
    jest.mocked(offlineManager.unsubscribe).mockImplementation(() => {
      progress = undefined;
    });
    const creating = mapboxNativeServices.offline?.createPack({
      id: "persisted",
      mapStyle: image.mapStyle,
      bounds: [
        [1, 2],
        [3, 4],
      ],
      minZoom: 0,
      maxZoom: 2,
    });
    const failed = expect(creating).rejects.toThrow("discoverable");
    await waitFor(() => expect(offlineManager.createPack).toHaveBeenCalled());
    const onProgress = jest.fn();
    const release = mapboxNativeServices.offline?.subscribe(
      "persisted",
      onProgress,
      jest.fn()
    );
    try {
      await waitFor(() => expect(onProgress).toHaveBeenCalled());
      finishCreation();
      await failed;
      expect(offlineManager.unsubscribe).not.toHaveBeenCalled();
      progress?.(pack, { ...(await pack.status()), percentage: 50 });
      expect(onProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({ percentage: 50 })
      );
    } finally {
      release?.();
      await waitFor(() =>
        expect(offlineManager.unsubscribe).toHaveBeenCalledWith("persisted")
      );
    }
  });

  test("RNMapbox name collisions preserve imported pack progress", async () => {
    const pack = {
      name: "ferry",
      metadata: {},
      bounds: [3, 4, 1, 2],
      status: async () => ({ state: 1, percentage: 25 }),
    } as NonNullable<Awaited<ReturnType<typeof offlineManager.getPack>>>;
    jest.mocked(offlineManager.getPacks).mockResolvedValue([pack]);
    jest.mocked(offlineManager.getPack).mockResolvedValue(pack);
    jest
      .mocked(offlineManager.createPack)
      .mockRejectedValue(new Error("Offline pack already exists."));
    let progress: Parameters<typeof offlineManager.subscribe>[1];
    jest
      .mocked(offlineManager.subscribe)
      .mockImplementation(async (_id: string, listener: typeof progress) => {
        progress = listener;
      });
    jest.mocked(offlineManager.unsubscribe).mockImplementation(() => {
      progress = undefined;
    });
    const onProgress = jest.fn();
    const onError = jest.fn();
    const dispose = mapboxNativeServices.offline?.subscribe(
      "backend:ferry",
      onProgress,
      onError
    );
    try {
      await waitFor(() =>
        expect(onProgress).toHaveBeenCalledWith(
          expect.objectContaining({ id: "backend:ferry", percentage: 25 })
        )
      );
      await expect(
        mapboxNativeServices.offline?.createPack({
          id: "ferry",
          mapStyle: image.mapStyle,
          bounds: [
            [1, 2],
            [3, 4],
          ],
          minZoom: 0,
          maxZoom: 2,
        })
      ).rejects.toThrow("already exists");
      progress?.(pack, { ...(await pack.status()), percentage: 50 });
      expect(onProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "backend:ferry", percentage: 50 })
      );
      expect(onError).not.toHaveBeenCalled();
      expect(offlineManager.unsubscribe).not.toHaveBeenCalled();
    } finally {
      dispose?.();
      await waitFor(() =>
        expect(offlineManager.unsubscribe).toHaveBeenCalledWith("ferry")
      );
    }
  });
  test("MapLibre offline creation uses flat bounds and persistent identity metadata", async () => {
    jest.mocked(OfflineManager.getPacks).mockResolvedValue([]);
    const error = new Error("download setup failure");
    jest.mocked(OfflineManager.createPack).mockRejectedValue(error);
    await expect(
      maplibreNativeServices.offline?.createPack({
        id: "route",
        mapStyle: image.mapStyle,
        bounds: [
          [1, 2],
          [3, 4],
        ],
        minZoom: 0,
        maxZoom: 2,
      })
    ).rejects.toBe(error);
    expect(OfflineManager.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        mapStyle: image.mapStyle,
        bounds: [1, 2, 3, 4],
        metadata: { oneMapReactOffline: { version: 1, id: "route" }, user: {} },
      }),
      expect.any(Function),
      expect.any(Function)
    );
  });
});
