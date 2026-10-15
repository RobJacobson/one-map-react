import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createRef, type ReactNode, type Ref } from "react";
import { Platform, Text } from "react-native";

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
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Source } from "../src/facade/source.js";
import { ScaleControl } from "../src/facade/ui.js";

const mockSetCamera = jest.fn();
const mockGetCenter = jest.fn(async () => [-122.34, 47.61]);
const mockGetZoom = jest.fn(async () => 11);
const mockGetVisibleBounds = jest.fn(async () => [
  [-122.2, 47.7],
  [-122.4, 47.5],
]);
const mockGetPointInView = jest.fn(async () => [12, 34]);
const mockGetCoordinateFromView = jest.fn(async () => [-122.34, 47.61]);
const queryCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", id: 1, properties: { kind: "route" } },
    { type: "Feature", id: 1, properties: { kind: "route" } },
  ],
};
const mockQueryRenderedFeaturesAtPoint = jest.fn<() => Promise<unknown>>(
  async () => queryCollection
);
const mockQueryRenderedFeaturesInRect = jest.fn<() => Promise<unknown>>(
  async () => queryCollection
);
const mockQuerySourceFeatures = jest.fn(async () =>
  JSON.parse(JSON.stringify(queryCollection))
);
const mockSetFeatureState = jest.fn(
  async (
    _id: string,
    _state: Record<string, unknown>,
    _source: string,
    _layer: string | null
  ) => undefined
);
const mockGetFeatureState = jest.fn<
  (id: string, source: string, layer: string | null) => Promise<unknown>
>(async () => ({
  selected: true,
}));
const mockRemoveFeatureState = jest.fn(
  async (
    _id: string,
    _key: string | null,
    _source: string,
    _layer: string | null
  ) => undefined
);
const assertClusterFeature = (feature: unknown): void => {
  expect(feature).toEqual({
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: { cluster: true, cluster_id: 7 },
  });
};
const mockGetClusterExpansionZoom = jest.fn(async (feature: unknown) => {
  assertClusterFeature(feature);
  return 13;
});
const mockGetClusterLeaves = jest.fn(
  async (feature: unknown, _limit: number, _offset: number) => {
    assertClusterFeature(feature);
    return queryCollection;
  }
);
const mockGetClusterChildren = jest.fn(async (feature: unknown) => {
  assertClusterFeature(feature);
  return queryCollection;
});

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

  // ShapeSource carries cluster methods on its ref, so it forwards the
  // caller's ref onto an imperative handle.
  const shapeSourceComponent = jest.fn(
    ({
      id,
      children,
      ref,
      ...props
    }: {
      id: string;
      children?: React.ReactNode;
      ref?: React.Ref<{
        getClusterExpansionZoom: typeof mockGetClusterExpansionZoom;
        getClusterLeaves: typeof mockGetClusterLeaves;
        getClusterChildren: typeof mockGetClusterChildren;
      }>;
      [key: string]: unknown;
    }) => {
      React.useImperativeHandle(ref, () => ({
        getClusterExpansionZoom: mockGetClusterExpansionZoom,
        getClusterLeaves: mockGetClusterLeaves,
        getClusterChildren: mockGetClusterChildren,
      }));

      return React.createElement(
        "ShapeSource",
        { id, ...props },
        React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement, {
                sourceID: id,
              })
            : child
        )
      );
    }
  );

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
          queryRenderedFeaturesAtPoint: mockQueryRenderedFeaturesAtPoint,
          queryRenderedFeaturesInRect: mockQueryRenderedFeaturesInRect,
          querySourceFeatures: mockQuerySourceFeatures,
          setFeatureState: mockSetFeatureState,
          getFeatureState: mockGetFeatureState,
          removeFeatureState: mockRemoveFeatureState,
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
    ShapeSource: shapeSourceComponent,
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

