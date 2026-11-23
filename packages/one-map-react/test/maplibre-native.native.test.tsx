import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  createRef,
  type ComponentRef,
  type ReactNode,
  type Ref,
  useState,
} from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  clusteredPoints,
  emptyStyle,
  initialViewState,
  replacementStyle,
  routes,
} from "../../example-map/src/scenarios/map-fixture.js";
import { NativeMapHost } from "../src/adapters/shared/native-map-host.js";
import { NativeMapPresentationContext } from "../src/adapters/shared/native-map-presentation.js";
import type { ViewState } from "../src/contracts/camera-types.js";
import type { LayerProps, LayerType } from "../src/contracts/layer-types.js";
import type { FeatureState } from "../src/contracts/query-types.js";
import { testNativeCamera } from "./native-camera-cases.js";
import { testNativeEntryBinding } from "./native-entry-binding.js";
import { testNativeRendering } from "./native-rendering-cases.js";

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
    Images: jest.fn((props: object) =>
      React.createElement("Images", { ...props, testID: "wrapper-images" })
    ),
    Layer: jest.fn((props: object) =>
      React.createElement("Layer", { ...props, testID: "Layer" })
    ),
  };
});

import {
  GeoJSONSource,
  ImageSource,
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  RasterDEMSource,
  RasterSource,
  VectorSource,
} from "@maplibre/maplibre-react-native";

import {
  Layer,
  MapProvider,
  Marker,
  Source,
  useMap,
  type MapProps,
  type MapRef,
  Map as NativeMap,
  type NativeAdvancedMapRef,
} from "../src/maplibre-native.js";
import * as nativeEntry from "../src/maplibre-native.js";

const MapMock = MaplibreMap as unknown as jest.Mock;
const LayerMock = MaplibreLayer as unknown as jest.Mock;
const GeoJSONSourceMock = GeoJSONSource as unknown as jest.Mock;
const VectorSourceMock = VectorSource as unknown as jest.Mock;
const RasterSourceMock = RasterSource as unknown as jest.Mock;
const RasterDEMSourceMock = RasterDEMSource as unknown as jest.Mock;
const ImageSourceMock = ImageSource as unknown as jest.Mock;

const lastMapProps = <Props,>(): Props => {
  const lastCall = MapMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("Map was not rendered");
  }

  return lastCall[0] as Props;
};

const finishMapLoad = async (): Promise<void> => {
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

  await act(async () => onDidFinishLoadingMap());
};

const example = (
  ref?: Ref<MapRef>,
  onMove?: (event: object) => void,
  extra?: Partial<MapProps>
) => (
  <NativeMap
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
  </NativeMap>
);

const vectorTree = (ref?: Ref<MapRef>) => (
  <NativeMap
    ref={ref}
    mapStyle={emptyStyle}
    initialViewState={initialViewState}
    style={{ flex: 1 }}
  >
    <Source id="tiles" type="vector" url="maplibre://tiles">
      <Layer id="tile-line" type="line" source-layer="way" />
    </Source>
  </NativeMap>
);

