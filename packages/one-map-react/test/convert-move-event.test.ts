import { describe, expect, test } from "vite-plus/test";

import {
  clickEventFromRnmapbox,
  moveEventFromRnmapbox,
} from "../src/adapters/mapbox-native/convert-move-event.js";
import {
  moveEventFromNative,
  nativeLngLat,
  nativePoint,
} from "../src/adapters/shared/index.js";
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

test.each([
  { convert: nativeLngLat, firstField: "lng", secondField: "lat" },
  { convert: nativePoint, firstField: "x", secondField: "y" },
])(
  "native tuples preserve $firstField and $secondField as readonly named fields",
  ({ convert, firstField, secondField }) => {
    const input: [number, number] = [0, -12];
    const result = convert(input);
    input[0] = 99;
    const fieldFlags = {
      enumerable: false,
      writable: false,
      configurable: false,
    };

    expect(Array.isArray(result)).toBe(true);
    expect(Reflect.ownKeys(result)).toEqual([
      "0",
      "1",
      "length",
      firstField,
      secondField,
    ]);
    expect(Object.getOwnPropertyDescriptors(result)).toMatchObject({
      [firstField]: { value: 0, ...fieldFlags },
      [secondField]: { value: -12, ...fieldFlags },
    });
    expect(JSON.stringify(result)).toBe("[0,-12]");
  }
);
