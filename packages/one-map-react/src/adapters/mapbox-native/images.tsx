import { Images as RnmapboxImages } from "@rnmapbox/maps";

import type { ImagesProps } from "../../contracts/images-types.js";
import { renderNativeImageEntries } from "../shared/native-image-entries.js";

/** Registers each image through a separate RNMapbox wrapper owner. */
export const MapboxNativeImages = ({ images }: ImagesProps) =>
  renderNativeImageEntries(images, (name, entry) => (
    <RnmapboxImages images={{ [name]: entry }} />
  ));
