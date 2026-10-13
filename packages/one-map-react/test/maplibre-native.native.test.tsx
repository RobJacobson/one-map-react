import { describe, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { createRef, type ReactNode, type Ref } from "react";

import {
  emptyStyle,
  initialViewState,
  replacementStyle,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { LayerProps, LayerType } from "../src/contracts/layer-types.js";
import type {
  ExternalDrawingContext,
  MapProps,
} from "../src/contracts/map-types.js";
import type { FeatureState } from "../src/contracts/query-types.js";
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { Map as OneMap } from "../src/facade/map.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Source } from "../src/facade/source.js";

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
const queryFeatures = [
  { type: "Feature", id: 1, properties: { kind: "route" } },
  { type: "Feature", id: 1, properties: { kind: "route" } },
];
const mockQueryRenderedFeatures = jest.fn(async () => queryFeatures);
const mockQuerySourceFeatures = jest.fn(async () => queryFeatures.slice(0, 1));
interface NativeStateFeature {
  readonly id: string | number;
  readonly sourceLayer?: string;
}

const mockGeoJsonSetFeatureState = jest.fn(
  async (
    _feature: NativeStateFeature,
    _state: Record<string, unknown>
  ): Promise<void> => undefined
);
const mockGeoJsonGetFeatureState = jest.fn(
  async (_feature: NativeStateFeature): Promise<FeatureState | null> => ({
    selected: true,
  })
);
const mockGeoJsonRemoveFeatureState = jest.fn(
  async (_feature: NativeStateFeature, _key?: string) => undefined
);
const mockVectorSetFeatureState = jest.fn(
  async (
    _feature: NativeStateFeature,
    _state: Record<string, unknown>
  ): Promise<void> => undefined
);
const mockVectorGetFeatureState = jest.fn(
  async (_feature: NativeStateFeature): Promise<FeatureState | null> => null
);
const mockVectorRemoveFeatureState = jest.fn(
  async (_feature: NativeStateFeature, _key?: string) => undefined
);
const mockGeoJsonHandleData = jest.fn((_data: unknown) => undefined);
const mockGetClusterExpansionZoom = jest.fn(async () => 13);
const mockGetClusterLeaves = jest.fn(async () => queryFeatures);
const mockGetClusterChildren = jest.fn(async () => queryFeatures.slice(0, 1));
const mockGetData = jest.fn(async (_filter?: unknown) =>
  queryFeatures.slice(0, 1)
);

jest.mock("@maplibre/maplibre-react-native", () => {
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
              ? React.cloneElement(child as React.ReactElement, { source: id })
              : child
          )
        )
    );

  const withSource = (
    name: string,
    id: string,
    props: Record<string, unknown>,
    children?: React.ReactNode
  ) =>
    React.createElement(
      name,
      { id, ...props },
      React.Children.map(children, (child: React.ReactNode) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement, { source: id })
          : child
      )
    );

  // GeoJSON and vector sources carry cluster, state, and source-query
  // methods on their refs, so they attach the caller's ref.
  const geoJsonSourceComponent = jest.fn(
    ({
      id,
      children,
      ref,
      ...props
    }: {
      id: string;
      children?: React.ReactNode;
      ref?: React.Ref<Record<string, unknown>>;
      [key: string]: unknown;
    }) => {
      React.useImperativeHandle(ref, () => ({
        setFeatureState: mockGeoJsonSetFeatureState,
        getFeatureState: mockGeoJsonGetFeatureState,
        removeFeatureState: mockGeoJsonRemoveFeatureState,
        getClusterExpansionZoom: mockGetClusterExpansionZoom,
        getClusterLeaves: mockGetClusterLeaves,
        getClusterChildren: mockGetClusterChildren,
        getData: (filter: unknown) => {
          mockGeoJsonHandleData(props.data);
          return mockGetData(filter);
        },
      }));

      return withSource("GeoJSONSource", id, props, children);
    }
  );

  const vectorSourceComponent = jest.fn(
    ({
      id,
      children,
      ref,
      ...props
    }: {
      id: string;
      children?: React.ReactNode;
      ref?: React.Ref<Record<string, unknown>>;
      [key: string]: unknown;
    }) => {
      React.useImperativeHandle(ref, () => ({
        setFeatureState: mockVectorSetFeatureState,
        getFeatureState: mockVectorGetFeatureState,
        removeFeatureState: mockVectorRemoveFeatureState,
        querySourceFeatures: mockQuerySourceFeatures,
      }));

      return withSource("VectorSource", id, props, children);
    }
  );

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
          queryRenderedFeatures: mockQueryRenderedFeatures,
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
    GeoJSONSource: geoJsonSourceComponent,
    VectorSource: vectorSourceComponent,
    RasterSource: sourceComponent("RasterSource"),
    RasterDEMSource: sourceComponent("RasterDEMSource"),
    ImageSource: sourceComponent("ImageSource"),
    Images: jest.fn(() => null),
    Layer: jest.fn((props: object) => React.createElement("Layer", props)),
  };
});

