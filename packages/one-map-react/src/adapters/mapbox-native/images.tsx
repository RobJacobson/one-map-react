import { Images as RnmapboxImages } from "@rnmapbox/maps";

import type { ImagesProps } from "../../contracts/images-types.js";

/** Mapbox-native images that forwards entries to RNMapbox `Images`. */
export const MapboxNativeImages = ({ images }: ImagesProps) => (
  <RnmapboxImages images={images} />
);
