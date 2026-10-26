import type { MapRef } from "one-map-react";
import type { NativeAdvancedMapRef as MapboxNativeRef } from "one-map-react/mapbox-native";
import type { NativeAdvancedMapRef as MaplibreNativeRef } from "one-map-react/maplibre-native";

/**
 * Native SDKs require no browser drawing-buffer options.
 * @param _backend - Backend selected by the application shell.
 * @returns No browser options.
 */
export const renderingBufferOptions = (_backend: string): undefined =>
  undefined;

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
  let image: string;
  // The shell selects the adapter; the common ref intentionally has no SDK API.
  if (backend === "mapbox-native") {
    const wrapper = await (map as MapboxNativeRef).getWrapperMap();
    image = await wrapper.takeSnap(output === "file");
  } else if (backend === "maplibre-native") {
    const wrapper = await (map as MaplibreNativeRef).getWrapperMap();
    image = await wrapper.createStaticMapImage({
      output: output === "file" ? "file" : "base64",
    });
  } else {
    throw new Error(`Unknown observation backend: ${backend}`);
  }
  return observationImageUri(image, output);
};

/**
 * Adapts native output only for this application's PNG observer transport.
 * @param image - Unchanged SDK result.
 * @param output - Transport chosen by this application.
 * @returns URI the observer can read, without checking format or dimensions.
 */
export const observationImageUri = (
  image: string,
  output: "data-url" | "file"
): { uri: string } => {
  // The harness reads file URLs and PNG data URLs, while native SDKs may return bare paths/base64.
  if (output === "file")
    return {
      uri: image.startsWith("/")
        ? `file://${image.split("/").map(encodeURIComponent).join("/")}`
        : image,
    };
  return {
    uri: image.startsWith("data:") ? image : `data:image/png;base64,${image}`,
  };
};
