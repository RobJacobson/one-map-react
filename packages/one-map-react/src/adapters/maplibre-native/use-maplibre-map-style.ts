import type { Map as MaplibreMap } from "@maplibre/maplibre-react-native";
import { type ComponentProps, useMemo } from "react";

import type { NativeMapProps } from "../../maplibre-native.js";
import { maplibreStyleForNative } from "./style-roots.js";

type WrapperMapStyle = ComponentProps<typeof MaplibreMap>["mapStyle"];

/**
 * Reuses the validated style while the caller keeps the same style identity.
 * @param mapStyle - Managed or wrapper style document, JSON string, or URL.
 * @returns The serialized document or string passed to MapLibre React Native.
 * @throws When the serialized style contains unsupported options or invalid JSON.
 */
export const useMaplibreMapStyle = (
  mapStyle: NativeMapProps["mapStyle"]
): WrapperMapStyle =>
  useMemo(
    // The validator serializes object styles and preserves the input strings.
    () => maplibreStyleForNative(mapStyle) as WrapperMapStyle,
    [mapStyle]
  );
