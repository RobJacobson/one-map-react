import { WrapperSnapshotManager } from "one-map-react/mapbox-native";
import { WrapperStaticMapImageManager } from "one-map-react/maplibre-native";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { createMapboxSnapshot } from "../../../examples/shared/mapbox-snapshot.js";
import { createMaplibreSnapshot } from "../../../examples/shared/maplibre-snapshot.js";

vi.mock("one-map-react/mapbox-native", () => ({
  WrapperSnapshotManager: { takeSnap: vi.fn() },
}));
vi.mock("one-map-react/maplibre-native", () => ({
  WrapperStaticMapImageManager: { createImage: vi.fn() },
}));

afterEach(() => vi.resetAllMocks());

describe("application independent snapshot observations", () => {
  test("RNMapbox gets zero zoom, requested dimensions and its file flag", async () => {
    vi.mocked(WrapperSnapshotManager.takeSnap).mockResolvedValue("pixels");
    await expect(
      createMapboxSnapshot({ width: 128, height: 80 })
    ).resolves.toEqual({ uri: "data:image/png;base64,pixels" });
    expect(WrapperSnapshotManager.takeSnap).toHaveBeenCalledWith({
      styleURL: "http://127.0.0.1:8798/style.json",
      centerCoordinate: [0, 0],
      zoomLevel: 0,
      width: 128,
      height: 80,
      writeToDisk: false,
    });
    vi.mocked(WrapperSnapshotManager.takeSnap).mockResolvedValue(
      "file:///tmp/map.png"
    );
    await expect(createMapboxSnapshot({ output: "file" })).resolves.toEqual({
      uri: "file:///tmp/map.png",
    });
    expect(WrapperSnapshotManager.takeSnap).toHaveBeenLastCalledWith(
      expect.objectContaining({ writeToDisk: true })
    );
  });

  test("MapLibre gets its own base64/file options and paths are adapted only for transport", async () => {
    vi.mocked(WrapperStaticMapImageManager.createImage).mockResolvedValue(
      "data:image/png;base64,pixels"
    );
    await expect(
      createMaplibreSnapshot({ width: 128, height: 80 })
    ).resolves.toEqual({ uri: "data:image/png;base64,pixels" });
    expect(WrapperStaticMapImageManager.createImage).toHaveBeenCalledWith({
      mapStyle: "http://127.0.0.1:8798/style.json",
      center: [0, 0],
      zoom: 0,
      width: 128,
      height: 80,
      output: "base64",
    });
    vi.mocked(WrapperStaticMapImageManager.createImage).mockResolvedValue(
      "/tmp/map #%.png"
    );
    await expect(createMaplibreSnapshot({ output: "file" })).resolves.toEqual({
      uri: "file:///tmp/map%20%23%25.png",
    });
    expect(WrapperStaticMapImageManager.createImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ output: "file" })
    );
  });

  test("both application routes preserve the exact SDK rejection", async () => {
    const failure = new Error("SDK style failed");
    vi.mocked(WrapperSnapshotManager.takeSnap).mockRejectedValue(failure);
    vi.mocked(WrapperStaticMapImageManager.createImage).mockRejectedValue(
      failure
    );
    await expect(createMapboxSnapshot({})).rejects.toBe(failure);
    await expect(createMaplibreSnapshot({})).rejects.toBe(failure);
  });
});