import {
  GeoJSONSource,
  ImageSource,
  Images as MaplibreImages,
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  RasterDEMSource,
  RasterSource,
  VectorSource,
} from "@maplibre/maplibre-react-native";

import { adapter } from "../src/maplibre-native.js";

const MapMock = MaplibreMap as unknown as jest.Mock;
const LayerMock = MaplibreLayer as unknown as jest.Mock;
const GeoJSONSourceMock = GeoJSONSource as unknown as jest.Mock;
const VectorSourceMock = VectorSource as unknown as jest.Mock;
const RasterSourceMock = RasterSource as unknown as jest.Mock;
const RasterDEMSourceMock = RasterDEMSource as unknown as jest.Mock;
const ImageSourceMock = ImageSource as unknown as jest.Mock;
const ImagesMock = MaplibreImages as unknown as jest.Mock;

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

const finishRenderingFrame = async (): Promise<void> => {
  const props = lastMapProps<{ onDidFinishRenderingFrameFully: () => void }>();
  await act(async () => props.onDidFinishRenderingFrameFully());
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

const vectorTree = (ref?: Ref<MapRef>) => (
  <MapSetup adapter={adapter}>
    <OneMap
      ref={ref}
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={{ flex: 1 }}
    >
      <Source id="tiles" type="vector" url="maplibre://tiles">
        <Layer id="tile-line" type="line" source-layer="way" />
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

describe("maplibre-native source families", () => {
  test("geojson cluster options forward under style-spec names", async () => {
    GeoJSONSourceMock.mockClear();
    await render(
      tree(
        <Source
          id="points"
          type="geojson"
          data={routes}
          cluster
          clusterRadius={50}
          clusterMinPoints={3}
          clusterMaxZoom={12}
          maxzoom={14}
          lineMetrics
        />
      )
    );

    expect(GeoJSONSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "points",
        cluster: true,
        clusterRadius: 50,
        clusterMinPoints: 3,
        clusterMaxZoom: 12,
        maxzoom: 14,
        lineMetrics: true,
      }),
      undefined
    );
  });

  test("generateId and promoteId are rejected", async () => {
    await expect(
      render(tree(<Source id="a" type="geojson" data={routes} generateId />))
    ).rejects.toThrow("generateId is not available on maplibre-native.");
    await expect(
      render(
        tree(<Source id="b" type="geojson" data={routes} promoteId="route" />)
      )
    ).rejects.toThrow("promoteId is not available on maplibre-native.");
  });

  test("a vector source forwards spec fields", async () => {
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
        tiles: ["https://example.com/{z}/{x}/{y}.pbf"],
        minzoom: 2,
        maxzoom: 16,
        scheme: "tms",
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

  test("a raster-dem source forwards encoding and attribution", async () => {
    await render(
      tree(
        <Source
          id="terrain"
          type="raster-dem"
          url="https://example.com/terrain.json"
          encoding="terrarium"
          attribution="Example"
        />
      )
    );

    expect(RasterDEMSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "terrain",
        url: "https://example.com/terrain.json",
        encoding: "terrarium",
        attribution: "Example",
      }),
      undefined
    );
  });

  test("a raster-dem source rejects scheme", async () => {
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
    ).rejects.toThrow("scheme is not available on maplibre-native.");
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

    expect(GeoJSONSourceMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ id: "routes", data: updated })
    );
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

describe("maplibre-native layers", () => {
  const layerCases: ReadonlyArray<
    readonly [LayerType, Record<string, unknown>]
  > = [
    ["background", { "background-color": "#ffffff" }],
    ["fill", { "fill-color": "#111111" }],
    ["line", { "line-color": "#222222" }],
    ["circle", { "circle-radius": 4 }],
    ["symbol", { "text-color": "#333333" }],
    ["raster", { "raster-opacity": 0.5 }],
    ["heatmap", { "heatmap-radius": 8 }],
    ["fill-extrusion", { "fill-extrusion-height": 10 }],
  ];

  test.each(layerCases)(
    "a %s layer forwards type and paint",
    async (type, paint) => {
      LayerMock.mockClear();
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

      expect(LayerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `l-${type}`,
          type,
          paint,
        }),
        undefined
      );
    }
  );

  test("the generic layer receives spec paint, layout, and fields", async () => {
    LayerMock.mockClear();
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
            layout={{ "line-cap": "round" }}
          />
        </Source>
      )
    );

    expect(LayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "roads",
        type: "line",
        source: "tiles",
        "source-layer": "road",
        filter: ["==", ["get", "class"], "street"],
        minzoom: 5,
        maxzoom: 18,
        beforeId: "labels",
        paint: { "line-width": 2 },
        layout: { "line-cap": "round" },
      }),
      undefined
    );
  });

  test("a removed paint key leaves the paint prop", async () => {
    LayerMock.mockClear();
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

    expect(LayerMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ paint: { "line-color": "#2563eb" } })
    );
  });

  test("a removed filter is passed as undefined", async () => {
    LayerMock.mockClear();
    const rendered = await render(
      tree(
        <Source id="tiles" type="vector" url="https://example.com/t.json">
          <Layer
            id="roads"
            type="line"
            source-layer="road"
            filter={["==", ["get", "class"], "street"]}
          />
        </Source>
      )
    );

    await rendered.rerender(
      tree(
        <Source id="tiles" type="vector" url="https://example.com/t.json">
          <Layer id="roads" type="line" source-layer="road" />
        </Source>
      )
    );

    const props = LayerMock.mock.calls.at(-1)?.[0] as { filter?: unknown };

    expect(Object.hasOwn(props, "filter")).toBe(true);
    expect(props.filter).toBeUndefined();
  });

  test("a gated symbol layout key is rejected", async () => {
    await expect(
      render(
        tree(
          <Source id="routes" type="geojson" data={routes}>
            <Layer
              id="gated"
              type="symbol"
              layout={{ "text-overlap": "always" }}
            />
          </Source>
        )
      )
    ).rejects.toThrow("text-overlap is not available on maplibre-native.");
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
                "text-overlap": "always",
              }}
            />
          </Source>
        )
      )
    ).rejects.toThrow("text-overlap is not available on maplibre-native.");
  });

  test("changing the injected source throws and asks for a remount", async () => {
    const rendered = await render(
      tree(<Layer id="route-line" type="line" source="routes" />)
    );

    await expect(async () =>
      rendered.rerender(
        tree(<Layer id="route-line" type="line" source="other" />)
      )
    ).rejects.toThrow(
      'Layer "route-line" changed the creation option "source".'
    );
  });
});

