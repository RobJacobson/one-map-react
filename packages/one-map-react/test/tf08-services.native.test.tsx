import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { StaticMapImageManager } from "@maplibre/maplibre-react-native";
import { snapshotManager } from "@rnmapbox/maps";

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
});
