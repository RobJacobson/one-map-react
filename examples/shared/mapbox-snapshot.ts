import type { SnapshotOptions } from "@rnmapbox/maps";
import { WrapperSnapshotManager } from "one-map-react/mapbox-native";

import { observationImageUri } from "./capture-rendering.native.js";

/**
 * Runs the independent snapshot requested by the TF08 application observer.
 * @param value - Observer inputs; SDK errors propagate to the screen transport.
 * @returns Observer URI derived from the raw SDK result.
 */
export const createMapboxSnapshot = async (
  value: Record<string, unknown>
): Promise<{ uri: string }> => {
  const output = value.output === "file" ? "file" : "data-url";
  const options: ConstructorParameters<typeof SnapshotOptions>[0] = {
    styleURL: String(value.mapStyle ?? "http://127.0.0.1:8798/style.json"),
    centerCoordinate: [0, 0],
    zoomLevel: 0,
    width: Number(value.width ?? 96),
    height: Number(value.height ?? 64),
    writeToDisk: output === "file",
  };
  const image = await WrapperSnapshotManager.takeSnap(options);
  return observationImageUri(image, output);
};