describe("maplibre-native adapter", () => {
  test.each(["selected", "enclosing", "named"] as const)(
    "%s wrapper access follows attachment before load and rejects after detach",
    async (access) => {
      const ref = createRef<NativeAdvancedMapRef>();
      let observed: NativeAdvancedMapRef | undefined;
      const Probe = () => {
        const maps = useMap();
        // eslint-disable-next-line react/globals -- Capture the handle for lifecycle assertions.
        observed = access === "named" ? maps.borrowed : maps.current;
        return null;
      };
      const loaded = jest.fn();
      const scene = (mapStyle: MapProps["mapStyle"]) => (
        <MapProvider>
          {access === "named" && <Probe />}
          <NativeMap
            id="borrowed"
            ref={ref}
            mapStyle={mapStyle}
            initialViewState={initialViewState}
            onLoad={loaded}
          >
            {access === "enclosing" && <Probe />}
          </NativeMap>
        </MapProvider>
      );
      mockFlyTo.mockClear();
      const view = await render(scene(emptyStyle));
      const retained = access === "selected" ? ref.current : observed;
      if (!retained) throw new Error("Map ref was not attached.");
      expect(
        Reflect.get(ref.current ?? {}, "setSourceVisibility")
      ).toBeUndefined();
      expect(Reflect.get(ref.current ?? {}, "showAttribution")).toBeUndefined();
      expect(Reflect.get(ref.current ?? {}, "getViewState")).toBeUndefined();
      const getWrapperMap = retained.getWrapperMap;
      const first = getWrapperMap();
      expect(first).toBeInstanceOf(Promise);
      const original = await first;
      const attachedMap = () =>
        lastMapProps<{
          ref: { current: ComponentRef<typeof MaplibreMap> | null };
        }>().ref.current;
      expect(original).toBe(attachedMap());
      expect(original.getCenter).toBe(mockGetCenter);
      expect(loaded).not.toHaveBeenCalled();
      expect(mockFlyTo).not.toHaveBeenCalled();
      await expect(retained.getCenter()).resolves.toEqual([-122.34, 47.61]);
      const mapId = view.getByTestId("wrapper-map").props.mapId;

      await view.rerender(scene(replacementStyle));
      const replacement = await getWrapperMap();
      expect(replacement).toBe(attachedMap());
      expect(replacement).not.toBe(original);
      expect(view.getByTestId("wrapper-map").props.mapId).toBe(mapId);
      await expect(retained.getWrapperMap()).resolves.toBe(replacement);
      await expect(retained.flyTo({ center: [1, 2], zoom: 3 })).rejects.toThrow(
        "not attached"
      );
      expect(mockFlyTo).not.toHaveBeenCalled();
      await finishMapLoad();
      await retained.flyTo({ center: [1, 2], zoom: 3 });
      expect(mockFlyTo).toHaveBeenCalledTimes(1);
      await expect(Promise.resolve(retained)).resolves.toBe(retained);

      await view.unmount();
      const detached = getWrapperMap();
      expect(detached).toBeInstanceOf(Promise);
      await expect(detached).rejects.toThrow("not attached");
      await expect(retained.getWrapperMap()).rejects.toThrow("not attached");
      await expect(Promise.resolve(retained)).resolves.toBe(retained);
    }
  );

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
    await finishMapLoad();
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
    await finishMapLoad();

    await expect(
      ref.current?.flyTo({ center: [-122.34, 47.61], duration: 1000 })
    ).rejects.toThrow("native");
  });

  test("load, style, and error callbacks forward the current render", async () => {
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

    await act(async () => props.onDidFinishLoadingMap());
    props.onDidFinishLoadingStyle();
    props.onDidFailLoadingMap();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({});

    const nextLoad = jest.fn();
    const nextStyleLoad = jest.fn();
    const nextError = jest.fn();
    await rendered.rerender(
      example(undefined, undefined, {
        onLoad: nextLoad,
        onStyleLoad: nextStyleLoad,
        onError: nextError,
      })
    );
    const current = lastMapProps<typeof props>();
    await act(async () => current.onDidFinishLoadingMap());
    current.onDidFinishLoadingStyle();
    current.onDidFailLoadingMap();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(nextLoad).toHaveBeenCalledTimes(1);
    expect(nextStyleLoad).toHaveBeenCalledTimes(1);
    expect(nextError).toHaveBeenCalledWith({});
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

    await finishMapLoad();
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
    await finishMapLoad();

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

  test("the first settled region reports onMove and onMoveEnd", async () => {
    const onMove = jest.fn();
    const onMoveEnd = jest.fn();

    await render(example(undefined, onMove, { onMoveEnd }));
    const props = lastMapProps<{
      onRegionDidChange: (event: object) => void;
    }>();

    await act(async () => {
      props.onRegionDidChange({
        nativeEvent: {
          center: [-122.34, 47.61],
          zoom: 11,
          bearing: 0,
          pitch: 0,
          userInteraction: false,
        },
      });
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMoveEnd).toHaveBeenCalledTimes(1);
  });

  test.each(["success", "failure", "unmount"] as const)(
    "filtered map press queries its logical point and retains %s semantics",
    async (outcome) => {
      const onClick = jest.fn();
      const onError = jest.fn();
      let resolve!: (value: typeof queryFeatures) => void;
      let reject!: (error: Error) => void;
      mockQueryRenderedFeatures.mockImplementationOnce(
        () =>
          new Promise((done, fail) => {
            resolve = done;
            reject = fail;
          })
      );
      const view = await render(
        example(undefined, undefined, {
          interactiveLayerIds: ["upper", "lower"],
          onClick,
          onError,
        })
      );
      const press = lastMapProps<{ onPress: (event: object) => void }>()
        .onPress;
      await act(async () =>
        press({
          nativeEvent: {
            lngLat: [-122.34, 47.61],
            point: [23, 41],
            features: [{ id: "unfiltered-wrapper-hit" }],
          },
        })
      );
      expect(mockQueryRenderedFeatures).toHaveBeenLastCalledWith([23, 41], {
        layers: ["upper", "lower"],
      });
      if (outcome === "unmount") await view.unmount();
      const error = new Error("native feature query failed");
      await act(async () => {
        if (outcome === "failure") reject(error);
        else resolve(queryFeatures);
      });
      if (outcome === "success") {
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith({
          lngLat: [-122.34, 47.61],
          point: [23, 41],
          features: queryFeatures,
        });
      } else expect(onClick).not.toHaveBeenCalled();
      if (outcome === "failure")
        expect(onError).toHaveBeenCalledWith({ error });
      else expect(onError).not.toHaveBeenCalled();
    }
  );

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

  test("NativeMapHost records layout before forwarding the exact host event and requires presentation context", async () => {
    await expect(
      render(
        <NativeMapHost>
          <View />
        </NativeMapHost>
      )
    ).rejects.toThrow("This component must render inside a native Map.");

    const order: string[] = [];
    const setNativeLayout = jest.fn((width: number, height: number) => {
      order.push(`setNativeLayout:${width}x${height}`);
    });
    const hostOnLayout = jest.fn((_event: LayoutChangeEvent) => {
      order.push("hostOnLayout");
    });
    const view = await render(
      <NativeMapPresentationContext.Provider
        value={{ overlayHostName: "direct-overlay", setNativeLayout }}
      >
        <NativeMapHost
          hostProps={{ testID: "direct-host", onLayout: hostOnLayout }}
        >
          <View testID="direct-child" />
        </NativeMapHost>
      </NativeMapPresentationContext.Provider>
    );
    const layoutEvent = {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 240 } },
    } as LayoutChangeEvent;

    await fireEvent(view.getByTestId("direct-host"), "layout", layoutEvent);

    expect(order).toEqual(["setNativeLayout:320x240", "hostOnLayout"]);
    expect(hostOnLayout).toHaveBeenCalledTimes(1);
    expect(hostOnLayout.mock.calls[0]?.[0]).toBe(layoutEvent);
    await view.unmount();
  });

  test("host layout updates reproject mounted live markers and preserve child state without re-rendering MaplibreMap", async () => {
    const StatefulPin = () => {
      const [count, setCount] = useState(0);
      return (
        <Pressable
          testID="maplibre-pin-button"
          onPress={() => setCount((current) => current + 1)}
        >
          <Text testID="maplibre-pin-count">{count}</Text>
        </Pressable>
      );
    };
    mockProject.mockClear();
    mockProject.mockResolvedValueOnce([12, 34]);
    const view = await render(
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        hostProps={{ testID: "maplibre-layout-host" }}
      >
        <Marker longitude={-122.34} latitude={47.61}>
          <StatefulPin />
        </Marker>
      </NativeMap>
    );
    await finishMapLoad();
    await waitFor(() =>
      expect(
        StyleSheet.flatten(
          view.getByTestId("native-marker-overlay").props.style
        )
      ).toMatchObject({ left: 12, top: 34, opacity: 1 })
    );

    await fireEvent.press(view.getByTestId("maplibre-pin-button"));
    expect(view.getByTestId("maplibre-pin-count").props.children).toBe(1);

    const mapRendersBeforeLayout = MapMock.mock.calls.length;
    mockProject.mockClear();
    mockProject.mockResolvedValueOnce([88, 99]);

    await fireEvent(view.getByTestId("maplibre-layout-host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 412, height: 640 } },
    });

    await waitFor(() =>
      expect(
        StyleSheet.flatten(
          view.getByTestId("native-marker-overlay").props.style
        )
      ).toMatchObject({ left: 88, top: 99, opacity: 1 })
    );
    expect(mockProject).toHaveBeenCalledTimes(1);
    expect(MapMock).toHaveBeenCalledTimes(mapRendersBeforeLayout);
    expect(view.getByTestId("maplibre-pin-count").props.children).toBe(1);
    await view.unmount();
  });
});

