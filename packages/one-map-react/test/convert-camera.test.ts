import { describe, expect, test } from "vite-plus/test";

import {
  toRnmapboxCornerBounds,
  toRnmapboxControlledCamera,
  toRnmapboxDefaultSettings,
  toRnmapboxFitBoundsStop,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "../src/adapters/mapbox-native/convert-camera.js";
import {
  toMaplibreCommand,
  toMaplibreFitBoundsOptions,
  toMaplibreInitialViewState,
  toMaplibreViewState,
} from "../src/adapters/maplibre-native/convert-camera.js";
import { nativeBoundsInput } from "../src/adapters/shared/native-values.js";
import type { FlyToOptions, ViewState } from "../src/contracts/camera-types.js";

const fitBounds = nativeBoundsInput([
  [1, 2],
  [3, 4],
]);

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

  test("rejects non-finite declarative coordinates, including lone axes", () => {
    for (const convert of [
      toRnmapboxDefaultSettings,
      toMaplibreInitialViewState,
      toRnmapboxControlledCamera,
      toMaplibreViewState,
    ]) {
      expect(() => convert({ longitude: NaN })).toThrow(/longitude.*finite/);
      expect(() => convert({ latitude: Infinity })).toThrow(/latitude.*finite/);
      expect(() => convert({ longitude: 0, latitude: -Infinity })).toThrow(
        /latitude.*finite/
      );
    }
  });

  test("validates supplied coordinates even when initial bounds set the center", () => {
    const initial = { bounds: fitBounds, latitude: NaN };
    expect(() => toRnmapboxDefaultSettings(initial)).toThrow(
      /latitude.*finite/
    );
    expect(() => toMaplibreInitialViewState(initial)).toThrow(
      /latitude.*finite/
    );
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
        convert({ bounds, fitBoundsOptions: { maxZoom: 0 } })
      ).toThrow(/maxZoom/);
    }
  });

  test("rejects a zero fit maxZoom before rejecting easing", () => {
    const options = { maxZoom: 0, easing: () => 1 };
    const message =
      "fitBounds.maxZoom is unavailable through the pinned native camera wrapper.";

    expect(() => toRnmapboxFitBoundsStop(fitBounds, options)).toThrow(message);
    expect(() => toMaplibreFitBoundsOptions(options)).toThrow(message);
  });

  test("validates easing before converting the center or fit bounds", () => {
    const bounds = nativeBoundsInput([
      [1, 2],
      [3, 4],
    ]);
    Object.defineProperty(bounds, 0, {
      get: () => {
        throw new Error("Bounds were read before validating easing.");
      },
    });
    const timing = { easing: () => 1 };
    const command = { ...timing, center: [NaN, 2] as const };
    const message = /An easing function is not available on native maps/;

    expect(() => toRnmapboxStop(command, "easeTo")).toThrow(message);
    expect(() => toMaplibreCommand(command)).toThrow(message);
    expect(() => toRnmapboxFitBoundsStop(bounds, timing)).toThrow(message);
    expect(() => toMaplibreFitBoundsOptions(timing)).toThrow(message);
  });

  test("fit options ignore extra camera fields and keep explicit zeroes", () => {
    const options = {
      center: "invalid coordinate",
      zoom: 99,
      bearing: 0,
      pitch: 0,
      duration: 0,
      padding: { top: 5 },
    };

    expect(toRnmapboxFitBoundsStop(fitBounds, options)).toStrictEqual({
      type: "CameraStop",
      bounds: { sw: [1, 2], ne: [3, 4] },
      heading: 0,
      pitch: 0,
      animationDuration: 0,
      padding: {
        paddingTop: 5,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      },
      animationMode: "easeTo",
    });
    expect(toMaplibreFitBoundsOptions(options)).toStrictEqual({
      bearing: 0,
      pitch: 0,
      duration: 0,
      padding: { top: 5, right: 0, bottom: 0, left: 0 },
    });
  });

  test("omitted command and fit options leave wrapper fields unset", () => {
    expect(toRnmapboxStop({}, "flyTo")).toStrictEqual({
      type: "CameraStop",
      animationMode: "flyTo",
    });
    expect(toRnmapboxFitBoundsStop(fitBounds)).toStrictEqual({
      type: "CameraStop",
      bounds: { sw: [1, 2], ne: [3, 4] },
      animationMode: "easeTo",
    });
    expect(toMaplibreCommand({})).toStrictEqual({});
    expect(toMaplibreFitBoundsOptions()).toStrictEqual({});
  });

  test("RNMapbox zoomTo forwards only the zoom argument and optional duration", () => {
    const options = {
      center: "invalid coordinate",
      zoom: 99,
      bearing: 41,
      padding: 10,
      duration: 0,
    };

    expect(toRnmapboxZoomStop(9, options)).toStrictEqual({
      type: "CameraStop",
      zoomLevel: 9,
      animationDuration: 0,
      animationMode: "none",
    });
    expect(toRnmapboxZoomStop(9)).toStrictEqual({
      type: "CameraStop",
      zoomLevel: 9,
      animationMode: "easeTo",
    });
    expect(() => toRnmapboxZoomStop(9, { easing: () => 1 })).toThrow(
      /An easing function is not available on native maps/
    );
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

  test("RNMapbox corner bounds keep corner order and isolate wrapper mutations", () => {
    const bounds = [
      [170, -10],
      [-170, 10],
    ] as const;

    const corners = toRnmapboxCornerBounds(nativeBoundsInput(bounds));

    expect(corners).toEqual({
      sw: [170, -10],
      ne: [-170, 10],
    });
    corners.sw[0] = 0;
    expect(bounds[0][0]).toBe(170);
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
  });
});
