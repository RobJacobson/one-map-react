import { useEffect, useEffectEvent } from "react";

export interface BrowserStyleImageMap {
  hasImage(id: string): boolean;
  addImage(id: string, image: HTMLImageElement): unknown;
  removeImage(id: string): unknown;
}

/**
 * Loads a single application-owned fixture image for the active style.
 *
 * @param map - Attached browser map after its style is ready.
 * @param id - Fixture image name used by a symbol layer.
 * @param url - Fixture image URL.
 * @param onError - Browser scene error handler.
 */
export const useWebStyleImage = (
  map: BrowserStyleImageMap | null,
  id: string | undefined,
  url: string | undefined,
  onError?: (error: unknown) => void
): void => {
  const reportError = useEffectEvent((error: unknown) => onError?.(error));
  useEffect(() => {
    if (!map || !id || !url || map.hasImage(id)) return;
    let active = true;
    let owned = false;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      try {
        if (!map.hasImage(id)) {
          map.addImage(id, image);
          owned = true;
        }
      } catch (error) {
        reportError(error);
      }
    };
    image.onerror = () => {
      if (active) reportError(new Error("Fixture image failed to load."));
    };
    image.crossOrigin = "anonymous";
    image.src = url;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      if (owned && map.hasImage(id)) map.removeImage(id);
    };
  }, [map, id, url]);
};
