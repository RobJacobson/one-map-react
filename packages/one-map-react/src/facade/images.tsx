import type { ImagesProps } from "../contracts/images-types.js";
import { useMapEnclosure } from "./map.js";
import { useSelectedAdapter } from "./map-setup.js";

/**
 * Shared style images that render through the selected adapter.
 *
 * Renders inside {@link Map}; registration waits for style readiness,
 * entries are removed on unmount, and owned entries are re-registered after
 * the style is replaced.
 *
 * @param props - Image entries keyed by style image name.
 * @throws When rendered outside {@link Map}.
 */
export const Images = (props: ImagesProps) => {
  const { Images: AdapterImages } = useSelectedAdapter();
  const insideMap = useMapEnclosure();

  if (!insideMap) {
    throw new Error("Images must render inside Map.");
  }

  return <AdapterImages {...props} />;
};
