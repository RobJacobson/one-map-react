import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { createRef, type ReactNode, type Ref } from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { LayerProps, LayerType } from "../src/contracts/layer-types.js";
import type {
  ExternalDrawingContext,
  MapProps,
} from "../src/contracts/map-types.js";
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { Map as OneMap } from "../src/facade/map.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Source } from "../src/facade/source.js";

const mockSetCamera = jest.fn();
const mockGetCenter = jest.fn(async () => [-122.34, 47.61]);
const mockGetZoom = jest.fn(async () => 11);
const mockGetVisibleBounds = jest.fn(async () => [
  [-122.2, 47.7],
  [-122.4, 47.5],
]);
const mockGetPointInView = jest.fn(async () => [12, 34]);
const mockGetCoordinateFromView = jest.fn(async () => [-122.34, 47.61]);

jest.mock("@rnmapbox/maps", () => {
  const React = require("react");
  let mapSerial = 0;

  const sourceComponent = (name: string) =>
    jest.fn(
      ({
        id,
        children,
        ...props
      }: {
        id: string;
        children?: React.ReactNode;
        [key: string]: unknown;
      }) =>
        React.createElement(
          name,
          { id, ...props },
          React.Children.map(children, (child: React.ReactNode) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement, {
                  sourceID: id,
                })
              : child
          )
        )
    );

  const layerComponent = (name: string) =>
    jest.fn((props: object) => React.createElement(name, props));

  return {
    MapView: jest.fn(
      ({
        children,
        ref,
        ...props
      }: {
        children?: React.ReactNode;
        ref?: React.Ref<{
          getCenter: typeof mockGetCenter;
        }>;
        [key: string]: unknown;
      }) => {
        const [mapId] = React.useState(() => {
          mapSerial += 1;
          return String(mapSerial);
        });

        React.useImperativeHandle(ref, () => ({
          getCenter: mockGetCenter,
          getZoom: mockGetZoom,
          getVisibleBounds: mockGetVisibleBounds,
          getPointInView: mockGetPointInView,
          getCoordinateFromView: mockGetCoordinateFromView,
        }));

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

        return React.createElement("Camera", {
          ...props,
          testID: "wrapper-camera",
        });
      }
    ),
    ShapeSource: sourceComponent("ShapeSource"),
    VectorSource: sourceComponent("VectorSource"),
    RasterSource: sourceComponent("RasterSource"),
    RasterDemSource: sourceComponent("RasterDemSource"),
    ImageSource: sourceComponent("ImageSource"),
    BackgroundLayer: layerComponent("BackgroundLayer"),
    FillLayer: layerComponent("FillLayer"),
    LineLayer: layerComponent("LineLayer"),
    CircleLayer: layerComponent("CircleLayer"),
    SymbolLayer: layerComponent("SymbolLayer"),
    RasterLayer: layerComponent("RasterLayer"),
    HeatmapLayer: layerComponent("HeatmapLayer"),
    FillExtrusionLayer: layerComponent("FillExtrusionLayer"),
    Images: jest.fn(() => null),
    CameraGestureObserver: () => null,
  };
});

import {
  BackgroundLayer,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  ImageSource,
  LineLayer,
  MapView,
  RasterDemSource,
  RasterLayer,
  RasterSource,
  Images as RnmapboxImages,
  ShapeSource,
  SymbolLayer,
  VectorSource,
} from "@rnmapbox/maps";

import { adapter, MapboxGestureSettings } from "../src/mapbox-native.js";

