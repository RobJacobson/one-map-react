import { describe, expect, expectTypeOf, test } from "vite-plus/test";

import { toRnmapboxGestures } from "../src/adapters/mapbox-native/convert-gestures.js";
import { toMaplibreGestures } from "../src/adapters/maplibre-native/convert-gestures.js";
import type { GestureSelection, MapProps } from "../src/contracts/map-types.js";

test("gesture selection retains the common map field types", () => {
  expectTypeOf<GestureSelection>().toEqualTypeOf<
    Pick<
      MapProps,
      | "interactive"
      | "dragPan"
      | "touchZoom"
      | "touchRotate"
      | "touchPitch"
      | "doubleTapZoom"
      | "scrollZoom"
      | "doubleClickZoom"
      | "dragRotate"
      | "boxZoom"
      | "keyboard"
      | "cooperativeGestures"
      | "clickTolerance"
      | "hash"
    >
  >();
});

describe("gesture conversion", () => {
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
