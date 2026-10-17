import type { MapView } from "@rnmapbox/maps";
import { type ComponentProps, useEffect, useState } from "react";
import { Platform } from "react-native";

/** Keeps the RNMapbox iOS scale hide/restore commits separated by a frame. */
export const useMapboxScalePosition = (
  scaleBarPosition: ComponentProps<typeof MapView>["scaleBarPosition"],
  width: number | undefined,
  height: number | undefined,
  enabled: boolean | undefined
): boolean => {
  const scalePositionKey = JSON.stringify([scaleBarPosition, width, height]);
  const [appliedScalePosition, setAppliedScalePosition] =
    useState(scalePositionKey);
  // RNMapbox iOS stores position updates without marking its scale dirty.
  // Native layout can reset the scale. Separate its hide/restore commits by a
  // frame so Fabric cannot merge away the enabled setter's dirty notification.
  // See ../../../test/mapbox-native.native.test.tsx scale position/layout cases.
  // Remove when RNMapbox iOS dirties the scale after position and layout changes.
  const refreshScalePosition =
    Platform.OS === "ios" &&
    appliedScalePosition !== scalePositionKey &&
    enabled !== false;
  useEffect(() => {
    if (!refreshScalePosition) {
      // eslint-disable-next-line react/set-state-in-effect -- Keep the RNMapbox iOS scale hide/restore commits separate; synchronizing this key preserves the native dirty notification.
      setAppliedScalePosition(scalePositionKey);
      return;
    }
    const frame = requestAnimationFrame(() =>
      setAppliedScalePosition(scalePositionKey)
    );
    return () => cancelAnimationFrame(frame);
  }, [scalePositionKey, refreshScalePosition]);

  return refreshScalePosition;
};