const MapViewMock = MapView as unknown as jest.Mock;
const LineLayerMock = LineLayer as unknown as jest.Mock;
const ShapeSourceMock = ShapeSource as unknown as jest.Mock;
const VectorSourceMock = VectorSource as unknown as jest.Mock;
const RasterSourceMock = RasterSource as unknown as jest.Mock;
const RasterDemSourceMock = RasterDemSource as unknown as jest.Mock;
const ImageSourceMock = ImageSource as unknown as jest.Mock;
const ImagesMock = RnmapboxImages as unknown as jest.Mock;
const layerMocks: Record<string, jest.Mock> = {
  background: BackgroundLayer as unknown as jest.Mock,
  fill: FillLayer as unknown as jest.Mock,
  line: LineLayer as unknown as jest.Mock,
  circle: CircleLayer as unknown as jest.Mock,
  symbol: SymbolLayer as unknown as jest.Mock,
  raster: RasterLayer as unknown as jest.Mock,
  heatmap: HeatmapLayer as unknown as jest.Mock,
  "fill-extrusion": FillExtrusionLayer as unknown as jest.Mock,
};

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

    expect(onMove).toHaveBeenCalledTimes(1);

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

  test("jumpTo, easeTo, fitBounds, and zoomTo set explicit animation modes", async () => {
    mockSetCamera.mockClear();
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.jumpTo({ center: [-122.3, 47.6] });
    await ref.current?.easeTo({
      zoom: 12,
      duration: 400,
      padding: { top: 8 },
    });
    await ref.current?.fitBounds(
      [
        [170, -10],
        [-170, 10],
      ],
      { duration: 500 }
    );
    await ref.current?.zoomTo(9, { duration: 0 });

    expect(mockSetCamera).toHaveBeenNthCalledWith(1, {
      type: "CameraStop",
      centerCoordinate: [-122.3, 47.6],
      animationMode: "none",
    });
    expect(mockSetCamera).toHaveBeenNthCalledWith(2, {
      type: "CameraStop",
      zoomLevel: 12,
      animationDuration: 400,
      padding: {
        paddingTop: 8,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      },
      animationMode: "easeTo",
    });
    expect(mockSetCamera).toHaveBeenNthCalledWith(3, {
      type: "CameraStop",
      bounds: {
        sw: [170, -10],
        ne: [-170, 10],
      },
      animationDuration: 500,
      animationMode: "easeTo",
    });
    expect(mockSetCamera).toHaveBeenNthCalledWith(4, {
      type: "CameraStop",
      zoomLevel: 9,
      animationDuration: 0,
      animationMode: "none",
    });
  });

  test("an easing function and stop() are rejected", async () => {
    mockSetCamera.mockClear();
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.easeTo({ zoom: 4, easing: () => 1 })
    ).rejects.toThrow("An easing function is not available on native maps.");
    await expect(ref.current?.jumpTo({ duration: 20 })).rejects.toThrow(
      "jumpTo does not accept a duration."
    );
    await expect(ref.current?.stop()).rejects.toThrow(
      "stop() is not available on native maps."
    );
    expect(mockSetCamera).not.toHaveBeenCalled();
  });

  test("getters convert center, visible bounds, and points", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(ref.current?.getCenter()).resolves.toEqual([-122.34, 47.61]);
    await expect(ref.current?.getBounds()).resolves.toEqual([
      [-122.4, 47.5],
      [-122.2, 47.7],
    ]);
    await expect(ref.current?.project([-122.34, 47.61])).resolves.toEqual([
      12, 34,
    ]);
    await expect(ref.current?.unproject([12, 34])).resolves.toEqual([
      -122.34, 47.61,
    ]);
    await expect(ref.current?.getBearing()).rejects.toThrow(
      "getBearing() is not available on mapbox-native."
    );
  });

  test("scrollZoom is rejected before a map is created", async () => {
    MapViewMock.mockClear();

    await expect(
      render(example(undefined, undefined, { scrollZoom: false }))
    ).rejects.toThrow("scrollZoom is not available on native maps.");
    expect(MapViewMock).not.toHaveBeenCalled();
  });

  test("gesture flags map onto scroll, zoom, and double tap", async () => {
    await render(
      example(undefined, undefined, {
        dragPan: false,
        touchZoom: false,
        doubleTapZoom: true,
      })
    );

    expect(lastMapProps<object>()).toEqual(
      expect.objectContaining({
        scrollEnabled: false,
        zoomEnabled: false,
        gestureSettings: {
          doubleTapToZoomInEnabled: true,
          doubleTouchToZoomOutEnabled: true,
        },
      })
    );
  });

  test("controlled viewState is written onto the camera", async () => {
    const rendered = await render(
      example(undefined, undefined, {
        viewState: { ...initialViewState, zoom: 12 },
      })
    );

    expect(rendered.getByTestId("wrapper-camera").props).toEqual(
      expect.objectContaining({
        centerCoordinate: [-122.34, 47.61],
        zoomLevel: 12,
        heading: 0,
        pitch: 0,
        animationMode: "none",
        animationDuration: 0,
      })
    );

    await rendered.rerender(
      example(undefined, undefined, {
        viewState: { ...initialViewState, zoom: 13 },
      })
    );

    expect(rendered.getByTestId("wrapper-camera").props.zoomLevel).toBe(13);
    expect(
      rendered.getByTestId("wrapper-camera").props.defaultSettings.zoomLevel
    ).toBe(initialViewState.zoom);
  });

  test("the first idle reports onMove once, then onMoveEnd and onIdle", async () => {
    const onMove = jest.fn();
    const onMoveEnd = jest.fn();
    const onIdle = jest.fn();

    await render(example(undefined, onMove, { onMoveEnd, onIdle }));
    const props = lastMapProps<{
      onMapIdle: (state: object) => void;
    }>();

    props.onMapIdle({
      properties: {
        center: [-122.34, 47.61],
        zoom: 11,
        heading: 0,
        pitch: 0,
      },
      gestures: { isGestureActive: false },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMoveEnd).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("onClick converts the press feature and stops after unmount", async () => {
    const onClick = jest.fn();
    const rendered = await render(example(undefined, undefined, { onClick }));
    const props = lastMapProps<{
      onPress: (feature: object) => void;
    }>();

    props.onPress({
      geometry: { coordinates: [-122.34, 47.61] },
      properties: { screenPointX: 8, screenPointY: 9 },
    });

    expect(onClick).toHaveBeenCalledWith({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
    });

    await rendered.unmount();
    props.onPress({
      geometry: { coordinates: [-122, 47] },
      properties: { screenPointX: 1, screenPointY: 2 },
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("MapboxGestureSettings are passed to the map", async () => {
    await render(
      <MapboxGestureSettings
        settings={{ pinchZoomEnabled: false, quickZoomEnabled: true }}
      >
        {example(undefined, undefined, { doubleTapZoom: true })}
      </MapboxGestureSettings>
    );

    expect(lastMapProps<object>()).toEqual(
      expect.objectContaining({
        gestureSettings: {
          pinchZoomEnabled: false,
          quickZoomEnabled: true,
          doubleTapToZoomInEnabled: true,
          doubleTouchToZoomOutEnabled: true,
        },
      })
    );
  });
});

const tree = (children: ReactNode) => (
  <MapSetup adapter={adapter}>
    <OneMap
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={{ flex: 1 }}
    >
      {children}
    </OneMap>
  </MapSetup>
);

describe("mapbox-native source families", () => {
  test("a vector source forwards renamed fields", async () => {
    await render(
      tree(
        <Source
          id="tiles"
          type="vector"
          tiles={["https://example.com/{z}/{x}/{y}.pbf"]}
          minzoom={2}
          maxzoom={16}
          scheme="tms"
          attribution="Example"
        />
      )
    );

    expect(VectorSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tiles",
        tileUrlTemplates: ["https://example.com/{z}/{x}/{y}.pbf"],
        minZoomLevel: 2,
        maxZoomLevel: 16,
        tms: true,
        attribution: "Example",
      }),
      undefined
    );
  });

  test("a raster source keeps tileSize", async () => {
    await render(
      tree(
        <Source
          id="base"
          type="raster"
          url="https://example.com/raster.json"
          tileSize={512}
        />
      )
    );

    expect(RasterSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "base",
        url: "https://example.com/raster.json",
        tileSize: 512,
      }),
      undefined
    );
  });

  test("a raster-dem source rejects attribution and scheme", async () => {
    await expect(
      render(
        tree(
          <Source
            id="terrain"
            type="raster-dem"
            url="https://example.com/terrain.json"
            attribution="Example"
          />
        )
      )
    ).rejects.toThrow("attribution is not available on mapbox-native.");
    await expect(
      render(
        tree(
          <Source
            id="terrain"
            type="raster-dem"
            url="https://example.com/terrain.json"
            scheme="tms"
          />
        )
      )
    ).rejects.toThrow("scheme is not available on mapbox-native.");
  });

  test("a raster-dem source drops facade-only fields", async () => {
    await render(
      tree(
        <Source
          id="terrain"
          type="raster-dem"
          url="https://example.com/terrain.json"
          maxzoom={14}
        />
      )
    );

    expect(RasterDemSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "terrain",
        url: "https://example.com/terrain.json",
        maxZoomLevel: 14,
      }),
      undefined
    );
  });

  test("an image source forwards four corners", async () => {
    await render(
      tree(
        <Source
          id="overlay"
          type="image"
          url="https://example.com/overlay.png"
          coordinates={[
            [-122.5, 47.8],
            [-122.1, 47.8],
            [-122.1, 47.4],
            [-122.5, 47.4],
          ]}
        />
      )
    );

    expect(ImageSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "overlay",
        url: "https://example.com/overlay.png",
        coordinates: [
          [-122.5, 47.8],
          [-122.1, 47.8],
          [-122.1, 47.4],
          [-122.5, 47.4],
        ],
      }),
      undefined
    );
  });

  test("updated image url and coordinates reach the wrapper", async () => {
    const rendered = await render(
      tree(
        <Source
          id="overlay"
          type="image"
          url="https://example.com/overlay.png"
          coordinates={[
            [-122.5, 47.8],
            [-122.1, 47.8],
            [-122.1, 47.4],
            [-122.5, 47.4],
          ]}
        />
      )
    );

    await rendered.rerender(
      tree(
        <Source
          id="overlay"
          type="image"
          url="https://example.com/overlay-b.png"
          coordinates={[
            [-122.4, 47.7],
            [-122.2, 47.7],
            [-122.2, 47.5],
            [-122.4, 47.5],
          ]}
        />
      )
    );

    expect(ImageSourceMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: "overlay",
        url: "https://example.com/overlay-b.png",
        coordinates: [
          [-122.4, 47.7],
          [-122.2, 47.7],
          [-122.2, 47.5],
          [-122.4, 47.5],
        ],
      })
    );
  });

  test("geojson cluster options use wrapper names", async () => {
    await render(
      tree(
        <Source
          id="points"
          type="geojson"
          data={routes}
          cluster
          clusterRadius={50}
          clusterMaxZoom={12}
          maxzoom={14}
        />
      )
    );

    expect(ShapeSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "points",
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoomLevel: 12,
        maxZoomLevel: 14,
      }),
      undefined
    );
  });

  test("clusterMinPoints, generateId, and promoteId are rejected", async () => {
    await expect(
      render(
        tree(
          <Source
            id="points"
            type="geojson"
            data={routes}
            clusterMinPoints={3}
          />
        )
      )
    ).rejects.toThrow("clusterMinPoints is not available on mapbox-native.");
    await expect(
      render(tree(<Source id="a" type="geojson" data={routes} generateId />))
    ).rejects.toThrow("generateId is not available on mapbox-native.");
    await expect(
      render(
        tree(<Source id="b" type="geojson" data={routes} promoteId="route" />)
      )
    ).rejects.toThrow("promoteId is not available on mapbox-native.");
  });

  test("updated geojson data reaches the wrapper", async () => {
    const updated = {
      type: "FeatureCollection" as const,
      features: [],
    };
    const rendered = await render(
      tree(<Source id="routes" type="geojson" data={routes} />)
    );

    await rendered.rerender(
      tree(<Source id="routes" type="geojson" data={updated} />)
    );

    expect(ShapeSourceMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ id: "routes", shape: updated })
    );
  });

  test("geojson url data becomes the wrapper url prop", async () => {
    await render(
      tree(
        <Source
          id="remote"
          type="geojson"
          data="https://example.com/d.geojson"
        />
      )
    );

    expect(ShapeSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "remote",
        url: "https://example.com/d.geojson",
      }),
      undefined
    );
  });

  test("an xyz scheme becomes tms false", async () => {
    await render(
      tree(
        <Source
          id="tiles"
          type="vector"
          url="https://example.com/tiles.json"
          scheme="xyz"
        />
      )
    );

    expect(VectorSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tiles", tms: false }),
      undefined
    );
  });

  test("a raster-dem source rejects encoding", async () => {
    await expect(
      render(
        tree(
          <Source
            id="terrain"
            type="raster-dem"
            url="https://example.com/terrain.json"
            encoding="terrarium"
          />
        )
      )
    ).rejects.toThrow("encoding is not available on mapbox-native.");
  });

  test("tiles are copied into a mutable wrapper array", async () => {
    const tiles = ["https://example.com/{z}/{x}/{y}.pbf"] as const;

    await render(tree(<Source id="tiles" type="vector" tiles={tiles} />));

    const forwarded = VectorSourceMock.mock.calls.at(-1)?.[0] as {
      tileUrlTemplates: string[];
    };

    expect(forwarded.tileUrlTemplates).toEqual([
      "https://example.com/{z}/{x}/{y}.pbf",
    ]);
    expect(forwarded.tileUrlTemplates).not.toBe(tiles);
  });

  test("changing a creation option throws and asks for a remount", async () => {
    const rendered = await render(
      tree(<Source id="points" type="geojson" data={routes} cluster={false} />)
    );

    await expect(async () =>
      rendered.rerender(
        tree(<Source id="points" type="geojson" data={routes} cluster />)
      )
    ).rejects.toThrow(
      'Source "points" changed the creation option "cluster". Remount it with a new React key to recreate the resource.'
    );
  });
});

