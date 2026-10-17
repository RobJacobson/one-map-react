import { Images as MaplibreImages } from "@maplibre/maplibre-react-native";

import type { ImagesProps } from "../../contracts/images-types.js";

/**
 * Converts common image entries into MapLibre Native `Images` entries.
 *
 * @remarks
 * MapLibre Native resolves object entries through React Native's
 * `Image.resolveAssetSource`, which only accepts a native asset ID or an
 * `{ uri }` object; a bare URL string resolves to `null` and throws during
 * render. URL entries therefore become `{ source: { uri } }`.
 *
 * @param images - Common image entries keyed by style image name.
 * @returns URL strings and `{ source: { uri }, sdf }` entries.
 */
const toMaplibreImages = (
  images: ImagesProps["images"]
): Record<string, string | { source: { uri: string }; sdf?: boolean }> =>
  Object.fromEntries(
    Object.entries(images).map(([name, entry]) => [
      name,
      typeof entry === "string"
        ? entry
        : {
            source: { uri: entry.url },
            ...(entry.sdf === undefined ? {} : { sdf: entry.sdf }),
          },
    ])
  );

/** Maplibre-native images that converts entries for the wrapper `Images`. */
export const MaplibreNativeImages = ({ images }: ImagesProps) => (
  <MaplibreImages images={toMaplibreImages(images)} />
);
