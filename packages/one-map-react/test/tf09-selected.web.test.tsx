import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, test, vi } from "vite-plus/test";

import { MapSetup } from "../src/facade/map-setup.js";
import type { createWebMapMock } from "./create-web-map-mock.js";

vi.mock("react-map-gl/mapbox", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");
  return createWebMapMock();
});
vi.mock("react-map-gl/maplibre", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");
  return createWebMapMock();
});

import * as mapboxWrapper from "react-map-gl/mapbox";
import * as maplibreWrapper from "react-map-gl/maplibre";

import * as mapbox from "../src/mapbox-web.js";
import * as maplibre from "../src/maplibre-web.js";

type MockModule = ReturnType<typeof createWebMapMock>;
const camera = { longitude: 0, latitude: 0, zoom: 0, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };
const coordinates: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

describe.each([
  ["mapbox", mapbox, mapboxWrapper, "setRain"],
  ["maplibre", maplibre, maplibreWrapper, "setSky"],
] as const)("%s selected facilities", (_engine, entry, wrapper, name) => {
  test("named methods preserve upstream sync results/errors and reject retained calls synchronously after detach", () => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const result = { accepted: true };
    const operation = vi.fn(() => result);
    mock.selectedMethods[name] = operation;
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const selected = ref.current;
    if (!selected) throw new Error("No selected map ref.");
    const call =
      name === "setRain"
        ? () => selected.setRain({ density: 0 })
        : () => selected.setSky({ "sky-color": "#000000" });
    expect(call()).toBe(result);
    expect(operation).toHaveBeenCalledTimes(1);
    operation.mockImplementationOnce(() => {
      throw new Error("SDK failure");
    });
    expect(call).toThrow("SDK failure");
    mounted.unmount();
    expect(call).toThrow("not attached");
    delete mock.selectedMethods[name];
  });

  test.each([
    ["on", ["idle", (): void => undefined]],
    ["off", ["idle", (): void => undefined]],
    ["once", ["idle"]],
    [
      "addControl",
      [
        {
          onAdd: (): HTMLElement => document.createElement("div"),
          onRemove: (): void => undefined,
        },
        "top-left",
      ],
    ],
    ["removeControl", [{}]],
    ["hasControl", [{}]],
    ["getCanvas", []],
    ["getCanvasContainer", []],
    ["getContainer", []],
    ["getStyle", []],
    ["loaded", []],
    ["isStyleLoaded", []],
    ["areTilesLoaded", []],
    ["triggerRepaint", []],
  ] as const)(
    "%s preserves arguments, synchronous results, failures and detachment",
    (method, args) => {
      const mock = wrapper as unknown as MockModule;
      mock.resetWebMapMock();
      const result = { method };
      const operation = vi.fn(() => result);
      mock.selectedMethods[method] = operation;
      const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
      const mounted = render(
        <MapSetup adapter={entry.adapter}>
          <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
        </MapSetup>
      );
      const selected = ref.current;
      if (!selected) throw new Error("No selected map ref.");
      const call = () => Reflect.apply(selected[method], selected, args);
      expect(call()).toBe(result);
      expect(operation).toHaveBeenCalledWith(...args);
      const failure = new Error("wrapper operation failed");
      operation.mockImplementationOnce(() => {
        throw failure;
      });
      expect(call).toThrow(failure);
      mounted.unmount();
      expect(call).toThrow("not attached");
      delete mock.selectedMethods[method];
    }
  );

  test("selected handler settings keep keyboard panning separate and forward SDK rates", () => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const renderer = mock.getStyleTarget();
    if (!renderer || !ref.current) throw new Error("Missing renderer.");
    const selected = ref.current;
    const setZoomRate = vi.fn();
    const setWheelZoomRate = vi.fn();
    const enableRotation = vi.fn();
    const disableRotation = vi.fn();
    const isEnabled = vi.fn(() => true);
    const isActive = vi.fn(() => false);
    Object.assign(renderer, {
      scrollZoom: { setZoomRate, setWheelZoomRate, isEnabled, isActive },
      keyboard: { enableRotation, disableRotation },
    });
    selected.getGestureHandler("scrollZoom").setZoomRate(1 / 100);
    selected.getGestureHandler("scrollZoom").setWheelZoomRate(1 / 600);
    selected.getGestureHandler("keyboard").disableRotation();
    selected.getGestureHandler("keyboard").enableRotation();
    expect(selected.getGestureHandler("scrollZoom").isEnabled()).toBe(true);
    expect(selected.getGestureHandler("scrollZoom").isActive()).toBe(false);
    expect(isEnabled).toHaveBeenCalledTimes(1);
    expect(isActive).toHaveBeenCalledTimes(1);
    expect(() =>
      Reflect.apply(selected.getGestureHandler, selected, ["unknown"])
    ).toThrow("Unknown gesture handler");
    expect(setZoomRate).toHaveBeenCalledWith(1 / 100);
    expect(setWheelZoomRate).toHaveBeenCalledWith(1 / 600);
    expect(disableRotation).toHaveBeenCalledTimes(1);
    expect(enableRotation).toHaveBeenCalledTimes(1);
    const retained = ref.current;
    const failure = new Error("SDK rate failure");
    setZoomRate.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() =>
      retained.getGestureHandler("scrollZoom").setZoomRate(0)
    ).toThrow(failure);
    mounted.unmount();
    expect(() =>
      retained.getGestureHandler("scrollZoom").setWheelZoomRate(0)
    ).toThrow("not attached");
    expect(() => retained.getGestureHandler("keyboard")).toThrow(
      "not attached"
    );
  });

  test("plugin event production dispatches through the named SDK route with errors and detach checks", () => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const renderer = mock.getStyleTarget();
    const selected = ref.current;
    if (!renderer || !selected) throw new Error("Missing renderer.");
    const result = { dispatched: true };
    const fire = vi.fn(() => result);
    Object.assign(renderer, { fire });
    const data = { plugin: "example" };
    expect(Reflect.apply(selected.fire, selected, ["plugin-event", data])).toBe(
      result
    );
    expect(fire).toHaveBeenCalledWith("plugin-event", data);
    const failure = new Error("plugin event failure");
    fire.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() =>
      Reflect.apply(selected.fire, selected, ["plugin-event", data])
    ).toThrow(failure);
    mounted.unmount();
    expect(() =>
      Reflect.apply(selected.fire, selected, ["plugin-event", data])
    ).toThrow("not attached");
  });

  if (entry === maplibre) {
    test("public MapLibre event-parent routing preserves arguments, result and attachment", () => {
      const mock = wrapper as unknown as MockModule;
      mock.resetWebMapMock();
      const ref = createRef<maplibre.WebMapRef>();
      const mounted = render(
        <MapSetup adapter={maplibre.adapter}>
          <maplibre.Map ref={ref} mapStyle={style} initialViewState={camera} />
        </MapSetup>
      );
      const renderer = mock.getStyleTarget();
      const selected = ref.current;
      if (!renderer || !selected) throw new Error("Missing renderer.");
      const result = { parented: true };
      const parent = null;
      const data = { plugin: "example" };
      const setEventedParent = vi.fn(() => result);
      Object.assign(renderer, { setEventedParent });
      expect(
        Reflect.apply(selected.setEventedParent, selected, [parent, data])
      ).toBe(result);
      expect(setEventedParent).toHaveBeenCalledWith(parent, data);
      const failure = new Error("event-parent failure");
      setEventedParent.mockImplementationOnce(() => {
        throw failure;
      });
      expect(() => selected.setEventedParent(parent, data)).toThrow(failure);
      mounted.unmount();
      expect(() => selected.setEventedParent(parent, data)).toThrow(
        "not attached"
      );
    });
  }

  test("canvas coordinates are mutable, canvas identity requires remount, and teardown stays with wrapper", () => {
    const mock = wrapper as unknown as MockModule;
    const canvas = document.createElement("canvas");
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Source
          id="media"
          type="canvas"
          canvas={canvas}
          coordinates={coordinates}
        />
      </MapSetup>
    );
    const next = coordinates.map(([x, y]) => [x + 2, y]) as typeof coordinates;
    mounted.rerender(
      <MapSetup adapter={entry.adapter}>
        <entry.Source
          id="media"
          type="canvas"
          canvas={canvas}
          coordinates={next}
        />
      </MapSetup>
    );
    expect(mock.Source.mock.calls.at(-1)?.[0]).toMatchObject({
      canvas,
      coordinates: next,
    });
    expect(() =>
      mounted.rerender(
        <MapSetup adapter={entry.adapter}>
          <entry.Source
            id="media"
            type="canvas"
            canvas={document.createElement("canvas")}
            coordinates={next}
          />
        </MapSetup>
      )
    ).toThrow("new React key");
    mounted.unmount();
  });

  test("video URLs and custom callback sets are fixed for attachment", () => {
    const video = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Source
          id="video"
          type="video"
          urls={["fixture-a.webm"]}
          coordinates={coordinates}
        />
      </MapSetup>
    );
    expect(() =>
      video.rerender(
        <MapSetup adapter={entry.adapter}>
          <entry.Source
            id="video"
            type="video"
            urls={["fixture-b.webm"]}
            coordinates={coordinates}
          />
        </MapSetup>
      )
    ).toThrow("new React key");
    video.unmount();
    const renderLayer = () => undefined;
    const layer = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Layer id="gpu" type="custom" render={renderLayer} />
      </MapSetup>
    );
    expect(() =>
      layer.rerender(
        <MapSetup adapter={entry.adapter}>
          <entry.Layer id="gpu" type="custom" render={() => undefined} />
        </MapSetup>
      )
    ).toThrow("new React key");
    layer.unmount();
  });
});

