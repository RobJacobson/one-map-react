import { describe, expect, test } from "vite-plus/test";

import {
  toRnmapboxCornerBounds,
  toRnmapboxDefaultSettings,
  toRnmapboxFlyToStop,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "../src/adapters/mapbox-native/convert-camera.js";
import {
  toMaplibreFlyToOptions,
  toMaplibreInitialViewState,
} from "../src/adapters/maplibre-native/convert-camera.js";
import {
  toWebCommandOptions,
  toWebFlyToOptions,
  toWebInitialViewState,
} from "../src/adapters/web/convert-camera.js";
import type { FlyToOptions, ViewState } from "../src/contracts/camera-types.js";

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

  test("RNMapbox corner bounds keep the corner pair order", () => {
    const bounds = [
      [170, -10],
      [-170, 10],
    ] as const;

    expect(toRnmapboxCornerBounds(bounds)).toEqual({
      sw: [170, -10],
      ne: [-170, 10],
    });
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
