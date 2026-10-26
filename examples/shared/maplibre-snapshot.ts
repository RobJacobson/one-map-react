import { WrapperStaticMapImageManager } from "one-map-react/maplibre-native";

import { observationImageUri } from "./capture-rendering.native.js";

/**
 * Runs the independent snapshot requested by the TF08 application observer.
 * @param value - Observer inputs; SDK errors propagate to the screen transport.
 * @returns Observer URI derived from the raw SDK result.
 */
export const createMaplibreSnapshot = async (
  value: Record<string, unknown>
): Promise<{ uri: string }> => {
  const output = value.output === "file" ? "file" : "data-url";
  const image = await WrapperStaticMapImageManager.createImage({
    mapStyle: String(value.mapStyle ?? "http://127.0.0.1:8798/style.json"),
    center: [0, 0],
    zoom: 0,
    width: Number(value.width ?? 96),
    height: Number(value.height ?? 64),
    output: output === "file" ? "file" : "base64",
  });
  return observationImageUri(image, output);
};
