import { Images as MaplibreImages } from "@maplibre/maplibre-react-native";

import type { ImagesProps } from "../../contracts/images-types.js";
import { renderNativeImageEntries } from "../shared/native-image-entries.js";

/** Registers each image through a separate MapLibre Native wrapper owner. */
export const MaplibreNativeImages = ({ images }: ImagesProps) =>
  renderNativeImageEntries(images, (name, entry) => (
    <MaplibreImages
      images={{
        [name]: { source: { uri: entry.url }, sdf: entry.sdf },
      }}
    />
  ));
