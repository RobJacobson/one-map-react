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
    const selection = {
      interactive: false,
      dragPan: true,
      touchZoomRotate: true,
      touchZoom: true,
      touchPitch: true,
      doubleTapZoom: true,
    };

    expect(toRnmapboxGestures(selection)).toEqual({
      scrollEnabled: false,
      zoomEnabled: false,
      rotateEnabled: false,
      pitchEnabled: false,
      gestureSettings: {
        doubleTapToZoomInEnabled: false,
        doubleTouchToZoomOutEnabled: false,
      },
    });
    expect(toMaplibreGestures(selection)).toEqual({
      dragPan: false,
      touchZoom: false,
      touchRotate: false,
      touchPitch: false,
      doubleTapZoom: false,
      doubleTapHoldZoom: false,
    });
  });

  test.each([false, true])(
    "specific gestures take precedence over touchZoomRotate=%s",
    (combined) => {
      expect(
        toRnmapboxGestures({
          touchZoomRotate: combined,
          touchZoom: !combined,
          touchRotate: undefined,
        })
      ).toEqual({ zoomEnabled: !combined, rotateEnabled: combined });
      expect(
        toMaplibreGestures({
          touchZoomRotate: combined,
          touchRotate: !combined,
        })
      ).toEqual({ touchZoom: combined, touchRotate: !combined });
    }
  );

  test("omitted portable flags leave wrapper fields unset", () => {
    expect(toRnmapboxGestures({})).toStrictEqual({});
    expect(toMaplibreGestures({})).toStrictEqual({});
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
