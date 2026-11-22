import type { ImagesProps } from "../contracts/images-types.js";
import { useMapSession } from "./map-context.js";

/**
 * Registers style images through the enclosing native map.
 *
 * Registration waits for style readiness,
 * entries update independently and successful registrations are removed on
 * unmount. Registration follows the selected native wrapper's behavior.
 *
 * @param props - Image entries keyed by style image name.
 * @throws When rendered outside a native Map.
 */
export const Images = (props: ImagesProps) => {
  const { Images: NativeImages } = useMapSession("Images").components;
  return <NativeImages {...props} />;
};
