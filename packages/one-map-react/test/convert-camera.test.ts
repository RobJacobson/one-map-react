import { describe, expect, test } from "@jest/globals";

import type { FlyToOptions, ViewState } from "../src/camera-types.js";
import {
  assertBounds,
  boundsFromFlat,
  boundsFromGeographic,
  boundsFromRnmapboxVisible,
  normalizePadding,
  toFlatBounds,
  toMaplibreFlyToOptions,
  toMaplibreInitialViewState,
  toRnmapboxCornerBounds,
  toRnmapboxDefaultSettings,
  toRnmapboxFlyToStop,
  toRnmapboxStop,
  toRnmapboxZoomStop,
  toWebCommandOptions,
  toWebFlyToOptions,
  toWebInitialViewState,
} from "../src/convert-camera.js";

const viewState: ViewState = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};

const flight: FlyToOptions = {
  center: [-122.34, 47.61],
  duration: 1000,
};

describe("camera conversion", () => {
  test("web initial view state keeps longitude and latitude fields", () => {
    expect(toWebInitialViewState(viewState)).toEqual(viewState);
  });

  test("RNMapbox default settings use centerCoordinate, zoomLevel, and heading", () => {
    expect(toRnmapboxDefaultSettings(viewState)).toEqual({
      centerCoordinate: [-122.34, 47.61],
      zoomLevel: 11,
      heading: 0,
      pitch: 0,
    });
  });

  test("MapLibre Native initial view state uses a center tuple", () => {
    expect(toMaplibreInitialViewState(viewState)).toEqual({
      center: [-122.34, 47.61],
      zoom: 11,
      bearing: 0,
      pitch: 0,
    });
  });

  test("web flyTo passes center and duration", () => {
    expect(toWebFlyToOptions(flight)).toEqual({
      center: [-122.34, 47.61],
      duration: 1000,
    });
  });

  test("RNMapbox flyTo stop sets animationMode flyTo", () => {
    expect(toRnmapboxFlyToStop(flight)).toEqual({
      type: "CameraStop",
      centerCoordinate: [-122.34, 47.61],
      animationDuration: 1000,
      animationMode: "flyTo",
    });
  });

  test("MapLibre Native flyTo passes center and duration", () => {
    expect(toMaplibreFlyToOptions(flight)).toEqual({
      center: [-122.34, 47.61],
      duration: 1000,
    });
  });

  test("padding fills missing sides and a single number fills every side", () => {
    expect(normalizePadding({ top: 4 })).toEqual({
      top: 4,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(normalizePadding(6)).toEqual({
      top: 6,
      right: 6,
      bottom: 6,
      left: 6,
    });
  });

  test("antimeridian bounds keep west greater than east", () => {
    const bounds = [
      [170, -10],
      [-170, 10],
    ] as const;

    expect(toFlatBounds(bounds)).toEqual([170, -10, -170, 10]);
    expect(toRnmapboxCornerBounds(bounds)).toEqual({
      sw: [170, -10],
      ne: [-170, 10],
    });
    expect(boundsFromFlat([170, -10, -170, 10])).toEqual([
      [170, -10],
      [-170, 10],
    ]);
  });

  test("invalid bounds are rejected", () => {
    expect(() => assertBounds([[-122.34], [-122, 47]] as never)).toThrow(
      "Bounds must be [[west, south], [east, north]]."
    );
  });

  test("RNMapbox visible bounds are northeast then southwest", () => {
    expect(
      boundsFromRnmapboxVisible([
        [-122.2, 47.7],
        [-122.4, 47.5],
      ])
    ).toEqual([
      [-122.4, 47.5],
      [-122.2, 47.7],
    ]);
  });

  test("web bounds read corner methods and reject a two-element array", () => {
    expect(
      boundsFromGeographic({
        getWest: () => 170,
        getSouth: () => -10,
        getEast: () => -170,
        getNorth: () => 10,
      })
    ).toEqual([
      [170, -10],
      [-170, 10],
    ]);
    expect(() =>
      boundsFromGeographic([
        [170, -10],
        [-170, 10],
      ])
    ).toThrow("Map bounds must be [west, south, east, north]");
  });

  test("RNMapbox ease and jump set animationMode explicitly", () => {
    expect(toRnmapboxStop({ zoom: 12, duration: 250 }, "easeTo")).toEqual({
      type: "CameraStop",
      zoomLevel: 12,
      animationDuration: 250,
      animationMode: "easeTo",
    });
    expect(toRnmapboxStop({ center: [-122.34, 47.61] }, "none")).toEqual({
      type: "CameraStop",
      centerCoordinate: [-122.34, 47.61],
      animationMode: "none",
    });
    expect(toRnmapboxZoomStop(9, { duration: 0 }).animationMode).toBe("none");
    expect(() => toRnmapboxStop({ easing: () => 1 }, "easeTo")).toThrow(
      "An easing function is not available on native maps."
    );
  });

  test("web commands keep an easing function", () => {
    const easing = () => 1;

    expect(toWebCommandOptions({ zoom: 3, easing })).toEqual({
      zoom: 3,
      easing,
    });
  });
});
