import type {
  MapProps as MapboxWebProps,
  MapRef as MapboxWebRef,
} from "react-map-gl/mapbox";
import type {
  MapProps as MaplibreWebProps,
  MapRef as MaplibreWebRef,
} from "react-map-gl/maplibre";

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
    } satisfies MapboxWebProps;
  if (backend === "maplibre-web")
    return {
      canvasContextAttributes: { preserveDrawingBuffer: true },
    } satisfies MaplibreWebProps;
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
  map: Pick<MapboxWebRef | MaplibreWebRef, "getCanvas"> | null,
  output: "data-url" | "file" = "data-url"
): Promise<{ uri: string }> => {
  if (!map) throw new Error("Observation map is not attached.");
  if (backend !== "mapbox-web" && backend !== "maplibre-web")
    throw new Error(`Unknown browser observation backend: ${backend}`);
  if (output === "file") throw new Error("Browser observations use data URLs.");
  return { uri: map.getCanvas().toDataURL("image/png") };
};
