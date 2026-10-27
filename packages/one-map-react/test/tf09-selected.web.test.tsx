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
  ["mapbox", mapbox, mapboxWrapper],
  ["maplibre", maplibre, maplibreWrapper],
] as const)("%s selected facilities", (_engine, entry, wrapper) => {
  test("selected facade omits advanced method mirrors", () => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    for (const method of [
      "getStyle",
      "fire",
      "getGestureHandler",
      "getVersion",
      "getDebugOptions",
      "getCanvasSource",
    ]) {
      expect(Reflect.get(ref.current ?? {}, method)).toBeUndefined();
    }
    mounted.unmount();
  });

  test("borrowed wrapper reads preserve results and errors without facade lifetime guards", async () => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const result = { version: 8, sources: {}, layers: [] };
    const operation = vi.fn(() => result);
    mock.selectedMethods.getStyle = operation;
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const facade = ref.current;
    if (!facade) throw new Error("No selected map ref.");
    const borrowed = await facade.getWrapperMap();
    expect(borrowed.getStyle()).toBe(result);
    const failure = new Error("wrapper read failed");
    operation.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() => borrowed.getStyle()).toThrow(failure);
    mounted.unmount();
    await expect(facade.getWrapperMap()).rejects.toThrow("not attached");
    expect(borrowed.getStyle()).toBe(result);
    delete mock.selectedMethods.getStyle;
  });

  test("plugin events and parent routing use the raw map behind the borrowed wrapper", async () => {
    const mock = wrapper as unknown as MockModule;
    mock.resetWebMapMock();
    const ref = createRef<mapbox.WebMapRef & maplibre.WebMapRef>();
    const mounted = render(
      <MapSetup adapter={entry.adapter}>
        <entry.Map ref={ref} mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const facade = ref.current;
    if (!facade) throw new Error("No selected map ref.");
    const borrowed = await facade.getWrapperMap();
    expect(Reflect.get(borrowed, "fire")).toBeUndefined();
    expect(Reflect.get(borrowed, "setEventedParent")).toBeUndefined();
    const renderer = borrowed.getMap();
    const result = { dispatched: true };
    const fire = vi.fn(() => result);
    const setEventedParent = vi.fn(() => result);
    Object.assign(renderer, { fire, setEventedParent });
    const data = { plugin: "example" };
    expect(Reflect.apply(renderer.fire, renderer, ["plugin-event", data])).toBe(
      result
    );
    expect(fire).toHaveBeenCalledWith("plugin-event", data);
    expect(
      Reflect.apply(renderer.setEventedParent, renderer, [null, data])
    ).toBe(result);
    expect(setEventedParent).toHaveBeenCalledWith(null, data);
    const failure = new Error("plugin event failed");
    fire.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() =>
      Reflect.apply(renderer.fire, renderer, ["plugin-event", data])
    ).toThrow(failure);
    setEventedParent.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() =>
      Reflect.apply(renderer.setEventedParent, renderer, [null, data])
    ).toThrow(failure);
    mounted.unmount();
    await expect(facade.getWrapperMap()).rejects.toThrow("not attached");
    expect(Reflect.apply(renderer.fire, renderer, ["plugin-event", data])).toBe(
      result
    );
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
