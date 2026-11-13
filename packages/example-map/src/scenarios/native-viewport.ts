import type { View } from "react-native";

/** Actual native window bounds used to calibrate physical acceptance input. */
export type NativeViewport = readonly [number, number, number, number];

/**
 * Measures an attached native map host, rejecting invalid touch geometry.
 * @param view - The current native host; retired or unmeasured hosts must not receive input.
 * @returns Window x, y, width and height in logical points.
 */
export const measureNativeViewport = (
  view: Pick<View, "measureInWindow"> | null
): Promise<NativeViewport> =>
  new Promise((resolve, reject) => {
    if (!view) {
      reject(new Error("Acceptance map host is detached."));
      return;
    }
    view.measureInWindow((x, y, width, height) => {
      if (
        ![x, y, width, height].every(Number.isFinite) ||
        x < 0 ||
        y < 0 ||
        width <= 0 ||
        height <= 0
      ) {
        reject(new Error("Acceptance map host has invalid window bounds."));
        return;
      }
      resolve([x, y, width, height]);
    });
  });
