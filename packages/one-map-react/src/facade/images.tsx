import type { ImagesProps } from "../contracts/images-types.js";
import { useSelectedAdapter } from "./map-setup.js";
import { useMapEnclosure } from "./map.js";

/**
 * Shared style images that render through the selected adapter.
 *
 * Renders inside {@link Map}; registration waits for style readiness,
 * entries update independently and successful registrations are removed on
 * unmount. Web consumers must finish cleanup before changing the style, then
 * mount fresh Images after readiness. Native wrappers retain SDK behavior.
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