const tree = (children: ReactNode) => (
  <NativeMap
    mapStyle={emptyStyle}
    initialViewState={initialViewState}
    style={{ flex: 1 }}
  >
    {children}
  </NativeMap>
);

describe("maplibre-native source families", () => {
  test("geojson cluster options forward under style-spec names", async () => {
    GeoJSONSourceMock.mockClear();
    await render(
      tree(
        <Source
          id="points"
          type="geojson"
          data={clusteredPoints}
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
        data: clusteredPoints,
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
    await expect(
      render(tree(<Source id="c" type="geojson" data={routes} promoteId="" />))
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

  test("creation and symbol validation precede SDK expression validation", async () => {
    const layout = {
      "icon-overlap": "always",
      "text-field": ["number-format", 1, { unit: "meter" }],
    } as const;
    const view = await render(<Layer id="labels" type="symbol" />);
    await expect(
      view.rerender(<Layer id="other-labels" type="symbol" layout={layout} />)
    ).rejects.toThrow('Layer "other-labels" changed the creation option "id".');
    await expect(
      render(<Layer id="labels" type="symbol" layout={layout} />)
    ).rejects.toThrow("icon-overlap is not available on maplibre-native.");
    await expect(
      render(
        <Layer
          id="labels"
          type="symbol"
          layout={{ "text-field": layout["text-field"] }}
        />
      )
    ).rejects.toThrow("number-format.unit");
  });

  test("SDK property validation covers overlap outside portable symbol layout", async () => {
    const layout = { visibility: "visible", "icon-overlap": "always" } as const;
    await expect(
      render(<Layer id="roads" type="line" layout={layout} />)
    ).rejects.toThrow('Layer property "icon-overlap" is unsupported');

    const style = { iconAllowOverlap: true, textOverlap: false };
    await expect(
      render(<Layer id="labels" type="symbol" style={style} />)
    ).rejects.toThrow('Layer property "textOverlap" is unsupported');
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

  test.each(["geojson", "vector"] as const)(
    "%s style load does not add automatic removals after explicit key and whole removals",
    async (kind) => {
      const ref = createRef<MapRef>();
      await render(kind === "geojson" ? example(ref) : vectorTree(ref));
      const remove =
        kind === "geojson"
          ? mockGeoJsonRemoveFeatureState
          : mockVectorRemoveFeatureState;
      const cleared = {
        source: kind === "geojson" ? "routes" : "tiles",
        id: 1,
        ...(kind === "vector" ? { sourceLayer: "way" } : {}),
      };
      const partial = { ...cleared, id: 2 };
      await ref.current?.setFeatureState(cleared, { selected: true });
      await ref.current?.setFeatureState(partial, { selected: true, count: 1 });
      await ref.current?.removeFeatureState(cleared);
      await ref.current?.removeFeatureState(partial, "selected");
      remove.mockClear();

      await act(async () =>
        lastMapProps<{
          onDidFinishLoadingStyle: () => void;
        }>().onDidFinishLoadingStyle()
      );
      await ref.current?.getFeatureState(partial);
      expect(remove).not.toHaveBeenCalled();
    }
  );

  test("setFeatureState rejects sparse arrays before native dispatch", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: "route-1" },
        // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
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
    "%s remount and family roundtrip preserve renderer-owned state without automatic removals",
    async (initialFamily) => {
      let activeFamily = initialFamily;
      const states = {
        geojson: { retained: true },
        vector: { retained: true },
      };
      const methods = {
        geojson: {
          get: mockGeoJsonGetFeatureState,
          remove: mockGeoJsonRemoveFeatureState,
        },
        vector: {
          get: mockVectorGetFeatureState,
          remove: mockVectorRemoveFeatureState,
        },
      };
      for (const family of ["geojson", "vector"] as const) {
        methods[family].get.mockImplementation(async () => {
          if (activeFamily !== family)
            throw new Error("Inactive source handle");
          return states[family];
        });
      }
      const ref = createRef<MapRef>();
      const scene = (family: "geojson" | "vector", revision: number) => (
        <NativeMap
          ref={ref}
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
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
        </NativeMap>
      );
      const mounted = await render(scene(initialFamily, 0));
      const otherFamily = initialFamily === "geojson" ? "vector" : "geojson";
      for (const [revision, family] of (
        [initialFamily, otherFamily, initialFamily] as const
      ).entries()) {
        activeFamily = family;
        await mounted.rerender(scene(family, revision + 1));
        const target = { source: "shared", id: 9, sourceLayer: "way" };
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
          retained: true,
        });
        expect(methods[family].get).toHaveBeenLastCalledWith(
          family === "vector" ? { id: 9, sourceLayer: "way" } : { id: 9 }
        );
        expect(mockGeoJsonRemoveFeatureState).not.toHaveBeenCalled();
        expect(mockVectorRemoveFeatureState).not.toHaveBeenCalled();
      }
    }
  );

  test.each<["geojson" | "vector", "geojson" | "vector"]>([
    ["geojson", "vector"],
    ["vector", "geojson"],
  ])(
    "%s dispatched write may settle after %s replacement while fresh calls use the replacement",
    async (previous, next) => {
      const ref = createRef<MapRef>();
      const methods = {
        geojson: mockGeoJsonSetFeatureState,
        vector: mockVectorSetFeatureState,
      };
      let finish = () => {};
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      methods[previous].mockImplementationOnce(() => pending);
      const scene = (family: "geojson" | "vector") => (
        <NativeMap
          ref={ref}
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
        >
          {family === "geojson" ? (
            <Source key={family} id="shared" type="geojson" data={routes} />
          ) : (
            <Source
              key={family}
              id="shared"
              type="vector"
              url="maplibre://tiles"
            />
          )}
        </NativeMap>
      );
      const mounted = await render(scene(previous));
      const target = { source: "shared", id: 9, sourceLayer: "way" };
      const oldWrite = ref.current?.setFeatureState(target, { old: true });
      expect(methods[previous]).toHaveBeenCalledTimes(1);
      await mounted.rerender(scene(next));
      await ref.current?.setFeatureState(target, { fresh: true });
      expect(methods[next]).toHaveBeenCalledTimes(1);
      finish();
      await expect(oldWrite).resolves.toBeUndefined();
      expect(mockGeoJsonRemoveFeatureState).not.toHaveBeenCalled();
      expect(mockVectorRemoveFeatureState).not.toHaveBeenCalled();
    }
  );

  test("source queries read the wrapper handle refreshed by a rerender", async () => {
    const ref = createRef<MapRef>();
    const updatedRoutes = { ...routes, features: routes.features.slice(0, 1) };
    const scene = (data: typeof routes) => (
      <NativeMap
        ref={ref}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
      >
        <Source id="routes" type="geojson" data={data} />
      </NativeMap>
    );
    const mounted = await render(scene(routes));
    await ref.current?.querySourceFeatures("routes");
    expect(mockGeoJsonHandleData).toHaveBeenLastCalledWith(routes);
    await mounted.rerender(scene(updatedRoutes));
    await ref.current?.querySourceFeatures("routes");
    expect(mockGeoJsonHandleData).toHaveBeenLastCalledWith(updatedRoutes);
  });

  test("style replacement and load preserve renderer state and callback writes", async () => {
    const ref = createRef<MapRef>();
    const target = { source: "routes", id: 1 };
    let backendState: Record<string, unknown> = {};
    mockGeoJsonSetFeatureState.mockImplementation(async (_feature, state) => {
      backendState = { ...backendState, ...state };
    });
    mockGeoJsonGetFeatureState.mockImplementation(
      async () => backendState as FeatureState
    );
    let callbackWrite: Promise<void> | undefined;
    const onStyleLoad = jest.fn(() => {
      callbackWrite = ref.current?.setFeatureState(target, { callback: true });
    });
    const mounted = await render(example(ref, undefined, { onStyleLoad }));
    await ref.current?.setFeatureState(target, { selected: true, count: 2 });
    await mounted.rerender(
      example(ref, undefined, { mapStyle: replacementStyle, onStyleLoad })
    );
    const props = MapMock.mock.calls.at(-1)?.[0] as {
      onDidFinishLoadingStyle: () => void;
    };
    props.onDidFinishLoadingStyle();
    await callbackWrite;
    await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
      selected: true,
      count: 2,
      callback: true,
    });
    expect(mockGeoJsonRemoveFeatureState).not.toHaveBeenCalled();
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
  });

  test.each(["geojson", "vector"] as const)(
    "%s explicit removal propagates attachment errors without retrying",
    async (kind) => {
      const ref = createRef<MapRef>();
      await render(kind === "vector" ? vectorTree(ref) : example(ref));
      const remove =
        kind === "vector"
          ? mockVectorRemoveFeatureState
          : mockGeoJsonRemoveFeatureState;
      const failure = Object.assign(new Error("Source is not attached"), {
        code: "source_not_attached",
      });
      remove.mockRejectedValueOnce(failure);
      const target = {
        source: kind === "vector" ? "tiles" : "routes",
        id: 1,
        ...(kind === "vector" ? { sourceLayer: "way" } : {}),
      };
      await expect(ref.current?.removeFeatureState(target)).rejects.toBe(
        failure
      );
      expect(remove).toHaveBeenCalledTimes(1);
      await expect(
        ref.current?.removeFeatureState(target)
      ).resolves.toBeUndefined();
    }
  );

  test("explicit state writes preserve validated identifiers and values", async () => {
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
  await finishMapLoad();
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

test("MapLibre Native forwards legacy light and rejects unsupported terrain/globe/elevation", async () => {
  const ref = createRef<MapRef>();
  const mounted = await render(
    <NativeMap
      ref={ref}
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      projection="mercator"
      light={{ intensity: 0, position: [1, 2, 3] }}
    >
      <Layer
        id="shade"
        type="hillshade"
        paint={{ "hillshade-exaggeration": 0 }}
      />
    </NativeMap>
  );
  expect(lastMapProps<{ light: object }>().light).toMatchObject({
    intensity: 0,
    position: [1, 2, 3],
  });
  await expect(ref.current?.queryTerrainElevation([0, 0])).rejects.toThrow(
    "unsupported"
  );
  await mounted.unmount();
  for (const props of [
    { terrain: { source: "dem" } },
    { projection: "globe" as const },
  ]) {
    await expect(
      render(
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          {...props}
        />
      )
    ).rejects.toThrow("unsupported");
  }
});

test("selected native location follow rejects a simultaneous viewState target", async () => {
  await expect(
    render(
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        viewState={initialViewState}
        locationOptions={{
          trackUserLocation: "default",
          onTrackUserLocationChange: undefined,
        }}
      />
    )
  ).rejects.toThrow("Selected location follow conflicts with viewState.");
});

describe("maplibre-native entry binding", () => {
  testNativeCamera(nativeEntry.Map, {
    captureEvents: () => {
      const { onRegionIsChanging, onRegionDidChange } = lastMapProps<{
        onRegionIsChanging(event: object): void;
        onRegionDidChange(event: object): void;
      }>();
      const payload = (
        { longitude, latitude, zoom, bearing, pitch }: ViewState,
        userInteraction: boolean
      ) => ({
        nativeEvent: {
          center: [longitude, latitude],
          zoom,
          bearing,
          pitch,
          userInteraction,
        },
      });
      return {
        move: (viewState, userInteraction) =>
          onRegionIsChanging(payload(viewState, userInteraction)),
        settle: (viewState) => onRegionDidChange(payload(viewState, false)),
      };
    },
    jump: mockJumpTo,
    centerProp: "center",
    zoomProp: "zoom",
    bearingProp: "bearing",
    getZoom: mockGetZoom,
    project: mockProject,
  });
  testNativeRendering(nativeEntry, "maplibre-native", {
    map: MapMock,
    image: ImageSourceMock,
    geojson: GeoJSONSourceMock,
    raster: RasterSourceMock,
  });

  test("forwards wrapper-only options on the selected Layer", async () => {
    await render(
      <nativeEntry.Layer
        type="raster"
        afterId="water"
        layerIndex={2}
        style={{ rasterResampling: "nearest" }}
      />
    );
    expect(LayerMock.mock.lastCall?.[0]).toMatchObject({
      afterId: "water",
      layerIndex: 2,
      style: { rasterResampling: "nearest" },
    });
  });

  testNativeEntryBinding(
    nativeEntry,
    "maplibre-native",
    {
      nativeEvent: { lngLat: [-122.34, 47.61], point: [23, 41] },
    },
    () => {
      let complete: () => void = () => {
        throw new Error("Rendered query was never dispatched.");
      };
      mockQueryRenderedFeatures.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = () => resolve(queryFeatures);
          })
      );
      return () => complete();
    },
    mockGetClusterExpansionZoom,
    () =>
      expect(LayerMock.mock.lastCall?.[0]).toMatchObject({
        source: "routes",
        paint: { "line-width": 3 },
      })
  );
});

test("removes an undefined legacy style value before native bridge conversion", async () => {
  const scene = (width?: number) => (
    <nativeEntry.Map mapStyle={emptyStyle}>
      <nativeEntry.Layer
        type="line"
        id="route"
        source="routes"
        style={{ lineWidth: width }}
      />
    </nativeEntry.Map>
  );
  const view = await render(scene(2));
  await view.rerender(scene());
  expect(view.getByTestId("Layer").props.style).not.toHaveProperty("lineWidth");
});

test("NativeMapProps options excludes overwritten mapStyle and callback props while accepting valid MapLibre options", () => {
  const validOptions: MapProps["options"] = {
    scaleBar: true,
    light: { intensity: 0.5 },
  };
  const rejectedMapStyle: MapProps["options"] = {
    // @ts-expect-error mapStyle owns MapLibre mapStyle.
    mapStyle: "https://example.test/style.json",
  };
  const rejectedOnPress: MapProps["options"] = {
    // @ts-expect-error Facade owns onPress.
    onPress: () => {},
  };
  const rejectedOnLongPress: MapProps["options"] = {
    // @ts-expect-error Facade owns onLongPress.
    onLongPress: () => {},
  };
  const rejectedOnRegionWillChange: MapProps["options"] = {
    // @ts-expect-error Facade owns onRegionWillChange.
    onRegionWillChange: () => {},
  };
  const rejectedOnRegionIsChanging: MapProps["options"] = {
    // @ts-expect-error Facade owns onRegionIsChanging.
    onRegionIsChanging: () => {},
  };
  const rejectedOnRegionDidChange: MapProps["options"] = {
    // @ts-expect-error Facade owns onRegionDidChange.
    onRegionDidChange: () => {},
  };
  const rejectedOnDidFinishLoadingMap: MapProps["options"] = {
    // @ts-expect-error Facade owns onDidFinishLoadingMap.
    onDidFinishLoadingMap: () => {},
  };
  const rejectedOnDidFinishLoadingStyle: MapProps["options"] = {
    // @ts-expect-error Facade owns onDidFinishLoadingStyle.
    onDidFinishLoadingStyle: () => {},
  };
  const rejectedOnDidFailLoadingMap: MapProps["options"] = {
    // @ts-expect-error Facade owns onDidFailLoadingMap.
    onDidFailLoadingMap: () => {},
  };
  expect(validOptions).toBeDefined();
  expect([
    rejectedMapStyle,
    rejectedOnPress,
    rejectedOnLongPress,
    rejectedOnRegionWillChange,
    rejectedOnRegionIsChanging,
    rejectedOnRegionDidChange,
    rejectedOnDidFinishLoadingMap,
    rejectedOnDidFinishLoadingStyle,
    rejectedOnDidFailLoadingMap,
  ]).toHaveLength(9);
});
