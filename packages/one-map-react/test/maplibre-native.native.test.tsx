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
    GeoJSONSource: sourceComponent("GeoJSONSource"),
    VectorSource: sourceComponent("VectorSource"),
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
