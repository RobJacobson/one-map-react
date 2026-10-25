import type { MapRef } from "one-map-react";
import type {
  WebMapProps as MapboxWebProps,
  WebMapRef as MapboxWebRef,
} from "one-map-react/mapbox-web";
import type {
  WebMapProps as MaplibreWebProps,
  WebMapRef as MaplibreWebRef,
} from "one-map-react/maplibre-web";

/**
 * Selects constructor options for the examples' canvas observations.
 * @param backend - Backend selected by the application shell.
 * @returns The selected drawing-buffer options, or no native options.
 */
export const renderingBufferOptions = (
  backend: string
):
  | { preserveDrawingBuffer: true }
  | { canvasContextAttributes: { preserveDrawingBuffer: true } }
  | undefined => {
  if (backend === "mapbox-web")
    return {
      preserveDrawingBuffer: true as const,
    } satisfies MapboxWebProps["options"];
  if (backend === "maplibre-web")
    return {
      canvasContextAttributes: { preserveDrawingBuffer: true },
    } satisfies MaplibreWebProps["options"];
  return undefined;
};

/**
 * Reads the selected renderer for the example harness; inclusion follows that SDK.
 *
 * @param backend - Backend selected by the application's shell.
 * @param map - Current ref, checked before borrowing its wrapper.
 * @param output - Harness transport; browser observations use data URLs.
 * @returns URI consumed by the harness's PNG observer.
 */
export const captureRendering = async (
  backend: string,
  map: MapRef | null,
  output: "data-url" | "file" = "data-url"
): Promise<{ uri: string }> => {
  if (!map) throw new Error("Observation map is not attached.");
  if (backend !== "mapbox-web" && backend !== "maplibre-web")
    throw new Error(`Unknown browser observation backend: ${backend}`);
  if (output === "file") throw new Error("Browser observations use data URLs.");
  // The shell selects the adapter; the common ref intentionally has no SDK API.
  const wrapper = await (map as MapboxWebRef | MaplibreWebRef).getWrapperMap();
  return { uri: wrapper.getCanvas().toDataURL("image/png") };
};
