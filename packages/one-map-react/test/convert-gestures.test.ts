import { describe, expect, test } from "vite-plus/test";

import { normalizeNativeGestures } from "../src/adapters/index.js";
import { toMaplibreGestures } from "../src/adapters/maplibre-native/convert-gestures.js";

describe("gesture conversion", () => {
  test("pan and pinch can be disabled independently of double tap", () => {
    expect(
      normalizeNativeGestures({
        dragPan: false,
        touchZoom: false,
        doubleTapZoom: true,
      })
    ).toMatchObject({
      dragPan: false,
      touchZoom: false,
      doubleTapZoom: true,
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
        normalizeNativeGestures({
          touchZoomRotate: combined,
          touchZoom: !combined,
          touchRotate: undefined,
        })
      ).toMatchObject({ touchZoom: !combined, touchRotate: combined });
      expect(
        toMaplibreGestures({
          touchZoomRotate: combined,
          touchRotate: !combined,
        })
      ).toEqual({ touchZoom: combined, touchRotate: !combined });
    }
  );

  test("omitted portable flags leave wrapper fields unset", () => {
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