import {
  adapter,
  Control,
  MapboxGestureSettings,
  Map as NativeMap,
} from "../src/mapbox-native.js";

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
  test("Android locks and restores gestures through scalar native props", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    const scene = (interactive: boolean) => (
      <MapSetup adapter={adapter}>
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          interactive={interactive}
        />
      </MapSetup>
    );
    try {
      const view = await render(scene(false));
      const locked = lastMapProps<{
        scrollEnabled: boolean;
        zoomEnabled: boolean;
        rotateEnabled: boolean;
        pitchEnabled: boolean;
        gestureSettings?: object;
      }>();
      expect(locked).toMatchObject({
        scrollEnabled: false,
        zoomEnabled: false,
        rotateEnabled: false,
        pitchEnabled: false,
      });
      expect(locked.gestureSettings).toBeUndefined();
      await view.rerender(scene(true));
      const restored = lastMapProps<typeof locked>();
      expect(restored.scrollEnabled).toBeUndefined();
      expect(restored.zoomEnabled).toBe(true);
      expect(restored.rotateEnabled).toBeUndefined();
      expect(restored.pitchEnabled).toBeUndefined();
      expect(restored.gestureSettings).toBeUndefined();
      await view.unmount();
    } finally {
      platform.restore();
    }
  });

  test.each([false, true])(
    "Android restores selected zoomEnabled=%s after a gesture lock",
    async (zoomEnabled) => {
      const platform = jest.replaceProperty(Platform, "OS", "android");
      const scene = (interactive: boolean) => (
        <MapSetup adapter={adapter}>
          <NativeMap
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            interactive={interactive}
            options={{ zoomEnabled }}
          />
        </MapSetup>
      );
      try {
        const view = await render(scene(false));
        expect(lastMapProps<{ zoomEnabled: boolean }>().zoomEnabled).toBe(
          false
        );
        await view.rerender(scene(true));
        expect(lastMapProps<{ zoomEnabled: boolean }>().zoomEnabled).toBe(
          zoomEnabled
        );
        await view.unmount();
      } finally {
        platform.restore();
      }
    }
  );

  test("Android double-tap options cannot override a temporary gesture lock", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    const scene = (interactive: boolean) => (
      <MapSetup adapter={adapter}>
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          interactive={interactive}
          options={{
            gestureSettings: {
              doubleTapToZoomInEnabled: true,
              doubleTouchToZoomOutEnabled: true,
              quickZoomEnabled: false,
            },
          }}
        />
      </MapSetup>
    );
    try {
      const view = await render(scene(false));
      expect(
        lastMapProps<{ gestureSettings: object }>().gestureSettings
      ).toEqual({
        doubleTapToZoomInEnabled: false,
        doubleTouchToZoomOutEnabled: false,
        quickZoomEnabled: false,
      });
      await view.rerender(scene(true));
      expect(
        lastMapProps<{ gestureSettings: object }>().gestureSettings
      ).toEqual({
        doubleTapToZoomInEnabled: true,
        doubleTouchToZoomOutEnabled: true,
        quickZoomEnabled: false,
      });
      await view.unmount();
    } finally {
      platform.restore();
    }
  });

  test.each([false, true])(
    "Android retains an explicit doubleTapZoom=%s map across a gesture lock",
    async (doubleTapZoom) => {
      const platform = jest.replaceProperty(Platform, "OS", "android");
      const scene = (interactive: boolean) => (
        <MapSetup adapter={adapter}>
          <NativeMap
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            interactive={interactive}
            doubleTapZoom={doubleTapZoom}
          />
        </MapSetup>
      );
      try {
        const view = await render(scene(false));
        expect(
          lastMapProps<{ gestureSettings: object }>().gestureSettings
        ).toEqual({
          doubleTapToZoomInEnabled: false,
          doubleTouchToZoomOutEnabled: false,
        });
        await view.rerender(scene(true));
        expect(
          lastMapProps<{ gestureSettings: object }>().gestureSettings
        ).toEqual({
          doubleTapToZoomInEnabled: doubleTapZoom,
          doubleTouchToZoomOutEnabled: doubleTapZoom,
        });
        await view.unmount();
      } finally {
        platform.restore();
      }
    }
  );

  test.each<["ios" | "android", boolean]>([
    ["ios", true],
    ["ios", false],
    ["android", true],
  ])(
    "%s scale position updates retain enabled=%s after native refresh",
    async (os, enabled) => {
      const platform = jest.replaceProperty(Platform, "OS", os);
      const scene = (top: number) => (
        <MapSetup adapter={adapter}>
          <NativeMap
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            options={{
              scaleBarPosition: { top, left: 8 },
              scaleBarEnabled: enabled,
            }}
          />
        </MapSetup>
      );
      try {
        const view = await render(scene(8));
        const before = MapViewMock.mock.calls.length;
        await view.rerender(scene(56));
        await waitFor(() =>
          expect(
            lastMapProps<{ scaleBarEnabled: boolean }>().scaleBarEnabled
          ).toBe(enabled)
        );
        const commits = MapViewMock.mock.calls.slice(before).map(
          ([props]) =>
            props as {
              scaleBarPosition: object;
              scaleBarEnabled: boolean;
            }
        );
        expect(commits.length).toBeGreaterThan(0);
        expect(
          commits.every(
            (props) =>
              JSON.stringify(props.scaleBarPosition) ===
              JSON.stringify({ top: 56, left: 8 })
          )
        ).toBe(true);
        if (os === "ios" && enabled) {
          expect(commits[0]?.scaleBarEnabled).toBe(false);
          expect(commits.at(-1)?.scaleBarEnabled).toBe(true);
        } else {
          expect(
            commits.every((props) => props.scaleBarEnabled === enabled)
          ).toBe(true);
        }
        await view.unmount();
      } finally {
        platform.restore();
      }
    }
  );

  test("iOS layout changes reapply unchanged scale margins without remounting", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "ios");
    try {
      const view = await render(
        <MapSetup adapter={adapter}>
          <NativeMap
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
            hostProps={{ testID: "scale-layout-host" }}
            options={{
              scaleBarPosition: { top: 96, left: 8 },
              scaleBarEnabled: true,
            }}
          />
        </MapSetup>
      );
      const before = MapViewMock.mock.calls.length;
      await fireEvent(view.getByTestId("scale-layout-host"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 237 } },
      });
      await waitFor(() =>
        expect(
          lastMapProps<{ scaleBarEnabled: boolean }>().scaleBarEnabled
        ).toBe(true)
      );
      const commits = MapViewMock.mock.calls
        .slice(before)
        .map(
          ([props]) =>
            props as { scaleBarPosition: object; scaleBarEnabled: boolean }
        );
      expect(commits.some((props) => props.scaleBarEnabled === false)).toBe(
        true
      );
      expect(commits.at(-1)?.scaleBarEnabled).toBe(true);
      expect(
        commits.every(
          (props) =>
            JSON.stringify(props.scaleBarPosition) ===
            JSON.stringify({ top: 96, left: 8 })
        )
      ).toBe(true);
      await view.unmount();
    } finally {
      platform.restore();
    }
  });

  test("SDK ornaments stay outside measured native controls and restore after removal", async () => {
    const explicit = {
      logoPosition: { top: 3, left: 4 },
      attributionPosition: { top: 5, right: 6 },
    };
    const scene = (controls: boolean, configured = false) => (
      <MapSetup adapter={adapter}>
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          options={configured ? explicit : undefined}
        >
          {controls && (
            <>
              <Control
                position="bottom-left"
                hostProps={{ testID: "left-control" }}
              >
                <Text>Left</Text>
              </Control>
              <Control
                position="bottom-right"
                hostProps={{ testID: "right-control" }}
              >
                <Text>Right</Text>
              </Control>
            </>
          )}
        </NativeMap>
      </MapSetup>
    );
    const view = await render(scene(true));
    await fireEvent(view.getByTestId("left-control"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 26 } },
    });
    await fireEvent(view.getByTestId("right-control"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 40 } },
    });
    const props = lastMapProps<{
      logoPosition: { bottom: number; left: number };
      attributionPosition: { bottom: number; right: number };
    }>();
    expect(props.logoPosition.bottom).toBeGreaterThan(8 + 26);
    expect(props.attributionPosition.bottom).toBeGreaterThan(8 + 40);
    await view.rerender(scene(false));
    const restored = lastMapProps<{
      logoPosition: object;
      attributionPosition: object;
    }>();
    expect(restored.logoPosition).toEqual({ bottom: 8, left: 8 });
    expect(restored.attributionPosition).toEqual({ bottom: 8, right: 8 });
    await view.rerender(scene(true, true));
    const configured = lastMapProps<{
      logoPosition: object;
      attributionPosition: object;
    }>();
    expect(configured.logoPosition).toEqual(explicit.logoPosition);
    expect(configured.attributionPosition).toEqual(
      explicit.attributionPosition
    );
  });

  test("scale initializes at load and changes units without camera movement", async () => {
    mockGetCoordinateFromView
      .mockResolvedValueOnce([-122.32, 47.61])
      .mockResolvedValueOnce([-122.32, 47.61]);
    const scene = (unit: "metric" | "imperial") => (
      <MapSetup adapter={adapter}>
        <OneMap mapStyle={emptyStyle} initialViewState={initialViewState}>
          <ScaleControl unit={unit} />
        </OneMap>
      </MapSetup>
    );
    const view = await render(scene("metric"));
    await act(async () =>
      view.getByTestId("wrapper-map").props.onDidFinishLoadingMap()
    );
    await waitFor(() => expect(view.getByText("1 km")).toBeTruthy());
    await view.rerender(scene("imperial"));
    await waitFor(() => expect(view.getByText("2000 ft")).toBeTruthy());
    expect(view.queryByText("1 km")).toBeNull();
  });

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
          tileSize={512}
        />
      )
    );

    expect(RasterDemSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "terrain",
        url: "https://example.com/terrain.json",
        maxZoomLevel: 14,
        tileSize: 512,
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

describe("mapbox-native queries and feature state", () => {
  beforeEach(() => {
    mockQueryRenderedFeaturesAtPoint.mockClear();
    mockQueryRenderedFeaturesInRect.mockClear();
    mockQuerySourceFeatures.mockClear();
    mockSetFeatureState.mockClear();
    mockGetFeatureState.mockClear();
    mockRemoveFeatureState.mockClear();
    mockGetClusterExpansionZoom.mockClear();
    mockGetClusterLeaves.mockClear();
    mockGetClusterChildren.mockClear();
  });

  test.each(["geojson", "vector"] as const)(
    "%s source can change family without resetting an incompatible old target",
    async (initialKind) => {
      let currentKind = initialKind;
      let state: Record<string, unknown> = {};
      mockSetFeatureState.mockImplementation(async (_id, value) => {
        state = { ...state, ...value };
      });
      mockGetFeatureState.mockImplementation(async () => state);
      mockRemoveFeatureState.mockImplementation(
        async (_id, _key, _source, layer) => {
          if ((currentKind === "vector") !== (layer === "way")) {
            throw new Error(
              "The cleanup target belongs to the prior source family."
            );
          }
          state = {};
        }
      );
      const ref = createRef<MapRef>();
      const scene = (kind: "geojson" | "vector", revision: number) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
          >
            {kind === "geojson" ? (
              <Source key={revision} id="routes" type="geojson" data={routes} />
            ) : (
              <Source
                key={revision}
                id="routes"
                type="vector"
                tiles={["https://example.com/{z}/{x}/{y}.pbf"]}
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const target = (kind: "geojson" | "vector") => ({
        source: "routes",
        id: 1,
        ...(kind === "vector" ? { sourceLayer: "way" } : {}),
      });
      try {
        const mounted = await render(scene(initialKind, 0));
        await ref.current?.setFeatureState(target(initialKind), {
          selected: true,
        });
        currentKind = initialKind === "geojson" ? "vector" : "geojson";
        // Recreating a different SDK source family establishes a new state scope.
        state = {};
        await mounted.rerender(scene(currentKind, 1));
        await expect(
          ref.current?.setFeatureState(target(currentKind), { count: 3 })
        ).resolves.toBeUndefined();
        await expect(
          ref.current?.getFeatureState(target(currentKind))
        ).resolves.toEqual({ count: 3 });
        expect(mockRemoveFeatureState).not.toHaveBeenCalled();
        await mounted.rerender(scene(currentKind, 2));
        await expect(
          ref.current?.getFeatureState(target(currentKind))
        ).resolves.toEqual({});
        expect(mockRemoveFeatureState).toHaveBeenCalledTimes(1);
      } finally {
        mockSetFeatureState.mockImplementation(async () => undefined);
        mockGetFeatureState.mockImplementation(async () => ({
          selected: true,
        }));
        mockRemoveFeatureState.mockImplementation(async () => undefined);
      }
    }
  );

  test.each(["geojson", "vector"] as const)(
    "%s family roundtrips clear retained ids and layers only when their family returns",
    async (initialKind) => {
      let currentKind = initialKind;
      // The renderer keeps each family's state when its source is temporarily absent.
      const backend = {
        geojson: new globalThis.Map<string, Record<string, unknown>>(),
        vector: new globalThis.Map<string, Record<string, unknown>>(),
      };
      const events: string[] = [];
      const key = (id: string, layer: string | null) =>
        JSON.stringify([id, layer]);
      const requireActiveFamily = (layer: string | null) => {
        if ((currentKind === "vector") !== (layer !== null))
          throw new Error(
            "State operation used an incompatible source family."
          );
      };
      mockSetFeatureState.mockImplementation(
        async (id, state, _source, layer) => {
          requireActiveFamily(layer);
          backend[currentKind].set(key(id, layer), state);
        }
      );
      mockGetFeatureState.mockImplementation(async (id, _source, layer) => {
        requireActiveFamily(layer);
        events.push(`get:${currentKind}:${key(id, layer)}`);
        return backend[currentKind].get(key(id, layer)) ?? {};
      });
      mockRemoveFeatureState.mockImplementation(
        async (id, _property, _source, layer) => {
          requireActiveFamily(layer);
          events.push(`remove:${currentKind}:${key(id, layer)}`);
          backend[currentKind].delete(key(id, layer));
        }
      );
      const ref = createRef<MapRef>();
      const scene = (kind: "geojson" | "vector", revision: number) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
          >
            {kind === "geojson" ? (
              <Source
                key={`${kind}-${revision}`}
                id="shared"
                type="geojson"
                data={routes}
              />
            ) : (
              <Source
                key={`${kind}-${revision}`}
                id="shared"
                type="vector"
                tiles={["https://example.com/{z}/{x}/{y}.pbf"]}
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const targets = (kind: "geojson" | "vector") =>
        (kind === "vector" ? ["way", "alternate"] : [undefined]).flatMap(
          (sourceLayer) =>
            [1, 2].map((id) => ({
              source: "shared",
              id,
              ...(sourceLayer === undefined ? {} : { sourceLayer }),
            }))
        );
      const write = async () => {
        for (const [index, target] of targets(currentKind).entries()) {
          await ref.current?.setFeatureState(target, {
            selected: true,
            count: index + 2,
          });
        }
      };
      const readEmpty = async () => {
        for (const target of targets(currentKind)) {
          await expect(ref.current?.getFeatureState(target)).resolves.toEqual(
            {}
          );
        }
      };

      try {
        const mounted = await render(scene(initialKind, 0));
        await write();
        const otherKind = initialKind === "geojson" ? "vector" : "geojson";
        currentKind = otherKind;
        await mounted.rerender(scene(currentKind, 1));
        await readEmpty();
        expect(mockRemoveFeatureState).not.toHaveBeenCalled();
        await write();
        expect(backend[initialKind].size).toBe(targets(initialKind).length);
        currentKind = initialKind;
        events.length = 0;
        await mounted.rerender(scene(currentKind, 2));
        await readEmpty();
        expect(backend[otherKind].size).toBe(targets(otherKind).length);
        expect(
          events
            .slice(0, targets(initialKind).length)
            .every((event) => event.startsWith(`remove:${initialKind}:`))
        ).toBe(true);
        expect(mockRemoveFeatureState).toHaveBeenCalledTimes(
          targets(initialKind).length
        );
        await write();
        await mounted.rerender(scene(currentKind, 3));
        await readEmpty();
        currentKind = otherKind;
        await mounted.rerender(scene(currentKind, 4));
        await readEmpty();
        expect(backend[initialKind].size).toBe(0);
        expect(backend[otherKind].size).toBe(0);
        await write();
        await mounted.rerender(scene(currentKind, 5));
        await readEmpty();
        expect(mockRemoveFeatureState).toHaveBeenCalledTimes(
          2 * (targets(initialKind).length + targets(otherKind).length)
        );
      } finally {
        mockSetFeatureState.mockImplementation(async () => undefined);
        mockGetFeatureState.mockImplementation(async () => ({
          selected: true,
        }));
        mockRemoveFeatureState.mockImplementation(async () => undefined);
      }
    }
  );

  test.each(["geojson", "vector"] as const)(
    "%s same-id remount clears retained whole state before the first operation",
    async (kind) => {
      const backend = new globalThis.Map<string, Record<string, unknown>>();
      const identity = (id: string, source: string, layer: string | null) =>
        JSON.stringify([id, source, layer]);
      const set = async (
        id: string,
        state: Record<string, unknown>,
        source: string,
        layer: string | null
      ) => {
        const key = identity(id, source, layer);
        backend.set(key, { ...backend.get(key), ...state });
        return undefined;
      };
      const get = async (id: string, source: string, layer: string | null) =>
        backend.get(identity(id, source, layer)) ?? {};
      const remove = async (
        id: string,
        key: string | null,
        source: string,
        layer: string | null
      ) => {
        const target = identity(id, source, layer);
        if (key === null) backend.delete(target);
        else delete backend.get(target)?.[key];
        return undefined;
      };
      mockSetFeatureState.mockImplementation(set);
      mockGetFeatureState.mockImplementation(get);
      mockRemoveFeatureState.mockImplementation(remove);
      const ref = createRef<MapRef>();
      const scene = (revision: number, mapStyle = emptyStyle) => (
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={mapStyle}
            initialViewState={initialViewState}
          >
            {kind === "geojson" ? (
              <Source key={revision} id="routes" type="geojson" data={routes} />
            ) : (
              <Source
                key={revision}
                id="routes"
                type="vector"
                tiles={["https://example.com/{z}/{x}/{y}.pbf"]}
              />
            )}
          </OneMap>
        </MapSetup>
      );
      try {
        const mounted = await render(scene(0));
        const target = {
          source: "routes",
          id: 1,
          ...(kind === "vector" ? { sourceLayer: "way" } : {}),
        };
        await ref.current?.setFeatureState(target, {
          selected: true,
          count: 2,
        });
        await mounted.rerender(scene(1));
        expect(backend.size).toBe(1);
        const frameProps = () =>
          MapViewMock.mock.calls.at(-1)?.[0] as {
            onDidFinishRenderingFrameFully: () => void;
          };
        frameProps().onDidFinishRenderingFrameFully();
        await waitFor(() => expect(backend.size).toBe(0));
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({});
        expect(mockRemoveFeatureState).toHaveBeenCalledWith(
          "1",
          null,
          "routes",
          kind === "vector" ? "way" : null
        );
        await ref.current?.setFeatureState(target, { count: 3 });
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
          count: 3,
        });
        await mounted.rerender(scene(2));
        await ref.current?.setFeatureState(target, { selected: false });
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
          selected: false,
        });
        await mounted.rerender(scene(2, { ...emptyStyle }));
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
          selected: false,
        });
        await mounted.rerender(scene(2, replacementStyle));
        expect(backend.size).toBe(1);
        frameProps().onDidFinishRenderingFrameFully();
        await waitFor(() => expect(backend.size).toBe(0));
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({});
        await ref.current?.setFeatureState(target, { count: 4 });
        const mapProps = MapViewMock.mock.calls.at(-1)?.[0] as {
          onDidFinishLoadingStyle: () => void;
        };
        mapProps.onDidFinishLoadingStyle();
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({});
        await ref.current?.setFeatureState(target, { count: 5 });
        await expect(ref.current?.getFeatureState(target)).resolves.toEqual({
          count: 5,
        });
      } finally {
        mockSetFeatureState.mockImplementation(async () => undefined);
        mockGetFeatureState.mockImplementation(async () => ({
          selected: true,
        }));
        mockRemoveFeatureState.mockImplementation(async () => undefined);
      }
    }
  );

  test("queryRenderedFeaturesAtPoint receives reordered arguments", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    const features = await ref.current?.queryRenderedFeatures([240, 320], {
      layers: ["route-line"],
      filter: ["==", "kind", "route"],
    });

    expect(mockQueryRenderedFeaturesAtPoint).toHaveBeenCalledWith(
      [240, 320],
      ["==", "kind", "route"],
      ["route-line"]
    );
    expect(features).toHaveLength(2);
  });

  test("queryRenderedFeaturesInRect receives top, left, bottom, right", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.queryRenderedFeatures([
      [10, 20],
      [30, 40],
    ]);

    expect(mockQueryRenderedFeaturesInRect).toHaveBeenCalledWith(
      [20, 10, 40, 30],
      [],
      []
    );
  });

  test("an undefined target queries the visible area with an empty rect", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.queryRenderedFeatures(undefined);

    expect(mockQueryRenderedFeaturesInRect).toHaveBeenCalledWith([], [], []);
  });

  test("an absent rendered result rejects", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    mockQueryRenderedFeaturesAtPoint.mockImplementationOnce(
      async () => undefined
    );

    await expect(ref.current?.queryRenderedFeatures([1, 2])).rejects.toThrow(
      "queryRenderedFeatures returned no result."
    );
  });

  test("querySourceFeatures forwards source, filter, and source layers", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.querySourceFeatures("routes", {
      sourceLayer: "way",
      filter: ["==", "kind", "route"],
    });

    expect(mockQuerySourceFeatures).toHaveBeenCalledWith(
      "routes",
      ["==", "kind", "route"],
      ["way"]
    );
  });

  test("cluster methods dispatch through the registered ShapeSource", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.getClusterExpansionZoom("routes", 7)
    ).resolves.toBe(13);
    expect(mockGetClusterExpansionZoom).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { cluster: true, cluster_id: 7 } })
    );

    await expect(
      ref.current?.getClusterLeaves("routes", 7, 10, 2)
    ).resolves.toHaveLength(2);
    expect(mockGetClusterLeaves).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { cluster: true, cluster_id: 7 } }),
      10,
      2
    );

    await expect(
      ref.current?.getClusterChildren("routes", 7)
    ).resolves.toHaveLength(2);
  });

  test("cluster methods reject for an unmounted source", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.getClusterExpansionZoom("unknown", 7)
    ).rejects.toThrow('Source "unknown" is not a mounted GeoJSON Source');
  });

  test("a ref captured before unmount stops dispatching after remount", async () => {
    const firstRef = createRef<MapRef>();
    const rendered = await render(example(firstRef));
    const firstHandle = firstRef.current;

    expect(firstHandle).not.toBeNull();
    await rendered.unmount();

    // The stale handle from the unmounted map cannot reach the fresh
    // registry a remounted map owns, so its source is gone.
    const second = await render(example());

    await expect(
      firstHandle?.getClusterLeaves("routes", 7, 10, 0)
    ).rejects.toThrow('Source "routes" is not a mounted GeoJSON Source');

    await second.unmount();
  });

  test("setFeatureState forwards positional arguments", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.setFeatureState(
      { source: "routes", id: 9, sourceLayer: "way" },
      { selected: true }
    );

    expect(mockSetFeatureState).toHaveBeenCalledWith(
      "9",
      { selected: true },
      "routes",
      "way"
    );
  });

  test("setFeatureState rejects sparse arrays before native dispatch", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: 9 },
        // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
        { meta: { values: new Array<number>(1) } }
      )
    ).rejects.toThrow('Feature state key "meta"');
    expect(mockSetFeatureState).not.toHaveBeenCalled();
  });

  test("setFeatureState rejects non-JSON state", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: 9 },
        { selected: null as unknown as boolean }
      )
    ).rejects.toThrow('Feature state key "selected"');
    expect(mockSetFeatureState).not.toHaveBeenCalled();
  });

  test("getFeatureState normalizes a missing state to an empty object", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    mockGetFeatureState.mockImplementationOnce(async () => null);

    await expect(
      ref.current?.getFeatureState({ source: "routes", id: "route-1" })
    ).resolves.toEqual({});
    expect(mockGetFeatureState).toHaveBeenCalledWith("route-1", "routes", null);
  });

  test("removeFeatureState passes null without a key and the key with one", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));
    await ref.current?.removeFeatureState({ source: "routes", id: "route-1" });
    await ref.current?.removeFeatureState(
      { source: "routes", id: "route-1" },
      "selected"
    );

    expect(mockRemoveFeatureState).toHaveBeenNthCalledWith(
      1,
      "route-1",
      null,
      "routes",
      null
    );
    expect(mockRemoveFeatureState).toHaveBeenNthCalledWith(
      2,
      "route-1",
      "selected",
      "routes",
      null
    );
  });

  test("feature identifiers without a source are rejected", async () => {
    const ref = createRef<MapRef>();

    await render(example(ref));

    await expect(
      ref.current?.getFeatureState({ source: "", id: 1 })
    ).rejects.toThrow("nonempty string");
  });
});

test("native fitBounds maxZoom rejects before camera dispatch", async () => {
  const ref = createRef<MapRef>();
  await render(example(ref));
  mockSetCamera.mockClear();
  await expect(
    ref.current?.fitBounds(
      [
        [-123, 47],
        [-122, 48],
      ],
      { maxZoom: 12 }
    )
  ).rejects.toThrow("pinned native camera wrapper");
  expect(mockSetCamera).not.toHaveBeenCalled();
});