test("selected Mapbox layer supplies an id and forwards mutable slot update/reset and replacement-style creation props", () => {
  const mock = mapboxWrapper as unknown as MockModule;
  mock.resetWebMapMock();
  const setSlot = vi.fn();
  mock.selectedMethods.setSlot = setSlot;
  const content = (slot?: string, name = "first") => (
    <MapSetup adapter={mapbox.adapter}>
      <mapbox.Map mapStyle={{ ...style, name }} initialViewState={camera}>
        <mapbox.Layer type="background" slot={slot} />
      </mapbox.Map>
    </MapSetup>
  );
  const mounted = render(content("bottom"));
  const id = mock.Layer.mock.calls.at(-1)?.[0].id;
  expect(typeof id).toBe("string");
  mounted.rerender(content("top"));
  expect(setSlot).toHaveBeenLastCalledWith(id, "top");
  mounted.rerender(content(undefined));
  expect(setSlot).toHaveBeenLastCalledWith(id, undefined);
  mounted.rerender(content("middle", "replacement"));
  expect(mock.Layer.mock.calls.at(-1)?.[0]).toMatchObject({
    id,
    slot: "middle",
  });
  mounted.unmount();
  delete mock.selectedMethods.setSlot;
});

test.each([
  [
    "mapbox",
    mapbox,
    mapboxWrapper,
    [
      "queryRasterValue",
      "getVerticalFieldOfView",
      "setSnow",
      "setLights",
      "addImport",
      "updateImport",
      "setConfigProperty",
      "setColorTheme",
      "getFeaturesetDescriptors",
      "getIndoorTileOptions",
      "setLanguage",
      "setWorldview",
      "setScaleFactor",
      "setNearClipOffset",
      "addModel",
    ],
  ],
  [
    "maplibre",
    maplibre,
    maplibreWrapper,
    [
      "setGlobalStateProperty",
      "refreshTiles",
      "setFontFaces",
      "setTransformRequest",
      "setVerticalFieldOfView",
      "redraw",
      "getProjection",
    ],
  ],
] as const)(
  "%s advanced families preserve arguments and returned SDK values",
  (_engine, entry, wrapper, names) => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const operations = names.map((name) => {
      const operation = vi.fn(() => ({ name }));
      mock.selectedMethods[name] = operation;
      return [name, operation] as const;
    });
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    for (const [name, operation] of operations) {
      // The selected consumer checks own SDK input typing; this table tests exact forwarding only.
      const call = Reflect.get(ref.current ?? {}, name) as (
        ...args: unknown[]
      ) => unknown;
      expect(call("argument", 0, undefined)).toEqual({ name });
      expect(operation).toHaveBeenLastCalledWith("argument", 0, undefined);
    }
    mounted.unmount();
    for (const name of names) delete mock.selectedMethods[name];
  }
);

