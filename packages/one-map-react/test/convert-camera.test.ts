import { describe, expect, test } from "@jest/globals";

import type { FlyToOptions, ViewState } from "../src/camera-types.js";
import {
  toMaplibreFlyToOptions,
  toMaplibreInitialViewState,
  toRnmapboxDefaultSettings,
  toRnmapboxFlyToStop,
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
});
