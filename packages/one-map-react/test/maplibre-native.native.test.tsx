import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { createRef, type Ref } from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/camera-types.js";
import { Layer } from "../src/layer.js";
import { Map as OneMap } from "../src/map.js";
import { MapSetup } from "../src/map-setup.js";
import type { ExternalDrawingContext, MapProps } from "../src/map-types.js";
import { Source } from "../src/source.js";

const mockFlyTo = jest.fn(() => Promise.resolve());
const mockJumpTo = jest.fn(() => Promise.resolve());
const mockEaseTo = jest.fn(() => Promise.resolve());
const mockFitBounds = jest.fn(() => Promise.resolve());
const mockZoomTo = jest.fn(() => Promise.resolve());
const mockGetCenter = jest.fn(async () => [-122.34, 47.61]);
const mockGetZoom = jest.fn(async () => 11);
const mockGetBearing = jest.fn(async () => 4);
const mockGetPitch = jest.fn(async () => 1);
const mockGetBounds = jest.fn(async () => [170, -10, -170, 10]);
const mockProject = jest.fn(async () => [12, 34]);
const mockUnproject = jest.fn(async () => [-122.34, 47.61]);

jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  let mapSerial = 0;

  return {
    Map: jest.fn(
      ({
        children,
        ref,
        ...props
      }: {
        children?: React.ReactNode;
        ref?: React.Ref<{ getCenter: typeof mockGetCenter }>;
      }) => {
        const [mapId] = React.useState(() => {
          mapSerial += 1;
          return String(mapSerial);
        });

        React.useImperativeHandle(ref, () => ({
          getCenter: mockGetCenter,
          getZoom: mockGetZoom,
          getBearing: mockGetBearing,
          getPitch: mockGetPitch,
          getBounds: mockGetBounds,
          project: mockProject,
          unproject: mockUnproject,
        }));

        return React.createElement(
          "MaplibreMap",
          { ...props, testID: "wrapper-map", mapId },
          children
        );
      }
    ),
    Camera: React.forwardRef(
      (
        props: object,
        ref: React.Ref<{
          flyTo: typeof mockFlyTo;
          jumpTo: typeof mockJumpTo;
          easeTo: typeof mockEaseTo;
          fitBounds: typeof mockFitBounds;
          zoomTo: typeof mockZoomTo;
        }>
      ) => {
        React.useImperativeHandle(ref, () => ({
          flyTo: mockFlyTo,
          jumpTo: mockJumpTo,
          easeTo: mockEaseTo,
          fitBounds: mockFitBounds,
          zoomTo: mockZoomTo,
        }));

        return React.createElement("Camera", {
          ...props,
          testID: "wrapper-camera",
        });
      }
    ),
    GeoJSONSource: ({
      id,
      data,
      children,
    }: {
      id: string;
      data: object;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        "GeoJSONSource",
        { id, data },
        React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement, { source: id })
            : child
        )
      ),
    Layer: jest.fn((props: object) => React.createElement("Layer", props)),
  };
});

import {
  Layer as MaplibreLayer,
  Map as MaplibreMap,
} from "@maplibre/maplibre-react-native";

import { adapter } from "../src/maplibre-native.js";

const MapMock = MaplibreMap as unknown as jest.Mock;
const LayerMock = MaplibreLayer as unknown as jest.Mock;

const lastMapProps = <Props,>(): Props => {
  const lastCall = MapMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("Map was not rendered");
  }

  return lastCall[0] as Props;
};

const drawingContext = (): ExternalDrawingContext => ({
  canvas: {},
  drawingBufferWidth: 1,
  drawingBufferHeight: 1,
});

const finishMapLoad = (): void => {
  const lastCall = MapMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("Map was not rendered");
  }

  const onDidFinishLoadingMap = (
    lastCall[0] as { onDidFinishLoadingMap?: () => void }
  ).onDidFinishLoadingMap;

  if (!onDidFinishLoadingMap) {
    throw new Error("Map did not receive onDidFinishLoadingMap");
  }

  onDidFinishLoadingMap();
};

const example = (
  ref?: Ref<MapRef>,
  onMove?: (event: object) => void,
  extra?: Partial<MapProps>
) => (
  <MapSetup adapter={adapter}>
    <OneMap
      ref={ref}
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={{ flex: 1 }}
      onMove={onMove}
      {...extra}
    >
      <Source id="routes" type="geojson" data={routes}>
        <Layer
          id="route-line"
          type="line"
          paint={{ "line-color": "#2563eb", "line-width": 3 }}
          layout={{ "line-cap": "round" }}
        />
      </Source>
    </OneMap>
  </MapSetup>
);

