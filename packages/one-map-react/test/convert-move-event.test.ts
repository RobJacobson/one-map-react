import { describe, expect, test } from "vite-plus/test";

import {
  clickEventFromRnmapbox,
  moveEventFromRnmapbox,
} from "../src/adapters/mapbox-native/convert-move-event.js";
import { moveEventFromNative } from "../src/adapters/shared/index.js";
import { nativeClick } from "../src/adapters/shared/native-values.js";

describe("move event conversion", () => {
  test.each([
    { isUserInteraction: true, origin: "user" },
    { isUserInteraction: false, origin: "unknown" },
  ])(
    "maps native camera fields with $origin origin",
    ({ isUserInteraction, origin }) => {
      expect(
        moveEventFromNative(-122.34, 47.61, 11, 0, 0, isUserInteraction)
      ).toEqual({
        viewState: {
          longitude: -122.34,
          latitude: 47.61,
          zoom: 11,
          bearing: 0,
          pitch: 0,
        },
        origin,
      });
    }
  );

  test("RNMapbox rejects a center without both coordinates", () => {
    expect(() => moveEventFromRnmapbox([-122.34], 11, 0, 0, false)).toThrow(
      "RNMapbox camera center is missing longitude or latitude."
    );
  });

  test("RNMapbox maps heading and gesture activity", () => {
    expect(moveEventFromRnmapbox([-122.34, 47.61], 11, 12, 3, true)).toEqual({
      viewState: {
        longitude: -122.34,
        latitude: 47.61,
        zoom: 11,
        bearing: 12,
        pitch: 3,
      },
      origin: "user",
    });
  });

  test("clicks use coordinate and point tuples", () => {
    expect(
      clickEventFromRnmapbox({
        geometry: { coordinates: [-122.34, 47.61] },
        properties: { screenPointX: 8, screenPointY: 9 },
      })
    ).toEqual({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
    });
    expect(nativeClick([-122.34, 47.61], [8, 9])).toEqual({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
    });
  });
});
