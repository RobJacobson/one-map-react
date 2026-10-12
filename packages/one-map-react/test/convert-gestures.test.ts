import { describe, expect, test } from "@jest/globals";

import { toRnmapboxGestures } from "../src/adapters/mapbox-native/convert-gestures.js";
import { toMaplibreGestures } from "../src/adapters/maplibre-native/convert-gestures.js";
import {
  toWebGestureProps,
  webTouchZoomRotate,
} from "../src/adapters/web/convert-gestures.js";

describe("gesture conversion", () => {
  test("web keeps pinch zoom when rotation is off", () => {
    expect(webTouchZoomRotate(undefined, false)).toBe(true);
    expect(webTouchZoomRotate(false, false)).toBe(false);
    expect(webTouchZoomRotate(undefined, undefined)).toBeUndefined();
    expect(toWebGestureProps({ touchRotate: false, dragPan: false })).toEqual({
      dragPan: false,
      touchZoomRotate: true,
    });
  });

  test("RNMapbox renames pan and records both double-tap flags", () => {
    expect(
      toRnmapboxGestures({
        dragPan: false,
        touchZoom: false,
        doubleTapZoom: true,
      })
    ).toEqual({
      scrollEnabled: false,
      zoomEnabled: false,
      gestureSettings: {
        doubleTapToZoomInEnabled: true,
        doubleTouchToZoomOutEnabled: true,
      },
    });
  });

  test("interactive false forces native flags off", () => {
    expect(toRnmapboxGestures({ interactive: false, dragPan: true })).toEqual({
      scrollEnabled: false,
      zoomEnabled: false,
      rotateEnabled: false,
      pitchEnabled: false,
      gestureSettings: {
        doubleTapToZoomInEnabled: false,
        doubleTouchToZoomOutEnabled: false,
      },
    });
  });

  test("MapLibre passes double tap beside a disabled pinch zoom", () => {
    expect(
      toMaplibreGestures({ touchZoom: false, doubleTapZoom: true })
    ).toEqual({
      touchZoom: false,
      doubleTapZoom: true,
      doubleTapHoldZoom: true,
    });
  });
});
