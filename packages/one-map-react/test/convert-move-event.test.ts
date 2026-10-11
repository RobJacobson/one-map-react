import { describe, expect, test } from "@jest/globals";

import {
  clickEventFromMaplibreNative,
  clickEventFromRnmapbox,
  clickEventFromWeb,
  moveEventFromMaplibreNative,
  moveEventFromRnmapbox,
  moveEventFromWeb,
  originFromUserInteraction,
} from "../src/convert-move-event.js";

const viewState = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};

describe("move event conversion", () => {
  test("user interaction is user; otherwise unknown", () => {
    expect(originFromUserInteraction(true)).toBe("user");
    expect(originFromUserInteraction(false)).toBe("unknown");
  });

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

  test("MapLibre Native maps center tuples and userInteraction", () => {
    expect(
      moveEventFromMaplibreNative([-122.34, 47.61], 11, 0, 0, false)
    ).toEqual({
      viewState,
      origin: "unknown",
    });
  });

  test("web treats a present originalEvent as user movement", () => {
    expect(moveEventFromWeb(viewState, {})).toEqual({
      viewState,
      origin: "user",
    });
    expect(moveEventFromWeb(viewState, undefined)).toEqual({
      viewState,
      origin: "unknown",
    });
  });

  test("clicks use coordinate and point tuples", () => {
    expect(
      clickEventFromWeb({
        lngLat: { lng: -122.34, lat: 47.61 },
        point: { x: 8, y: 9 },
        features: [{ id: "pier" }],
      })
    ).toEqual({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
      features: [{ id: "pier" }],
    });
    expect(
      clickEventFromRnmapbox({
        geometry: { coordinates: [-122.34, 47.61] },
        properties: { screenPointX: 8, screenPointY: 9 },
      })
    ).toEqual({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
    });
    expect(clickEventFromMaplibreNative([-122.34, 47.61], [8, 9])).toEqual({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
    });
  });
});
