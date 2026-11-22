import { describe, expect, test } from "vite-plus/test";

import {
  toRnmapboxCornerBounds,
  toRnmapboxControlledCamera,
  toRnmapboxDefaultSettings,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "../src/adapters/mapbox-native/convert-camera.js";
import {
  toMaplibreCommand,
  toMaplibreInitialViewState,
  toMaplibreViewState,
} from "../src/adapters/maplibre-native/convert-camera.js";
import {
  toWebCommandOptions,
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

  test("MapLibre Native initial and controlled views use a center tuple", () => {
    expect(toMaplibreViewState(viewState)).toEqual({
      center: [-122.34, 47.61],
      zoom: 11,
      bearing: 0,
      pitch: 0,
    });
  });

  test("web flyTo passes center and duration", () => {
    expect(toWebCommandOptions(flight)).toEqual({
      center: [-122.34, 47.61],
      duration: 1000,
    });
  });

  test("fills desktop camera defaults only on initialization", () => {
    expect(toRnmapboxDefaultSettings()).toMatchObject({
      centerCoordinate: [0, 0],
      zoomLevel: 0,
      heading: 0,
      pitch: 0,
    });
    expect(toMaplibreInitialViewState({ longitude: 17 })).toMatchObject({
      center: [17, 0],
      zoom: 0,
      bearing: 0,
      pitch: 0,
    });
    expect(
      toRnmapboxControlledCamera({ zoom: 8 }).centerCoordinate
    ).toBeUndefined();
    expect(toMaplibreViewState({ zoom: 8 }).center).toBeUndefined();
  });

  test("fits initial bounds with orientation and fit padding", () => {
    const initial = {
      ...viewState,
      bounds: [1, 2, 3, 4] as const,
      bearing: 30,
      pitch: 45,
      padding: { top: 8 },
      fitBoundsOptions: { padding: 12 },
    };
    expect(toRnmapboxDefaultSettings(initial)).toMatchObject({
      bounds: { sw: [1, 2], ne: [3, 4] },
      heading: 30,
      pitch: 45,
      padding: {
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 12,
        paddingRight: 12,
      },
    });
    expect(toMaplibreInitialViewState(initial)).toMatchObject({
      bounds: [1, 2, 3, 4],
      bearing: 30,
      pitch: 45,
      padding: { top: 12, bottom: 12, left: 12, right: 12 },
    });
  });

  test("reports initial fit constraints the native wrappers cannot apply", () => {
    const bounds = [1, 2, 3, 4] as const;
    for (const convert of [
      toRnmapboxDefaultSettings,
      toMaplibreInitialViewState,
    ]) {
      expect(() =>
        convert({ bounds, fitBoundsOptions: { offset: [3, 5] } })
      ).toThrow(/offset/);
      expect(() =>
        convert({ bounds, fitBoundsOptions: { minZoom: 2 } })
      ).toThrow(/minZoom/);
      expect(() =>
        convert({ bounds, fitBoundsOptions: { maxZoom: 12 } })
      ).toThrow(/maxZoom/);
    }
  });

  test("RNMapbox flyTo stop sets animationMode flyTo", () => {
    expect(toRnmapboxStop(flight, "flyTo")).toEqual({
      type: "CameraStop",
      centerCoordinate: [-122.34, 47.61],
      animationDuration: 1000,
      animationMode: "flyTo",
    });
  });

  test("MapLibre Native flyTo passes center and duration", () => {
    expect(toMaplibreCommand(flight)).toEqual({
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