describe("mapbox-native layers", () => {
  const layerCases: ReadonlyArray<
    readonly [LayerType, Record<string, unknown>, string]
  > = [
    ["background", { "background-color": "#ffffff" }, "backgroundColor"],
    ["fill", { "fill-color": "#111111" }, "fillColor"],
    ["line", { "line-color": "#222222" }, "lineColor"],
    ["circle", { "circle-radius": 4 }, "circleRadius"],
    ["raster", { "raster-opacity": 0.5 }, "rasterOpacity"],
    ["heatmap", { "heatmap-radius": 8 }, "heatmapRadius"],
    ["fill-extrusion", { "fill-extrusion-height": 10 }, "fillExtrusionHeight"],
  ];

  test.each(layerCases)(
    "a %s layer dispatches with a camelCase style",
    async (type, paint, styleKey) => {
      const mock = layerMocks[type];

      mock.mockClear();
      // The table drives one Layer per row; the union narrows per render.
      const layerProps = {
        id: `l-${type}`,
        type,
        paint,
      } as unknown as LayerProps;

      await render(
        tree(
          <Source id="routes" type="geojson" data={routes}>
            <Layer {...layerProps} />
          </Source>
        )
      );

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `l-${type}`,
          sourceID: "routes",
          style: { [styleKey]: Object.values(paint)[0] },
        }),
        undefined
      );
    }
  );

  test("a symbol layer converts layout and paint together", async () => {
    const symbolMock = layerMocks.symbol;

    symbolMock.mockClear();
    await render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="labels"
            type="symbol"
            layout={{ "text-field": ["get", "name"], "text-size": 12 }}
            paint={{ "text-color": "#333333" }}
          />
        </Source>
      )
    );

    expect(symbolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "labels",
        sourceID: "routes",
        style: {
          textField: ["get", "name"],
          textSize: 12,
          textColor: "#333333",
        },
      }),
      undefined
    );
  });

  test("layer fields are renamed and a filter passes through", async () => {
    VectorSourceMock.mockClear();
    LineLayerMock.mockClear();
    await render(
      tree(
        <Source id="tiles" type="vector" url="https://example.com/t.json">
          <Layer
            id="roads"
            type="line"
            source-layer="road"
            filter={["==", ["get", "class"], "street"]}
            minzoom={5}
            maxzoom={18}
            beforeId="labels"
            paint={{ "line-width": 2 }}
          />
        </Source>
      )
    );

    expect(LineLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "roads",
        sourceID: "tiles",
        sourceLayerID: "road",
        filter: ["==", ["get", "class"], "street"],
        minZoomLevel: 5,
        maxZoomLevel: 18,
        belowLayerID: "labels",
        style: { lineWidth: 2 },
      }),
      undefined
    );
  });

  test("a removed paint key leaves the style prop", async () => {
    LineLayerMock.mockClear();
    const rendered = await render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#2563eb", "line-width": 3 }}
          />
        </Source>
      )
    );

    await rendered.rerender(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#2563eb" }}
          />
        </Source>
      )
    );

    expect(LineLayerMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ style: { lineColor: "#2563eb" } })
    );
  });

  test("expressions pass through and unset keys stay omitted", async () => {
    LineLayerMock.mockClear();
    const expression = ["interpolate", ["linear"], ["zoom"], 5, 1, 10, 4];

    await render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-width": expression }}
            layout={{ visibility: "visible" }}
          />
        </Source>
      )
    );

    expect(LineLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        style: { lineWidth: expression, visibility: "visible" },
      }),
      undefined
    );
  });

  test("a layer without paint or layout passes an empty style", async () => {
    layerMocks.background.mockClear();

    await render(tree(<Layer id="plain" type="background" />));

    expect(layerMocks.background).toHaveBeenCalledWith(
      expect.objectContaining({ id: "plain", style: {} }),
      undefined
    );
  });

  test("a gated symbol layout key is rejected", async () => {
    await expect(
      render(
        tree(
          <Source id="routes" type="geojson" data={routes}>
            <Layer
              id="gated"
              type="symbol"
              layout={{ "icon-overlap": "always" }}
            />
          </Source>
        )
      )
    ).rejects.toThrow("icon-overlap is not available on mapbox-native.");
  });

  test("a later gated symbol layout key is rejected after a valid mount", async () => {
    const rendered = await render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="labels"
            type="symbol"
            layout={{ "text-field": ["get", "name"] }}
          />
        </Source>
      )
    );

    await expect(async () =>
      rendered.rerender(
        tree(
          <Source id="routes" type="geojson" data={routes}>
            <Layer
              id="labels"
              type="symbol"
              layout={{
                "text-field": ["get", "name"],
                "icon-overlap": "always",
              }}
            />
          </Source>
        )
      )
    ).rejects.toThrow("icon-overlap is not available on mapbox-native.");
  });

  test("changing the layer type throws and asks for a remount", async () => {
    const rendered = await render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer id="route-line" type="line" />
        </Source>
      )
    );

    await expect(async () =>
      rendered.rerender(
        tree(
          <Source id="routes" type="geojson" data={routes}>
            <Layer id="route-line" type="circle" />
          </Source>
        )
      )
    ).rejects.toThrow(
      'Layer "route-line" changed the creation option "type". Remount it with a new React key to recreate the resource.'
    );
  });

  test("changing the injected sourceID throws and asks for a remount", async () => {
    const rendered = await render(
      tree(<Layer id="route-line" type="line" sourceID="routes" />)
    );

    await expect(async () =>
      rendered.rerender(
        tree(<Layer id="route-line" type="line" sourceID="other" />)
      )
    ).rejects.toThrow(
      'Layer "route-line" changed the creation option "sourceID".'
    );
  });
});

describe("mapbox-native images", () => {
  test("entries are forwarded to the wrapper Images", async () => {
    ImagesMock.mockClear();
    await render(
      tree(
        <Images
          images={{
            marker: "https://example.com/marker.png",
            shield: { url: "https://example.com/shield.png", sdf: true },
          }}
        />
      )
    );

    expect(ImagesMock).toHaveBeenCalledWith(
      {
        images: {
          marker: "https://example.com/marker.png",
          shield: { url: "https://example.com/shield.png", sdf: true },
        },
      },
      undefined
    );
  });

  test("images outside a map are rejected", async () => {
    await expect(
      render(
        <MapSetup adapter={adapter}>
          <Images images={{ marker: "https://example.com/m.png" }} />
        </MapSetup>
      )
    ).rejects.toThrow("Images must render inside Map.");
  });
});
