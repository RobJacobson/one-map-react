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
