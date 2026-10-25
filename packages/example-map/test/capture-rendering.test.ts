import type { MapRef } from "one-map-react";
import { describe, expect, test, vi } from "vite-plus/test";

import {
  captureRendering,
  renderingBufferOptions,
} from "../../../examples/shared/capture-rendering.js";
import { captureRendering as captureNativeRendering } from "../../../examples/shared/capture-rendering.native.js";

const observationMap = (wrapper: object) => {
  const getWrapperMap = vi.fn(async () => wrapper);
  // The fixture exposes just the selected operation borrowed by the application.
  return { map: { getWrapperMap } as unknown as MapRef, getWrapperMap };
};

describe("application renderer observations", () => {
  test("borrows a fresh web wrapper for each PNG and propagates canvas failures", async () => {
    const toDataURL = vi.fn(() => "data:image/png;base64,pixels");
    const { map, getWrapperMap } = observationMap({
      getCanvas: () => ({ toDataURL }),
    });
    await expect(captureRendering("mapbox-web", map)).resolves.toEqual({
      uri: "data:image/png;base64,pixels",
    });
    await captureRendering("maplibre-web", map);
    expect(getWrapperMap).toHaveBeenCalledTimes(2);
    expect(toDataURL).toHaveBeenCalledWith("image/png");
    toDataURL.mockImplementation(() => {
      throw new Error("SecurityError");
    });
    await expect(captureRendering("mapbox-web", map)).rejects.toThrow(
      "SecurityError"
    );
    await expect(captureRendering("mapbox-web", map, "file")).rejects.toThrow(
      "data URLs"
    );
  });

  test("uses native SDK file and base64 arguments and adapts only the harness transport", async () => {
    const takeSnap = vi.fn(async (file: boolean) =>
      file ? "file:///tmp/map.png" : "pixels"
    );
    const mapbox = observationMap({ takeSnap });
    await expect(
      captureNativeRendering("mapbox-native", mapbox.map)
    ).resolves.toEqual({ uri: "data:image/png;base64,pixels" });
    await expect(
      captureNativeRendering("mapbox-native", mapbox.map, "file")
    ).resolves.toEqual({ uri: "file:///tmp/map.png" });
    expect(takeSnap.mock.calls).toEqual([[false], [true]]);
    const createStaticMapImage = vi.fn(
      async ({ output }: { output: string }) =>
        output === "file"
          ? "/tmp/map image?#%.png"
          : "data:image/png;base64,pixels"
    );
    const maplibre = observationMap({ createStaticMapImage });
    await expect(
      captureNativeRendering("maplibre-native", maplibre.map)
    ).resolves.toEqual({ uri: "data:image/png;base64,pixels" });
    await expect(
      captureNativeRendering("maplibre-native", maplibre.map, "file")
    ).resolves.toEqual({ uri: "file:///tmp/map%20image%3F%23%25.png" });
    expect(createStaticMapImage.mock.calls).toEqual([
      [{ output: "base64" }],
      [{ output: "file" }],
    ]);
    createStaticMapImage.mockRejectedValue(new Error("SDK export failed"));
    await expect(
      captureNativeRendering("maplibre-native", maplibre.map)
    ).rejects.toThrow("SDK export failed");
  });

  test("reports absent refs, detached wrapper getters, and invalid application selection", async () => {
    await expect(captureRendering("mapbox-web", null)).rejects.toThrow(
      "not attached"
    );
    const { map, getWrapperMap } = observationMap({});
    getWrapperMap.mockRejectedValue(new Error("Map is not attached"));
    await expect(captureNativeRendering("mapbox-native", map)).rejects.toThrow(
      "not attached"
    );
    await expect(captureRendering("unknown", map)).rejects.toThrow(
      "Unknown browser observation backend"
    );
  });

  test("requests selected web drawing buffers without native options", () => {
    expect(renderingBufferOptions("mapbox-web")).toEqual({
      preserveDrawingBuffer: true,
    });
    expect(renderingBufferOptions("maplibre-web")).toEqual({
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    expect(renderingBufferOptions("mapbox-native")).toBeUndefined();
    expect(renderingBufferOptions("maplibre-native")).toBeUndefined();
  });
});
