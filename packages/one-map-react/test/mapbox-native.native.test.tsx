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

const mockSetCamera = jest.fn();

jest.mock("@rnmapbox/maps", () => {
  const React = require("react");
  let mapSerial = 0;

  return {
    MapView: jest.fn(
      ({
        children,
        ...props
      }: {
        children?: React.ReactNode;
        [key: string]: unknown;
      }) => {
        const [mapId] = React.useState(() => {
          mapSerial += 1;
          return String(mapSerial);
        });

        return React.createElement(
          "MapView",
          { ...props, testID: "wrapper-map", mapId },
          children
        );
      }
    ),
    Camera: React.forwardRef(
      (props: object, ref: React.Ref<{ setCamera: typeof mockSetCamera }>) => {
        React.useImperativeHandle(ref, () => ({
          setCamera: mockSetCamera,
        }));

        return React.createElement("Camera", props);
      }
    ),
    ShapeSource: ({
      id,
      shape,
      children,
    }: {
      id: string;
      shape: object;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        "ShapeSource",
        { id, shape },
        React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement, { sourceID: id })
            : child
        )
      ),
    LineLayer: jest.fn((props: object) =>
      React.createElement("LineLayer", props)
    ),
  };
});

import { LineLayer, MapView } from "@rnmapbox/maps";

import { adapter } from "../src/mapbox-native.js";

const MapViewMock = MapView as unknown as jest.Mock;
const LineLayerMock = LineLayer as unknown as jest.Mock;

const lastMapProps = <Props,>(): Props => {
  const lastCall = MapViewMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("MapView was not rendered");
  }

  return lastCall[0] as Props;
};

const drawingContext = (): ExternalDrawingContext => ({
  canvas: {},
  drawingBufferWidth: 1,
  drawingBufferHeight: 1,
});

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

describe("mapbox-native adapter", () => {
  test("nested ShapeSource injects sourceID onto the line layer", async () => {
    await render(example());

    expect(LineLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "route-line",
        sourceID: "routes",
        style: {
          lineColor: "#2563eb",
          lineWidth: 3,
          lineCap: "round",
        },
      }),
      undefined
    );
  });

  test("flyTo calls setCamera with animationMode flyTo", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.flyTo({
      center: [-122.34, 47.61],
      duration: 1000,
    });

    expect(mockSetCamera).toHaveBeenCalledWith({
      type: "CameraStop",
      centerCoordinate: [-122.34, 47.61],
      animationDuration: 1000,
      animationMode: "flyTo",
    });
  });

  test("onMove receives converted camera fields and stops after unmount", async () => {
    const onMove = jest.fn();
    const rendered = await render(example(undefined, onMove));
    const lastCall = MapViewMock.mock.calls.at(-1);

    if (!lastCall) {
      throw new Error("MapView was not rendered");
    }

    const onCameraChanged = (
      lastCall[0] as { onCameraChanged: (state: object) => void }
    ).onCameraChanged;

    onCameraChanged({
      properties: {
        center: [-122.34, 47.61],
        zoom: 11,
        heading: 4,
        pitch: 1,
      },
      gestures: { isGestureActive: true },
    });

    expect(onMove).toHaveBeenCalledWith({
      viewState: {
        longitude: -122.34,
        latitude: 47.61,
        zoom: 11,
        bearing: 4,
        pitch: 1,
      },
      origin: "user",
    });

    const onMapIdle = (lastCall[0] as { onMapIdle: (state: object) => void })
      .onMapIdle;

    onMapIdle({
      properties: {
        center: [-122.32, 47.64],
        zoom: 11,
        heading: 0,
        pitch: 0,
      },
      gestures: { isGestureActive: false },
    });

    expect(onMove).toHaveBeenCalledTimes(2);

    await rendered.unmount();
    onCameraChanged({
      properties: {
        center: [-122.3, 47.6],
        zoom: 12,
        heading: 0,
        pitch: 0,
      },
      gestures: { isGestureActive: true },
    });

    onMapIdle({
      properties: {
        center: [-122.3, 47.6],
        zoom: 12,
        heading: 0,
        pitch: 0,
      },
      gestures: { isGestureActive: false },
    });

    expect(onMove).toHaveBeenCalledTimes(2);
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
    MapViewMock.mockClear();

    await expect(
      render(example(undefined, undefined, { reuseMaps: true }))
    ).rejects.toThrow(
      "reuseMaps is not available on native maps. Remounting creates a new map."
    );
    expect(MapViewMock).not.toHaveBeenCalled();
  });

  test("gl is rejected before a map is created", async () => {
    MapViewMock.mockClear();

    await expect(
      render(example(undefined, undefined, { gl: drawingContext() }))
    ).rejects.toThrow(
      "gl is a web drawing context and is not available on native maps."
    );
    expect(MapViewMock).not.toHaveBeenCalled();
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
      onMapLoadingError: (payload?: unknown) => void;
    }>();

    props.onDidFinishLoadingMap();
    props.onDidFinishLoadingStyle();
    props.onMapLoadingError();
    // iOS includes tileId and sourceId. Android never calls this prop.
    props.onMapLoadingError({
      error: "tile failed",
      tileId: "x:1 y:2 z:3",
      sourceId: "streets",
    });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenNthCalledWith(1, {});
    expect(onError).toHaveBeenNthCalledWith(2, { error: "tile failed" });

    await rendered.unmount();
    props.onDidFinishLoadingMap();
    props.onDidFinishLoadingStyle();
    props.onMapLoadingError({ error: "later" });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  test("a style update is passed to the wrapper", async () => {
    const rendered = await render(example());

    await rendered.rerender(
      example(undefined, undefined, {
        mapStyle: "https://example.com/style.json",
      })
    );

    expect(lastMapProps<{ readonly styleURL?: string }>().styleURL).toBe(
      "https://example.com/style.json"
    );
  });
});