describe("maplibre-native adapter", () => {
  test("nested GeoJSONSource injects source onto the line layer", async () => {
    await render(example());

    expect(LayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "route-line",
        type: "line",
        source: "routes",
        paint: { "line-color": "#2563eb", "line-width": 3 },
        layout: { "line-cap": "round" },
      }),
      undefined
    );
  });

  test("flyTo rejects before the map reports style load", async () => {
    mockFlyTo.mockClear();
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.flyTo({ center: [-122.34, 47.61], duration: 1000 })
    ).rejects.toThrow("Map camera is not attached.");
    expect(mockFlyTo).not.toHaveBeenCalled();
  });

  test("flyTo awaits the wrapper promise", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    finishMapLoad();
    await ref.current?.flyTo({
      center: [-122.34, 47.61],
      duration: 1000,
    });

    expect(mockFlyTo).toHaveBeenCalledWith({
      center: [-122.34, 47.61],
      duration: 1000,
    });
  });

  test("a rejected wrapper flyTo rejects the facade promise", async () => {
    mockFlyTo.mockImplementationOnce(() => Promise.reject(new Error("native")));
    const ref = createRef<MapRef>();

    await render(example(ref));
    finishMapLoad();

    await expect(
      ref.current?.flyTo({ center: [-122.34, 47.61], duration: 1000 })
    ).rejects.toThrow("native");
  });

  test("onMove receives converted camera fields and stops after unmount", async () => {
    const onMove = jest.fn();
    const rendered = await render(example(undefined, onMove));
    const lastCall = MapMock.mock.calls.at(-1);

    if (!lastCall) {
      throw new Error("Map was not rendered");
    }

    const onRegionIsChanging = (
      lastCall[0] as { onRegionIsChanging: (event: object) => void }
    ).onRegionIsChanging;

    onRegionIsChanging({
      nativeEvent: {
        center: [-122.34, 47.61],
        zoom: 11,
        bearing: 0,
        pitch: 0,
        userInteraction: true,
      },
    });

    expect(onMove).toHaveBeenCalledWith({
      viewState: initialViewState,
      origin: "user",
    });

    const onRegionDidChange = (
      lastCall[0] as { onRegionDidChange: (event: object) => void }
    ).onRegionDidChange;

    onRegionDidChange({
      nativeEvent: {
        center: [-122.32, 47.64],
        zoom: 11,
        bearing: 0,
        pitch: 0,
        userInteraction: false,
      },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenLastCalledWith({
      viewState: initialViewState,
      origin: "user",
    });

    await rendered.unmount();
    onRegionIsChanging({
      nativeEvent: {
        center: [-122.3, 47.6],
        zoom: 12,
        bearing: 0,
        pitch: 0,
        userInteraction: true,
      },
    });
    onRegionDidChange({
      nativeEvent: {
        center: [-122.3, 47.6],
        zoom: 12,
        bearing: 0,
        pitch: 0,
        userInteraction: false,
      },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
  });

  test("rerender keeps the wrapper map id and a new mount replaces it", async () => {
    const first = await render(example());
    const firstId = first.getByTestId("wrapper-map").props.mapId;

    await first.rerender(example());

    expect(first.getByTestId("wrapper-map").props.mapId).toBe(firstId);

    await first.unmount();
    const second = await render(example());

    expect(second.getByTestId("wrapper-map").props.mapId).not.toBe(firstId);
  });

  test("reuseMaps is rejected before a map is created", async () => {
    MapMock.mockClear();

    await expect(
      render(example(undefined, undefined, { reuseMaps: true }))
    ).rejects.toThrow(
      "reuseMaps is not available on native maps. Remounting creates a new map."
    );
    expect(MapMock).not.toHaveBeenCalled();
  });

  test("gl is rejected before a map is created", async () => {
    MapMock.mockClear();

    await expect(
      render(example(undefined, undefined, { gl: drawingContext() }))
    ).rejects.toThrow(
      "gl is a web drawing context and is not available on native maps."
    );
    expect(MapMock).not.toHaveBeenCalled();
  });

  test("resize() is rejected", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(ref.current?.resize()).rejects.toThrow(
      "resize() is not available on native maps. Size follows the host style."
    );
  });

  test("load, style, and error callbacks map to the wrapper and stop after unmount", async () => {
    const onLoad = jest.fn();
    const onStyleLoad = jest.fn();
    const onError = jest.fn();
    const rendered = await render(
      example(undefined, undefined, { onLoad, onStyleLoad, onError })
    );
    const props = lastMapProps<{
      onDidFinishLoadingMap: () => void;
      onDidFinishLoadingStyle: () => void;
      onDidFailLoadingMap: () => void;
    }>();

    props.onDidFinishLoadingMap();
    props.onDidFinishLoadingStyle();
    props.onDidFailLoadingMap();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({});

    await rendered.unmount();
    props.onDidFinishLoadingMap();
    props.onDidFinishLoadingStyle();
    props.onDidFailLoadingMap();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("a style update is passed to the wrapper", async () => {
    const rendered = await render(example());

    await rendered.rerender(
      example(undefined, undefined, {
        mapStyle: "https://example.com/style.json",
      })
    );

    expect(lastMapProps<{ readonly mapStyle?: string }>().mapStyle).toBe(
      "https://example.com/style.json"
    );
  });

  test("commands wait for style load and convert an antimeridian fit", async () => {
    mockJumpTo.mockClear();
    mockFitBounds.mockClear();
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(ref.current?.jumpTo({ zoom: 8 })).rejects.toThrow(
      "Map camera is not attached."
    );
    expect(mockJumpTo).not.toHaveBeenCalled();

    finishMapLoad();
    await ref.current?.jumpTo({ zoom: 8 });
    await ref.current?.fitBounds(
      [
        [170, -10],
        [-170, 10],
      ],
      { duration: 300 }
    );

    expect(mockJumpTo).toHaveBeenCalledWith({ zoom: 8 });
    expect(mockFitBounds).toHaveBeenCalledWith([170, -10, -170, 10], {
      duration: 300,
    });
  });

  test("an easing function and stop() are rejected after style load", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    finishMapLoad();

    await expect(
      ref.current?.flyTo({
        center: [-122.34, 47.61],
        easing: () => 0,
      })
    ).rejects.toThrow("An easing function is not available on native maps.");
    await expect(ref.current?.stop()).rejects.toThrow(
      "stop() is not available on native maps."
    );
  });

  test("getters convert flat bounds and reject padding", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(ref.current?.getBearing()).resolves.toBe(4);
    await expect(ref.current?.getBounds()).resolves.toEqual([
      [170, -10],
      [-170, 10],
    ]);
    await expect(ref.current?.project([-122.34, 47.61])).resolves.toEqual([
      12, 34,
    ]);
    await expect(ref.current?.getPadding()).rejects.toThrow(
      "getPadding() is not available on maplibre-native."
    );
  });

  test("touchZoom false still passes an explicit double tap", async () => {
    await render(
      example(undefined, undefined, {
        touchZoom: false,
        doubleTapZoom: true,
      })
    );

    expect(lastMapProps<object>()).toEqual(
      expect.objectContaining({
        touchZoom: false,
        doubleTapZoom: true,
        doubleTapHoldZoom: true,
      })
    );
  });

  test("hash is rejected before a map is created", async () => {
    MapMock.mockClear();

    await expect(
      render(example(undefined, undefined, { hash: true }))
    ).rejects.toThrow("hash is not available on native maps.");
    expect(MapMock).not.toHaveBeenCalled();
  });

  test("controlled viewState is written onto the camera", async () => {
    const rendered = await render(
      example(undefined, undefined, {
        viewState: { ...initialViewState, zoom: 12 },
      })
    );

    expect(rendered.getByTestId("wrapper-camera").props).toEqual(
      expect.objectContaining({
        center: [-122.34, 47.61],
        zoom: 12,
        bearing: 0,
        pitch: 0,
      })
    );
  });

  test("the first settled region reports onMove and onMoveEnd", async () => {
    const onMove = jest.fn();
    const onMoveEnd = jest.fn();

    await render(example(undefined, onMove, { onMoveEnd }));
    const props = lastMapProps<{
      onRegionDidChange: (event: object) => void;
    }>();

    props.onRegionDidChange({
      nativeEvent: {
        center: [-122.34, 47.61],
        zoom: 11,
        bearing: 0,
        pitch: 0,
        userInteraction: false,
      },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMoveEnd).toHaveBeenCalledTimes(1);
  });

  test("onClick converts the press and stops after unmount", async () => {
    const onClick = jest.fn();
    const rendered = await render(example(undefined, undefined, { onClick }));
    const props = lastMapProps<{
      onPress: (event: object) => void;
    }>();

    props.onPress({
      nativeEvent: {
        lngLat: [-122.34, 47.61],
        point: [8, 9],
        features: [{ id: "pier" }],
      },
    });

    expect(onClick).toHaveBeenCalledWith({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
      features: [{ id: "pier" }],
    });

    await rendered.unmount();
    props.onPress({
      nativeEvent: {
        lngLat: [-122, 47],
        point: [1, 2],
      },
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