describe("maplibre-native images", () => {
  test("entries convert to source and sdf fields", async () => {
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
          shield: {
            source: { uri: "https://example.com/shield.png" },
            sdf: true,
          },
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

describe("maplibre-native queries and feature state", () => {
  beforeEach(() => {
    mockQueryRenderedFeatures.mockClear();
    mockQuerySourceFeatures.mockClear();
    mockGeoJsonSetFeatureState
      .mockReset()
      .mockImplementation(async () => undefined);
    mockGeoJsonGetFeatureState
      .mockReset()
      .mockImplementation(async () => ({ selected: true }));
    mockGeoJsonRemoveFeatureState
      .mockReset()
      .mockImplementation(async () => undefined);
    mockVectorSetFeatureState
      .mockReset()
      .mockImplementation(async () => undefined);
    mockVectorGetFeatureState.mockReset().mockImplementation(async () => null);
    mockVectorRemoveFeatureState
      .mockReset()
      .mockImplementation(async () => undefined);
    mockGeoJsonHandleData.mockClear();
    mockGetClusterExpansionZoom.mockClear();
    mockGetClusterLeaves.mockClear();
    mockGetClusterChildren.mockClear();
  });

  test("queryRenderedFeatures forwards point, bounds, and viewport targets", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.queryRenderedFeatures([240, 320], {
      layers: ["route-line"],
      filter: ["==", "kind", "route"],
    });

    expect(mockQueryRenderedFeatures).toHaveBeenCalledWith([240, 320], {
      layers: ["route-line"],
      filter: ["==", "kind", "route"],
    });

    await ref.current?.queryRenderedFeatures([
      [10, 20],
      [30, 40],
    ]);

    expect(mockQueryRenderedFeatures).toHaveBeenLastCalledWith(
      [
        [10, 20],
        [30, 40],
      ],
      undefined
    );

    await ref.current?.queryRenderedFeatures(undefined);

    expect(mockQueryRenderedFeatures).toHaveBeenLastCalledWith(undefined);
  });

  test("querySourceFeatures dispatches through the vector ref", async () => {
    const ref = createRef<MapRef>();

    await render(vectorTree(ref));
    await ref.current?.querySourceFeatures("tiles", {
      sourceLayer: "way",
      filter: ["==", "kind", "route"],
    });

    expect(mockQuerySourceFeatures).toHaveBeenCalledWith({
      sourceLayer: "way",
      filter: ["==", "kind", "route"],
    });
  });

  test("querySourceFeatures requires sourceLayer for vector sources", async () => {
    const ref = createRef<MapRef>();

    await render(vectorTree(ref));

    await expect(ref.current?.querySourceFeatures("tiles")).rejects.toThrow(
      "needs sourceLayer"
    );
  });

  test("querySourceFeatures reads GeoJSON data through getData", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    const features = await ref.current?.querySourceFeatures("routes", {
      filter: ["==", "kind", "route"],
    });

    expect(mockGetData).toHaveBeenCalledWith(["==", "kind", "route"]);
    expect(features).toHaveLength(1);
  });

  test("cluster methods dispatch through the GeoJSON ref", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.getClusterExpansionZoom("routes", 7)
    ).resolves.toBe(13);
    expect(mockGetClusterExpansionZoom).toHaveBeenCalledWith(7);

    await expect(
      ref.current?.getClusterLeaves("routes", 7, 10, 2)
    ).resolves.toHaveLength(2);
    expect(mockGetClusterLeaves).toHaveBeenCalledWith(7, 10, 2);

    await expect(
      ref.current?.getClusterChildren("routes", 7)
    ).resolves.toHaveLength(1);
    expect(mockGetClusterChildren).toHaveBeenCalledWith(7);
  });

  test("cluster methods reject an unknown or non-GeoJSON source", async () => {
    const ref = createRef<MapRef>();

    await render(vectorTree(ref));

    await expect(ref.current?.getClusterChildren("unknown", 7)).rejects.toThrow(
      'Source "unknown" is not a mounted GeoJSON or vector'
    );

    await expect(
      ref.current?.getClusterExpansionZoom("tiles", 7)
    ).rejects.toThrow('Source "tiles" is not a GeoJSON Source');
  });

  test("feature state dispatches by source family", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.setFeatureState(
      { source: "routes", id: "route-1" },
      { selected: true }
    );

    expect(mockGeoJsonSetFeatureState).toHaveBeenCalledWith(
      { id: "route-1" },
      { selected: true }
    );

    await expect(
      ref.current?.getFeatureState({ source: "routes", id: "route-1" })
    ).resolves.toEqual({ selected: true });

    await ref.current?.removeFeatureState(
      { source: "routes", id: "route-1" },
      "selected"
    );

    expect(mockGeoJsonRemoveFeatureState).toHaveBeenCalledWith(
      { id: "route-1" },
      "selected"
    );
  });

  test("vector feature state requires sourceLayer", async () => {
    const ref = createRef<MapRef>();

    await render(vectorTree(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "tiles", id: 9 },
        { selected: true }
      )
    ).rejects.toThrow("need sourceLayer");

    await ref.current?.setFeatureState(
      { source: "tiles", id: 9, sourceLayer: "way" },
      { selected: true }
    );

    expect(mockVectorSetFeatureState).toHaveBeenCalledWith(
      { id: 9, sourceLayer: "way" },
      { selected: true }
    );
  });

  test("setFeatureState rejects sparse arrays before native dispatch", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: "route-1" },
        { meta: { values: new Array<number>(1) } }
      )
    ).rejects.toThrow('Feature state key "meta"');
    expect(mockGeoJsonSetFeatureState).not.toHaveBeenCalled();
    expect(mockVectorSetFeatureState).not.toHaveBeenCalled();
  });

  test("feature state rejects invalid state values", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: "route-1" },
        { selected: Number.NaN }
      )
    ).rejects.toThrow("non-finite");
    expect(mockGeoJsonSetFeatureState).not.toHaveBeenCalled();
  });

  test.each(["geojson", "vector"] as const)(
    "%s same-id remount clears retained whole state before reads and new writes",
    async (family) => {
      const ref = createRef<MapRef>();
      const backendState = new Map<string, Record<string, unknown>>();
      const events: string[] = [];
      const methods =
        family === "geojson"
          ? {
              set: mockGeoJsonSetFeatureState,
              get: mockGeoJsonGetFeatureState,
              remove: mockGeoJsonRemoveFeatureState,
            }
          : {
              set: mockVectorSetFeatureState,
              get: mockVectorGetFeatureState,
              remove: mockVectorRemoveFeatureState,
            };
      const stateKey = (feature: NativeStateFeature) =>
        JSON.stringify([String(feature.id), feature.sourceLayer ?? null]);
      methods.set.mockImplementation(async (feature, state) => {
        events.push("set");
        const key = stateKey(feature);
        backendState.set(key, { ...backendState.get(key), ...state });
      });
      methods.get.mockImplementation(async (feature) => {
        events.push("get");
        return (backendState.get(stateKey(feature)) ?? {}) as FeatureState;
      });
      methods.remove.mockImplementation(async (feature, key) => {
        events.push("remove");
        const identifier = stateKey(feature);
        if (key === undefined) backendState.delete(identifier);
        else {
          const state = { ...backendState.get(identifier) };
          delete state[key];
          backendState.set(identifier, state);
        }
      });
      const sourceId = family === "geojson" ? "routes" : "tiles";
      const target = {
        source: sourceId,
        id: 9,
        ...(family === "vector" ? { sourceLayer: "way" } : {}),
      };
      const anotherTarget =
        family === "vector"
          ? { ...target, sourceLayer: "place" }
          : { ...target, id: 10 };
      const scene = (revision: number) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
          >
            {family === "geojson" ? (
              <Source
                key={revision}
                id={sourceId}
                type="geojson"
                data={routes}
              />
            ) : (
              <Source
                key={revision}
                id={sourceId}
                type="vector"
                url="maplibre://tiles"
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const mounted = await render(scene(0));
      await ref.current?.setFeatureState(target, { selected: true, count: 2 });
      await ref.current?.setFeatureState(anotherTarget, { selected: true });
      expect(backendState.size).toBe(2);
      await mounted.rerender(scene(1));
      // The renderer retains state by id; the mock does not clear on remount.
      expect(backendState.size).toBe(2);
      events.length = 0;
      await expect(
        ref.current?.setFeatureState(target, { count: Number.NaN })
      ).rejects.toThrow("non-finite");
      if (family === "vector") {
        await expect(
          ref.current?.getFeatureState({ source: sourceId, id: 9 })
        ).rejects.toThrow("need sourceLayer");
      }
      expect(events).toEqual([]);
      await finishRenderingFrame();
      await waitFor(() => expect(backendState.size).toBe(0));
      expect(events).toEqual(["remove", "remove"]);
      await expect(ref.current?.getFeatureState(target)).resolves.toEqual({});
      expect(events).toEqual(["remove", "remove", "get"]);
      expect(backendState.size).toBe(0);
      const nativeTarget =
        family === "vector" ? { id: 9, sourceLayer: "way" } : { id: 9 };
      expect(methods.remove).toHaveBeenCalledWith(nativeTarget);
      await ref.current?.setFeatureState(target, { fresh: true });
      await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
        fresh: true,
      });
      await mounted.rerender(scene(2));
      events.length = 0;
      await finishRenderingFrame();
      await waitFor(() => expect(backendState.size).toBe(0));
      expect(events).toEqual(["remove"]);
      await ref.current?.setFeatureState(target, { next: true });
      expect(events).toEqual(["remove", "set"]);
      await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
        next: true,
      });
    }
  );

  test.each([
    { previous: "geojson", next: "vector", geoJsonLayer: false },
    { previous: "geojson", next: "vector", geoJsonLayer: true },
    { previous: "vector", next: "geojson", geoJsonLayer: true },
  ] as const)(
    "$previous to $next remount starts a new state scope (GeoJSON sourceLayer: $geoJsonLayer)",
    async ({ previous, next, geoJsonLayer }) => {
      const ref = createRef<MapRef>();
      const onError = jest.fn();
      const backend = {
        geojson: new Map<string, FeatureState>(),
        vector: new Map<string, FeatureState>(),
      };
      const methods = {
        geojson: {
          set: mockGeoJsonSetFeatureState,
          get: mockGeoJsonGetFeatureState,
          remove: mockGeoJsonRemoveFeatureState,
        },
        vector: {
          set: mockVectorSetFeatureState,
          get: mockVectorGetFeatureState,
          remove: mockVectorRemoveFeatureState,
        },
      };
      for (const family of ["geojson", "vector"] as const) {
        const key = (feature: NativeStateFeature) =>
          JSON.stringify([String(feature.id), feature.sourceLayer ?? null]);
        methods[family].set.mockImplementation(async (feature, state) => {
          backend[family].set(key(feature), state as FeatureState);
        });
        methods[family].get.mockImplementation(
          async (feature) => backend[family].get(key(feature)) ?? {}
        );
        methods[family].remove.mockImplementation(async (feature) => {
          backend[family].delete(key(feature));
        });
      }
      const target = (family: "geojson" | "vector") => ({
        source: "shared",
        id: 9,
        ...(family === "vector" || geoJsonLayer ? { sourceLayer: "way" } : {}),
      });
      const scene = (family: "geojson" | "vector", revision: number) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            onError={onError}
          >
            {family === "geojson" ? (
              <Source
                key={`${family}-${revision}`}
                id="shared"
                type="geojson"
                data={routes}
              />
            ) : (
              <Source
                key={`${family}-${revision}`}
                id="shared"
                type="vector"
                url="maplibre://tiles"
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const mounted = await render(scene(previous, 0));
      await ref.current?.setFeatureState(target(previous), { old: true });
      await mounted.rerender(scene(next, 1));
      await finishRenderingFrame();
      await expect(ref.current?.getFeatureState(target(next))).resolves.toEqual(
        {}
      );
      expect(mockGeoJsonRemoveFeatureState).not.toHaveBeenCalled();
      expect(mockVectorRemoveFeatureState).not.toHaveBeenCalled();
      await ref.current?.setFeatureState(target(next), { fresh: true });
      await expect(ref.current?.getFeatureState(target(next))).resolves.toEqual(
        { fresh: true }
      );
      expect(methods[next].set).toHaveBeenLastCalledWith(
        next === "vector" ? { id: 9, sourceLayer: "way" } : { id: 9 },
        { fresh: true }
      );
      // Same-family replacement still clears the new lifetime's written state.
      await mounted.rerender(scene(next, 2));
      await finishRenderingFrame();
      await waitFor(() => expect(backend[next].size).toBe(0));
      expect(methods[next].remove).toHaveBeenCalledTimes(1);
      expect(methods[previous].remove).not.toHaveBeenCalled();

      // A GeoJSON identifier may carry sourceLayer; the registered family still
      // owns its retained journal when that family returns.
      await mounted.rerender(scene(previous, 3));
      await finishRenderingFrame();
      await expect(
        ref.current?.getFeatureState(target(previous))
      ).resolves.toEqual({});
      expect(methods[previous].remove).toHaveBeenCalledTimes(1);
      expect(backend[previous].size).toBe(0);
      await mounted.rerender(scene(next, 4));
      await finishRenderingFrame();
      expect(onError).not.toHaveBeenCalled();
      const failure = new Error("current source write failed");
      methods[next].set.mockRejectedValueOnce(failure);
      await expect(
        ref.current?.setFeatureState(target(next), { fails: true })
      ).rejects.toBe(failure);
    }
  );

  test.each(["geojson", "vector"] as const)(
    "%s family roundtrips clear retained ids and layers without inactive-family dispatch",
    async (initialFamily) => {
      let currentFamily = initialFamily;
      // The renderer keeps each family's state when its source is temporarily absent.
      const backend = {
        geojson: new Map<string, FeatureState>(),
        vector: new Map<string, FeatureState>(),
      };
      const methods = {
        geojson: {
          set: mockGeoJsonSetFeatureState,
          get: mockGeoJsonGetFeatureState,
          remove: mockGeoJsonRemoveFeatureState,
        },
        vector: {
          set: mockVectorSetFeatureState,
          get: mockVectorGetFeatureState,
          remove: mockVectorRemoveFeatureState,
        },
      };
      const events: string[] = [];
      for (const family of ["geojson", "vector"] as const) {
        const key = (feature: NativeStateFeature) =>
          JSON.stringify([String(feature.id), feature.sourceLayer ?? null]);
        const requireActiveFamily = () => {
          if (currentFamily !== family)
            throw new Error(
              "State operation used an inactive source family handle."
            );
        };
        methods[family].set.mockImplementation(async (feature, state) => {
          requireActiveFamily();
          backend[family].set(key(feature), state as FeatureState);
        });
        methods[family].get.mockImplementation(async (feature) => {
          requireActiveFamily();
          events.push(`get:${family}:${key(feature)}`);
          return backend[family].get(key(feature)) ?? {};
        });
        methods[family].remove.mockImplementation(async (feature) => {
          requireActiveFamily();
          events.push(`remove:${family}:${key(feature)}`);
          backend[family].delete(key(feature));
        });
      }
      const ref = createRef<MapRef>();
      const onError = jest.fn();
      const scene = (family: "geojson" | "vector", revision: number) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            onError={onError}
          >
            {family === "geojson" ? (
              <Source
                key={`${family}-${revision}`}
                id="shared"
                type="geojson"
                data={routes}
              />
            ) : (
              <Source
                key={`${family}-${revision}`}
                id="shared"
                type="vector"
                url="maplibre://tiles"
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const targets = (family: "geojson" | "vector") =>
        (family === "vector" ? ["way", "alternate"] : [undefined]).flatMap(
          (sourceLayer) =>
            [1, 2].map((id) => ({
              source: "shared",
              id,
              ...(sourceLayer === undefined ? {} : { sourceLayer }),
            }))
        );
      const write = async () => {
        for (const [index, target] of targets(currentFamily).entries()) {
          await ref.current?.setFeatureState(target, {
            selected: true,
            count: index + 2,
          });
        }
      };
      const readEmpty = async () => {
        for (const target of targets(currentFamily)) {
          await expect(ref.current?.getFeatureState(target)).resolves.toEqual(
            {}
          );
        }
      };

      const mounted = await render(scene(initialFamily, 0));
      await write();
      const otherFamily = initialFamily === "geojson" ? "vector" : "geojson";
      currentFamily = otherFamily;
      await mounted.rerender(scene(currentFamily, 1));
      await finishRenderingFrame();
      await readEmpty();
      expect(methods.geojson.remove).not.toHaveBeenCalled();
      expect(methods.vector.remove).not.toHaveBeenCalled();
      await write();
      expect(backend[initialFamily].size).toBe(targets(initialFamily).length);
      currentFamily = initialFamily;
      events.length = 0;
      await mounted.rerender(scene(currentFamily, 2));
      await finishRenderingFrame();
      await readEmpty();
      expect(backend[otherFamily].size).toBe(targets(otherFamily).length);
      expect(
        events
          .slice(0, targets(initialFamily).length)
          .every((event) => event.startsWith(`remove:${initialFamily}:`))
      ).toBe(true);
      expect(methods[initialFamily].remove).toHaveBeenCalledTimes(
        targets(initialFamily).length
      );
      expect(methods[otherFamily].remove).not.toHaveBeenCalled();
      await write();
      await mounted.rerender(scene(currentFamily, 3));
      await finishRenderingFrame();
      await readEmpty();
      currentFamily = otherFamily;
      await mounted.rerender(scene(currentFamily, 4));
      await finishRenderingFrame();
      await readEmpty();
      expect(backend[initialFamily].size).toBe(0);
      expect(backend[otherFamily].size).toBe(0);
      await write();
      await mounted.rerender(scene(currentFamily, 5));
      await finishRenderingFrame();
      await readEmpty();
      expect(methods[initialFamily].remove).toHaveBeenCalledTimes(
        2 * targets(initialFamily).length
      );
      expect(methods[otherFamily].remove).toHaveBeenCalledTimes(
        2 * targets(otherFamily).length
      );
      expect(onError).not.toHaveBeenCalled();
    }
  );

  test.each<["geojson" | "vector", "geojson" | "vector"]>([
    ["geojson", "vector"],
    ["vector", "geojson"],
  ])(
    "%s to %s replacement waits for dispatched writes and rejects queued old writes",
    async (previous, next) => {
      const ref = createRef<MapRef>();
      const onError = jest.fn();
      const methods = {
        geojson: {
          set: mockGeoJsonSetFeatureState,
          remove: mockGeoJsonRemoveFeatureState,
        },
        vector: {
          set: mockVectorSetFeatureState,
          remove: mockVectorRemoveFeatureState,
        },
      };
      let finishOldWrite: () => void = () => undefined;
      methods[previous].set.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOldWrite = resolve;
          })
      );
      const target = { source: "shared", id: 9, sourceLayer: "way" };
      const scene = (family: "geojson" | "vector", revision: number) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            onError={onError}
          >
            {family === "geojson" ? (
              <Source
                key={`${family}-${revision}`}
                id="shared"
                type="geojson"
                data={routes}
              />
            ) : (
              <Source
                key={`${family}-${revision}`}
                id="shared"
                type="vector"
                url="maplibre://tiles"
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const mounted = await render(scene(previous, 0));
      const oldWrite = ref.current?.setFeatureState(target, { old: true });
      const oldRejection = expect(oldWrite).rejects.toThrow("changed during");
      await waitFor(() =>
        expect(methods[previous].set).toHaveBeenCalledTimes(1)
      );
      const queuedWrite = ref.current?.setFeatureState(
        { ...target, id: 10 },
        { queued: true }
      );
      const queuedRejection =
        expect(queuedWrite).rejects.toThrow("changed during");
      await mounted.rerender(scene(next, 1));
      const newWrite = ref.current?.setFeatureState(target, { fresh: true });
      expect(methods[next].set).not.toHaveBeenCalled();
      finishOldWrite();
      await Promise.all([oldRejection, queuedRejection, newWrite]);
      expect(methods[previous].set).toHaveBeenCalledTimes(1);
      expect(methods[next].set).toHaveBeenCalledTimes(1);
      expect(mockGeoJsonRemoveFeatureState).not.toHaveBeenCalled();
      expect(mockVectorRemoveFeatureState).not.toHaveBeenCalled();
      await mounted.rerender(scene(next, 2));
      await finishRenderingFrame();
      await waitFor(() =>
        expect(methods[next].remove).toHaveBeenCalledTimes(1)
      );
      expect(methods[next].remove).toHaveBeenCalledWith(
        next === "vector" ? { id: 9, sourceLayer: "way" } : { id: 9 }
      );
      expect(methods[previous].remove).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    }
  );

  test("source queries read the wrapper handle refreshed by a rerender", async () => {
    const ref = createRef<MapRef>();
    const updatedRoutes = { ...routes, features: routes.features.slice(0, 1) };
    const scene = (data: typeof routes) => (
      <MapSetup adapter={adapter}>
        <OneMap
          ref={ref}
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
        >
          <Source id="routes" type="geojson" data={data} />
        </OneMap>
      </MapSetup>
    );
    const mounted = await render(scene(routes));
    await ref.current?.querySourceFeatures("routes");
    expect(mockGeoJsonHandleData).toHaveBeenLastCalledWith(routes);
    await mounted.rerender(scene(updatedRoutes));
    await ref.current?.querySourceFeatures("routes");
    expect(mockGeoJsonHandleData).toHaveBeenLastCalledWith(updatedRoutes);
  });

  test("style replacement and style-load reset retained state before callback writes", async () => {
    const ref = createRef<MapRef>();
    const target = { source: "routes", id: 1 };
    let backendState: Record<string, unknown> = {};
    mockGeoJsonSetFeatureState.mockImplementation(async (_feature, state) => {
      backendState = { ...backendState, ...state };
    });
    mockGeoJsonGetFeatureState.mockImplementation(
      async () => backendState as FeatureState
    );
    mockGeoJsonRemoveFeatureState.mockImplementation(async () => {
      backendState = {};
    });
    let callbackWrite: Promise<void> | undefined;
    const onStyleLoad = jest.fn(() => {
      callbackWrite = ref.current?.setFeatureState(target, { callback: true });
    });
    const mounted = await render(example(ref, undefined, { onStyleLoad }));
    await ref.current?.setFeatureState(target, { selected: true, count: 2 });
    await mounted.rerender(
      example(ref, undefined, { mapStyle: { ...emptyStyle }, onStyleLoad })
    );
    await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
      selected: true,
      count: 2,
    });
    expect(mockGeoJsonRemoveFeatureState).not.toHaveBeenCalled();
    await mounted.rerender(
      example(ref, undefined, { mapStyle: replacementStyle, onStyleLoad })
    );
    // The mock retains renderer state across the prop update and load event.
    expect(backendState).toEqual({ selected: true, count: 2 });
    await finishRenderingFrame();
    await waitFor(() => expect(backendState).toEqual({}));
    await expect(ref.current?.getFeatureState(target)).resolves.toEqual({});
    expect(mockGeoJsonRemoveFeatureState).toHaveBeenCalledTimes(1);
    expect(mockGeoJsonRemoveFeatureState).toHaveBeenLastCalledWith({ id: 1 });
    await ref.current?.setFeatureState(target, { during: true });
    const props = MapMock.mock.calls.at(-1)?.[0] as {
      onDidFinishLoadingStyle: () => void;
    };
    props.onDidFinishLoadingStyle();
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    await callbackWrite;
    await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
      callback: true,
    });
    expect(mockGeoJsonRemoveFeatureState).toHaveBeenCalledTimes(2);
  });

  test("automatic frame cleanup reports a renderer failure only once", async () => {
    const ref = createRef<MapRef>();
    const onError = jest.fn();
    const scene = (revision: number) => (
      <MapSetup adapter={adapter}>
        <OneMap
          ref={ref}
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          onError={onError}
        >
          <Source key={revision} id="routes" type="geojson" data={routes} />
        </OneMap>
      </MapSetup>
    );
    const mounted = await render(scene(0));
    await ref.current?.setFeatureState(
      { source: "routes", id: 1 },
      { selected: true }
    );
    const failure = new Error("native source cleanup failed");
    mockGeoJsonRemoveFeatureState.mockRejectedValueOnce(failure);
    await mounted.rerender(scene(1));
    await finishRenderingFrame();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith({ error: failure });
    await finishRenderingFrame();
    await finishRenderingFrame();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(mockGeoJsonRemoveFeatureState).toHaveBeenCalledTimes(1);
    await expect(
      ref.current?.getFeatureState({ source: "routes", id: 1 })
    ).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("queued state writes preserve validated identifiers and values", async () => {
    const ref = createRef<MapRef>();
    await render(vectorTree(ref));
    let finishWrite: () => void = () => undefined;
    mockVectorSetFeatureState.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );
    const first = ref.current?.setFeatureState(
      { source: "tiles", sourceLayer: "way", id: 1 },
      { first: true }
    );
    // Let the first native dispatch acquire the queue before adding another.
    await Promise.resolve();
    const target = { source: "tiles", sourceLayer: "way", id: 2 };
    const state = { count: 2, nested: { enabled: true }, values: [1, 2] };
    const second = ref.current?.setFeatureState(target, state);
    target.id = 99;
    target.sourceLayer = "place";
    target.source = "missing";
    state.count = Number.NaN;
    state.nested.enabled = false;
    state.values[0] = Number.NaN;
    finishWrite();
    await first;
    await second;
    expect(mockVectorSetFeatureState).toHaveBeenLastCalledWith(
      { id: 2, sourceLayer: "way" },
      { count: 2, nested: { enabled: true }, values: [1, 2] }
    );
  });
});

test("native fitBounds maxZoom rejects before camera dispatch", async () => {
  const ref = createRef<MapRef>();
  await render(example(ref));
  finishMapLoad();
  mockFitBounds.mockClear();
  await expect(
    ref.current?.fitBounds(
      [
        [-123, 47],
        [-122, 48],
      ],
      { maxZoom: 12 }
    )
  ).rejects.toThrow("pinned native camera wrapper");
  expect(mockFitBounds).not.toHaveBeenCalled();
});
