import { useContext, useLayoutEffect, useRef } from "react";

import type { ControlPosition } from "../../contracts/ui-types.js";
import {
  type NativeOverlay,
  NativeOverlayContext,
} from "../../facade/map-context.js";

/**
 * Coordinates SDK defaults with native control bounds and restores removed rows.
 * Explicit selected SDK positions remain owned by the application.
 */
export const useNativeOrnamentPositions = () => {
  const overlays = useContext(NativeOverlayContext);
  const previouslyManaged = useRef(false);
  useLayoutEffect(() => {
    if (overlays.length > 0) previouslyManaged.current = true;
  }, [overlays.length]);
  return {
    managed: overlays.length > 0 || previouslyManaged.current,
    position: (corner: ControlPosition) =>
      nativeOrnamentPosition(corner, overlays),
  };
};

/** Keeps a renderer ornament beyond the measured controls in its corner. */
const nativeOrnamentPosition = (
  corner: ControlPosition,
  overlays: readonly NativeOverlay[]
) => {
  const inset = overlays
    .filter((overlay) => overlay.position === corner)
    .reduce((height, overlay) => height + overlay.height + 8, 8);
  switch (corner) {
    case "top-left":
      return { top: inset, left: 8 };
    case "top-right":
      return { top: inset, right: 8 };
    case "bottom-left":
      return { bottom: inset, left: 8 };
    case "bottom-right":
      return { bottom: inset, right: 8 };
  }
};