test.each([
  ["mapbox", mapbox, mapboxWrapper, "3.32.0"],
  ["maplibre", maplibre, maplibreWrapper, "6.13.0"],
] as const)(
  "%s reads the attached SDK version and throws after detach",
  (_engine, entry, wrapper, version) => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const renderer = mock.getStyleTarget() as unknown as { version: string };
    renderer.version = version;
    const selected = ref.current;
    if (!selected) throw new Error("Missing selected map ref.");
    expect(selected.getVersion()).toBe(version);
    mounted.unmount();
    expect(() => selected.getVersion()).toThrow("not attached");
  }
);

test("Mapbox wireframe debug fields read/write explicit false and preserve input", () => {
  const mock = mapboxWrapper as unknown as MockModule;
  mock.resetWebMapMock();
  const ref = createRef<mapbox.WebMapRef>();
  const mounted = render(
    <MapSetup adapter={mapbox.adapter}>
      <mapbox.Map ref={ref} mapStyle={style} initialViewState={camera} />
    </MapSetup>
  );
  const value = Object.freeze({
    showLayers2DWireframe: true,
    showLayers3DWireframe: false,
  });
  ref.current?.setDebugOptions(value);
  expect(ref.current?.getDebugOptions()).toMatchObject(value);
  ref.current?.setDebugOptions({
    showLayers2DWireframe: false,
    showLayers3DWireframe: true,
  });
  expect(ref.current?.getDebugOptions()).toMatchObject({
    showLayers2DWireframe: false,
    showLayers3DWireframe: true,
  });
  expect(value).toEqual({
    showLayers2DWireframe: true,
    showLayers3DWireframe: false,
  });
  mounted.unmount();
});

test("MapLibre pending-tile cancellation has explicit mutable read/write without losing false", () => {
  const mock = maplibreWrapper as unknown as MockModule;
  mock.resetWebMapMock();
  const ref = createRef<maplibre.WebMapRef>();
  const mounted = render(
    <MapSetup adapter={maplibre.adapter}>
      <maplibre.Map ref={ref} mapStyle={style} initialViewState={camera} />
    </MapSetup>
  );
  const selected = ref.current;
  if (!selected) throw new Error("Missing selected map ref.");
  selected.setCancelPendingTileRequestsWhileZooming(false);
  expect(selected.getCancelPendingTileRequestsWhileZooming()).toBe(false);
  selected.setCancelPendingTileRequestsWhileZooming(true);
  expect(selected.getCancelPendingTileRequestsWhileZooming()).toBe(true);
  mounted.unmount();
  expect(() =>
    selected.setCancelPendingTileRequestsWhileZooming(false)
  ).toThrow("not attached");
  expect(() => selected.getCancelPendingTileRequestsWhileZooming()).toThrow(
    "not attached"
  );
});
