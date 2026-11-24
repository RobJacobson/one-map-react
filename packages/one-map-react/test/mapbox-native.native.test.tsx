import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createRef, type ComponentRef, type ReactNode, type Ref } from "react";
import { Platform } from "react-native";

import {
  clusteredPoints,
  emptyStyle,
  initialViewState,
  replacementStyle,
  routes,
} from "../../example-map/src/scenarios/map-fixture.js";
import type { ViewState } from "../src/contracts/camera-types.js";
import type { LayerProps, LayerType } from "../src/contracts/layer-types.js";
import { testNativeCamera } from "./native-camera-cases.js";
import { testNativeEntryBinding } from "./native-entry-binding.js";
import { testNativeRendering } from "./native-rendering-cases.js";

const mockSetCamera = jest.fn();
const mockGetCenter = jest.fn(async () => [-122.34, 47.61]);
const mockTerrainElevation = jest.fn<() => Promise<number | null>>(
  async () => 0
);
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
const mockQueryRenderedFeaturesAtPoint = jest.fn<
  (point: number[], filter: unknown[], layers: string[]) => Promise<unknown>
>(async () => queryCollection);
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
    jest.fn((props: object) =>
      React.createElement(name, { ...props, testID: name })
    );

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
          queryTerrainElevation: mockTerrainElevation,
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
    Terrain: layerComponent("Terrain"),
    Light: layerComponent("Light"),
    HillshadeLayer: layerComponent("HillshadeLayer"),
    BackgroundLayer: layerComponent("BackgroundLayer"),
    FillLayer: layerComponent("FillLayer"),
    LineLayer: layerComponent("LineLayer"),
    CircleLayer: layerComponent("CircleLayer"),
    SymbolLayer: layerComponent("SymbolLayer"),
    RasterLayer: layerComponent("RasterLayer"),
    HeatmapLayer: layerComponent("HeatmapLayer"),
    FillExtrusionLayer: layerComponent("FillExtrusionLayer"),
    Images: jest.fn((props: object) =>
      React.createElement("Images", { ...props, testID: "wrapper-images" })
    ),
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
  ShapeSource,
  SymbolLayer,
  VectorSource,
} from "@rnmapbox/maps";
import {
  Terrain as RnTerrain,
  Light as RnLight,
  HillshadeLayer as RnHillshade,
} from "@rnmapbox/maps";

import {
  Layer,
  MapProvider,
  Source,
  useMap,
  type MapProps,
  type MapRef,
  MapboxGestureSettings,
  Map as NativeMap,
  type NativeAdvancedMapRef,
} from "../src/mapbox-native.js";
import * as nativeEntry from "../src/mapbox-native.js";

const MapViewMock = MapView as unknown as jest.Mock;
const LineLayerMock = LineLayer as unknown as jest.Mock;
const ShapeSourceMock = ShapeSource as unknown as jest.Mock;
const VectorSourceMock = VectorSource as unknown as jest.Mock;
const RasterSourceMock = RasterSource as unknown as jest.Mock;
const RasterDemSourceMock = RasterDemSource as unknown as jest.Mock;
const ImageSourceMock = ImageSource as unknown as jest.Mock;
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

test.each(["document", "url"] as const)(
  "common %s styles clear conflicting selected style fields through replacement",
  async (initial) => {
    const styleURL = "https://example.test/common-style.json";
    const styles =
      initial === "document"
        ? [emptyStyle, styleURL, replacementStyle]
        : [styleURL, emptyStyle, styleURL];
    const tree = (mapStyle: MapProps["mapStyle"]) => (
      <NativeMap
        mapStyle={mapStyle}
        initialViewState={initialViewState}
        // Exercise raw runtime options outside the narrowed TypeScript surface.
        options={
          {
            styleURL: "https://example.test/selected.json",
            styleJSON: JSON.stringify(replacementStyle),
          } as unknown as MapProps["options"]
        }
      />
    );
    const view = await render(tree(styles[0]));
    for (const mapStyle of styles) {
      await view.rerender(tree(mapStyle));
      const forwarded = lastMapProps<{
        styleURL?: string;
        styleJSON?: string;
      }>();
      expect(forwarded.styleURL).toBe(
        typeof mapStyle === "string" ? mapStyle : undefined
      );
      expect(forwarded.styleJSON).toBe(
        typeof mapStyle === "string" ? undefined : JSON.stringify(mapStyle)
      );
    }
    await view.unmount();
  }
);

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

test("forwards selected label localization to RNMapbox", async () => {
  const localizeLabels = { locale: "es", layerIds: ["place-label"] };
  await render(example(undefined, undefined, { options: { localizeLabels } }));

  expect(lastMapProps<MapProps["options"]>()?.localizeLabels).toBe(
    localizeLabels
  );
  expect(nativeEntry.WrapperMapView).toBe(MapView);
});

test("NativeMapProps options accepts valid RNMapbox options", () => {
  // Rejection of facade-owned keys cannot be asserted offline: under NodeNext
  // the RNMapbox declarations resolve to any. tests/package/peers.test.mjs asserts
  // it against the real packed types.
  const validOptions: MapProps["options"] = {
    scaleBarEnabled: true,
    projection: "mercator",
    gestureSettings: { quickZoomEnabled: false },
  };
  expect(validOptions).toBeDefined();
});

describe("mapbox-native adapter", () => {
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
      mockSetCamera.mockClear();
      const view = await render(scene(emptyStyle));
      const retained = access === "selected" ? ref.current : observed;
      if (!retained) throw new Error("Map ref was not attached.");
      expect(
        Reflect.get(ref.current ?? {}, "setSourceVisibility")
      ).toBeUndefined();
      const getWrapperMap = retained.getWrapperMap;
      const first = getWrapperMap();
      expect(first).toBeInstanceOf(Promise);
      const original = await first;
      const attachedMap = () =>
        lastMapProps<{
          ref: { current: ComponentRef<typeof MapView> | null };
        }>().ref.current;
      expect(original).toBe(attachedMap());
      expect(original.getCenter).toBe(mockGetCenter);
      expect(loaded).not.toHaveBeenCalled();
      expect(mockSetCamera).not.toHaveBeenCalled();
      await expect(retained.getCenter()).resolves.toEqual([-122.34, 47.61]);
      const mapId = view.getByTestId("wrapper-map").props.mapId;

      await view.rerender(scene(replacementStyle));
      const replacement = await getWrapperMap();
      expect(replacement).toBe(attachedMap());
      expect(replacement).not.toBe(original);
      expect(view.getByTestId("wrapper-map").props.mapId).toBe(mapId);
      await expect(retained.getWrapperMap()).resolves.toBe(replacement);
      await retained.flyTo({ center: [1, 2], zoom: 3 });
      expect(mockSetCamera).toHaveBeenCalledTimes(1);
      await expect(Promise.resolve(retained)).resolves.toBe(retained);

      await view.unmount();
      const detached = getWrapperMap();
      expect(detached).toBeInstanceOf(Promise);
      await expect(detached).rejects.toThrow("Map is not attached.");
      await expect(retained.getWrapperMap()).rejects.toThrow(
        "Map is not attached."
      );
      await expect(Promise.resolve(retained)).resolves.toBe(retained);
    }
  );

  test("Android locks and restores gestures through scalar native props", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    const scene = (interactive: boolean) => (
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        interactive={interactive}
      />
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
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          interactive={interactive}
          options={{ zoomEnabled }}
        />
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
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          interactive={interactive}
          doubleTapZoom={doubleTapZoom}
        />
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
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          options={{
            scaleBarPosition: { top, left: 8 },
            scaleBarEnabled: enabled,
          }}
        />
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
          if (os === "android") expect(commits).toHaveLength(1);
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

  test("Android scale position and host layout updates avoid follow-up MapView renders", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    const scene = (top: number) => (
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        hostProps={{ testID: "android-scale-host" }}
        options={{
          scaleBarPosition: { top, left: 8 },
          scaleBarEnabled: true,
        }}
      />
    );
    try {
      const beforeMount = MapViewMock.mock.calls.length;
      const view = await render(scene(8));
      expect(MapViewMock.mock.calls.length - beforeMount).toBe(1);

      const beforePosition = MapViewMock.mock.calls.length;
      await view.rerender(scene(56));
      expect(MapViewMock.mock.calls.length - beforePosition).toBe(1);
      expect(
        lastMapProps<{
          scaleBarPosition: object;
          scaleBarEnabled: boolean;
        }>()
      ).toMatchObject({
        scaleBarPosition: { top: 56, left: 8 },
        scaleBarEnabled: true,
      });

      const beforeLayout = MapViewMock.mock.calls.length;
      await fireEvent(view.getByTestId("android-scale-host"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 237 } },
      });
      expect(MapViewMock.mock.calls.length - beforeLayout).toBeLessThanOrEqual(
        1
      );
      expect(lastMapProps<{ scaleBarEnabled: boolean }>().scaleBarEnabled).toBe(
        true
      );

      await view.unmount();
    } finally {
      platform.restore();
    }
  });

  test("iOS keeps scale position key synchronized while scaleBarEnabled is false", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "ios");
    const scene = (top: number, enabled: boolean) => (
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        options={{
          scaleBarPosition: { top, left: 8 },
          scaleBarEnabled: enabled,
        }}
      />
    );
    try {
      const view = await render(scene(8, false));
      await view.rerender(scene(56, false));
      const beforeEnable = MapViewMock.mock.calls.length;
      await view.rerender(scene(56, true));
      const commits = MapViewMock.mock.calls
        .slice(beforeEnable)
        .map(([props]) => props as { scaleBarEnabled: boolean });
      expect(commits).toHaveLength(1);
      expect(commits[0]?.scaleBarEnabled).toBe(true);
      await view.unmount();
    } finally {
      platform.restore();
    }
  });

  test("iOS layout changes reapply unchanged scale margins without remounting", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "ios");
    try {
      const view = await render(
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          hostProps={{ testID: "scale-layout-host" }}
          options={{
            scaleBarPosition: { top: 96, left: 8 },
            scaleBarEnabled: true,
          }}
        />
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

    await act(async () => props.onDidFinishLoadingMap());
    props.onDidFinishLoadingStyle();
    props.onMapLoadingError();
    // Preserve the wrapper error without exposing its optional tile and source IDs.
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
    await act(async () => props.onDidFinishLoadingMap());
    props.onDidFinishLoadingStyle();
    props.onMapLoadingError({ error: "later" });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onStyleLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(2);
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
        touchZoomRotate: true,
        touchZoom: false,
        doubleTapZoom: true,
      })
    );

    expect(lastMapProps<object>()).toEqual(
      expect.objectContaining({
        scrollEnabled: false,
        zoomEnabled: false,
        rotateEnabled: true,
        gestureSettings: {
          doubleTapToZoomInEnabled: true,
          doubleTouchToZoomOutEnabled: true,
        },
      })
    );
  });

  test("Mapbox camera props apply without animation and preserve initial defaults", async () => {
    const rendered = await render(
      example(undefined, undefined, {
        viewState: { ...initialViewState, zoom: 12 },
      })
    );

    expect(rendered.getByTestId("wrapper-camera").props).toEqual(
      expect.objectContaining({
        animationMode: "none",
        animationDuration: 0,
      })
    );

    await rendered.rerender(
      example(undefined, undefined, {
        viewState: { ...initialViewState, zoom: 13 },
      })
    );

    expect(
      rendered.getByTestId("wrapper-camera").props.defaultSettings.zoomLevel
    ).toBe(initialViewState.zoom);
  });

  test("the first idle reports onMove once, then onMoveEnd and onIdle", async () => {
    const report = jest.fn();
    const onMove = () => report("onMove");
    const onMoveEnd = () => report("onMoveEnd");
    const onIdle = () => report("onIdle");

    await render(example(undefined, onMove, { onMoveEnd, onIdle }));
    const props = lastMapProps<{
      onMapIdle: (state: object) => void;
    }>();

    const state = {
      properties: {
        center: [-122.34, 47.61],
        bounds: { sw: [-123, 47] },
        zoom: 11,
        heading: 0,
        pitch: 0,
      },
      gestures: { isGestureActive: false },
    };
    await act(async () => {
      props.onMapIdle(state);
      props.onMapIdle(state);
    });

    expect(report.mock.calls).toEqual([
      ["onMove"],
      ["onMoveEnd"],
      ["onIdle"],
      ["onMoveEnd"],
      ["onIdle"],
    ]);
  });

  test.each(["success", "failure", "unmount"] as const)(
    "filtered map press queries its logical point and retains %s semantics",
    async (outcome) => {
      const onClick = jest.fn();
      const onError = jest.fn();
      let resolve!: (value: typeof queryCollection) => void;
      let reject!: (error: Error) => void;
      mockQueryRenderedFeaturesAtPoint.mockImplementationOnce(
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
          geometry: { coordinates: [-122.34, 47.61] },
          properties: { screenPointX: 23, screenPointY: 41 },
        })
      );
      expect(mockQueryRenderedFeaturesAtPoint).toHaveBeenLastCalledWith(
        [23, 41],
        [],
        ["upper", "lower"]
      );
      if (outcome === "unmount") await view.unmount();
      const error = new Error("native feature query failed");
      await act(async () => {
        if (outcome === "failure") reject(error);
        else resolve(queryCollection);
      });
      if (outcome === "success") {
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith({
          lngLat: [-122.34, 47.61],
          point: [23, 41],
          features: queryCollection.features,
        });
      } else expect(onClick).not.toHaveBeenCalled();
      if (outcome === "failure")
        expect(onError).toHaveBeenCalledWith({ error });
      else expect(onError).not.toHaveBeenCalled();
    }
  );

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

  test("portable double tap overrides context while context overrides selected options", async () => {
    await render(
      <MapboxGestureSettings
        settings={{ quickZoomEnabled: true, doubleTapToZoomInEnabled: false }}
      >
        {example(undefined, undefined, {
          doubleTapZoom: true,
          options: {
            gestureSettings: {
              pinchZoomEnabled: false,
              quickZoomEnabled: false,
            },
          },
        })}
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
  <NativeMap
    mapStyle={emptyStyle}
    initialViewState={initialViewState}
    style={{ flex: 1 }}
  >
    {children}
  </NativeMap>
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

  test("a raster source forwards tile options and child layers", async () => {
    const view = await render(
      tree(
        <Source
          id="imagery"
          type="raster"
          url="https://example.com/imagery.json"
          minzoom={0}
          maxzoom={16}
          tileSize={256}
          scheme="xyz"
          attribution="Example"
        >
          <Layer id="imagery-layer" type="raster" />
        </Source>
      )
    );

    expect(RasterSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "imagery",
        url: "https://example.com/imagery.json",
        tileUrlTemplates: undefined,
        minZoomLevel: 0,
        maxZoomLevel: 16,
        tileSize: 256,
        tms: false,
        attribution: "Example",
      }),
      undefined
    );
    expect(view.getByTestId("RasterLayer").props.sourceID).toBe("imagery");
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

    expect(RasterDemSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "terrain",
        url: "https://example.com/terrain.json",
        maxZoomLevel: 14,
        tileSize: 512,
      }),
      undefined
    );
    const wrapperProps = RasterDemSourceMock.mock.lastCall?.[0];
    expect(wrapperProps).not.toHaveProperty("tms");
    expect(wrapperProps).not.toHaveProperty("attribution");
  });

  test("geojson cluster options and promoteId forward under wrapper names", async () => {
    ShapeSourceMock.mockClear();
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
          promoteId="route"
        />
      )
    );

    expect(ShapeSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "points",
        shape: clusteredPoints,
        cluster: true,
        clusterRadius: 50,
        clusterMinPoints: 3,
        clusterMaxZoomLevel: 12,
        maxZoomLevel: 14,
        lineMetrics: true,
        promoteId: "route",
      }),
      undefined
    );
  });

  test("geojson clusterMinPoints and promoteId forward falsy values and data updates", async () => {
    ShapeSourceMock.mockClear();
    const updatedPoints = { ...clusteredPoints, features: [] };
    const view = await render(
      tree(
        <Source
          id="points"
          type="geojson"
          data={clusteredPoints}
          cluster
          clusterMinPoints={0}
          promoteId=""
        />
      )
    );

    expect(ShapeSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "points",
        shape: clusteredPoints,
        clusterMinPoints: 0,
        promoteId: "",
      }),
      undefined
    );

    await view.rerender(
      tree(
        <Source
          id="points"
          type="geojson"
          data={updatedPoints}
          cluster
          clusterMinPoints={0}
          promoteId=""
        />
      )
    );
    expect(ShapeSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "points",
        shape: updatedPoints,
        clusterMinPoints: 0,
        promoteId: "",
      }),
      undefined
    );
  });

  test("generateId is rejected", async () => {
    await expect(
      render(tree(<Source id="a" type="geojson" data={routes} generateId />))
    ).rejects.toThrow("generateId is not available on mapbox-native.");
    await expect(
      render(
        tree(<Source id="b" type="geojson" data={routes} generateId={false} />)
      )
    ).rejects.toThrow("generateId is not available on mapbox-native.");
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

  test("line conversion forwards wrapper-validated properties and preserves expressions and resets", async () => {
    const color = ["get", "color"] as const;
    const paint = Object.freeze({
      "line-color": color,
      "line-width": 0,
      "line-emissive-strength": 0.5,
      "line-color-transition": { duration: 200 },
    });
    const layout = Object.freeze({ "line-cap": "round", visibility: "none" });
    const scene = (removed: boolean) =>
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="line"
            type="line"
            paint={removed ? { "line-color": undefined } : paint}
            layout={removed ? undefined : layout}
          />
        </Source>
      );
    const view = await render(scene(false));
    const current = LineLayerMock.mock.calls.at(-1)?.[0] as {
      style: Record<string, unknown>;
    };
    expect(current.style).toEqual({
      lineColor: color,
      lineWidth: 0,
      lineEmissiveStrength: 0.5,
      lineColorTransition: { duration: 200 },
      lineCap: "round",
      visibility: "none",
    });
    expect(current.style.lineColor).toBe(color);
    await view.rerender(scene(true));
    expect(LineLayerMock.mock.calls.at(-1)?.[0]).toMatchObject({ style: {} });
    await view.unmount();
  });

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
    const expression = [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      1,
      10,
      4,
    ] as const;

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
    "%s state lifetime belongs to the renderer across remounts, family changes and styles",
    async (initialKind) => {
      let state: Record<string, unknown> = {};
      mockSetFeatureState.mockImplementation(async (_id, value) => {
        state = { ...state, ...value };
      });
      mockGetFeatureState.mockImplementation(async () => state);
      mockRemoveFeatureState.mockImplementation(async (_id, key) => {
        if (key === null) state = {};
        else delete state[key];
      });
      const ref = createRef<MapRef>();
      const scene = (
        kind: "geojson" | "vector",
        revision: number,
        mapStyle = emptyStyle
      ) => (
        <NativeMap
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
              url="mapbox://tiles"
            />
          )}
        </NativeMap>
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
          count: 2,
        });
        const otherKind = initialKind === "geojson" ? "vector" : "geojson";
        for (const [revision, kind] of (
          [initialKind, otherKind, initialKind] as const
        ).entries()) {
          await mounted.rerender(scene(kind, revision + 1, replacementStyle));
          const props = lastMapProps<{
            onDidFinishLoadingStyle: () => void;
          }>();
          await act(async () => {
            props.onDidFinishLoadingStyle();
          });
          await expect(
            ref.current?.getFeatureState(target(kind))
          ).resolves.toEqual({ selected: true, count: 2 });
          expect(mockRemoveFeatureState).not.toHaveBeenCalled();
        }
        await ref.current?.removeFeatureState(target(initialKind), "selected");
        await expect(
          ref.current?.getFeatureState(target(initialKind))
        ).resolves.toEqual({ count: 2 });
        await ref.current?.removeFeatureState(target(initialKind));
        await expect(
          ref.current?.getFeatureState(target(initialKind))
        ).resolves.toEqual({});
        expect(mockRemoveFeatureState).toHaveBeenCalledTimes(2);
      } finally {
        mockSetFeatureState.mockImplementation(async () => undefined);
        mockGetFeatureState.mockImplementation(async () => ({
          selected: true,
        }));
        mockRemoveFeatureState.mockImplementation(async () => undefined);
      }
    }
  );

  test("queryRenderedFeaturesAtPoint receives finite coordinates and reordered arguments", async () => {
    const ref = createRef<MapRef>();
    const layers = ["route-line"] as const;
    const point: [number, number] = [240, 320];
    let xReads = 0;
    Object.defineProperty(point, 0, {
      get: () => {
        xReads += 1;
        return xReads === 1 ? 240 : NaN;
      },
    });

    await render(example(ref));
    const features = await ref.current?.queryRenderedFeatures(point, {
      layers,
      filter: ["==", "kind", "route"],
    });

    expect(mockQueryRenderedFeaturesAtPoint).toHaveBeenLastCalledWith(
      [240, 320],
      ["==", "kind", "route"],
      ["route-line"]
    );
    expect(mockQueryRenderedFeaturesAtPoint.mock.lastCall?.[2]).not.toBe(
      layers
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

    const map = ref.current;
    const source = map?.getSource("routes");
    if (!map || !source) throw new Error("Expected a mounted GeoJSON source.");
    expect(map.getSource("unknown")).toBeUndefined();

    await expect(source.getClusterExpansionZoom(7)).resolves.toBe(13);
    expect(mockGetClusterExpansionZoom).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { cluster: true, cluster_id: 7 } })
    );

    await expect(source.getClusterLeaves(7, 10, 2)).resolves.toHaveLength(2);
    expect(mockGetClusterLeaves).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { cluster: true, cluster_id: 7 } }),
      10,
      2
    );

    await expect(source.getClusterChildren(7)).resolves.toHaveLength(2);
    expect(mockGetClusterChildren).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { cluster: true, cluster_id: 7 } })
    );

    mockGetClusterExpansionZoom.mockResolvedValueOnce(Infinity);
    await expect(source.getClusterExpansionZoom(7)).rejects.toThrow(
      "Cluster expansion zoom must be a finite number."
    );
  });

  test("a ref captured before unmount stops dispatching after remount", async () => {
    const firstRef = createRef<MapRef>();
    const rendered = await render(example(firstRef));
    const firstHandle = firstRef.current;

    const firstSource = firstHandle?.getSource("routes");
    if (!firstHandle || !firstSource) {
      throw new Error("Expected a mounted GeoJSON source.");
    }
    await rendered.unmount();

    const secondRef = createRef<MapRef>();
    const second = await render(example(secondRef));
    expect(secondRef.current?.getSource("routes")).toBeDefined();
    expect(firstHandle.getSource("routes")).toBeUndefined();
    await expect(firstSource.getClusterLeaves(7, 10, 0)).rejects.toThrow(
      'Source "routes" is no longer mounted.'
    );

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

test("terrain/light/projection and hillshade use native public components, including zero and explicit disable", async () => {
  const ref = createRef<MapRef>();
  const mounted = await render(
    <NativeMap
      ref={ref}
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      terrain={null}
      projection="globe"
      light={{
        intensity: 0,
        position: [1, 2, 3],
        "intensity-transition": { duration: 0 },
      }}
    >
      <Layer
        id="shade"
        type="hillshade"
        paint={{
          "hillshade-exaggeration": 0,
          "hillshade-shadow-color": "#000000",
        }}
      />
    </NativeMap>
  );
  expect(lastRenderingProps(RnTerrain).sourceID).toBeUndefined();
  expect(lastRenderingProps(RnLight).style).toMatchObject({
    intensity: 0,
    position: [1, 2, 3],
    intensityTransition: { duration: 0 },
  });
  expect(lastRenderingProps(RnHillshade).style).toMatchObject({
    hillshadeExaggeration: 0,
    hillshadeShadowColor: "#000000",
  });
  expect(lastMapProps<{ projection: string }>().projection).toBe("globe");
  await expect(ref.current?.queryTerrainElevation([0, 0])).resolves.toBe(0);
  mockTerrainElevation.mockResolvedValueOnce(null);
  await expect(ref.current?.queryTerrainElevation([0, 0])).resolves.toBeNull();
  mockTerrainElevation.mockRejectedValueOnce(new Error("bridge failure"));
  await expect(ref.current?.queryTerrainElevation([0, 0])).rejects.toThrow(
    "bridge failure"
  );
  await mounted.rerender(
    <NativeMap
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      terrain={{ source: "disabled", exaggeration: 0 }}
    />
  );
  expect(lastRenderingProps(RnTerrain)).toMatchObject({
    sourceID: "disabled",
    style: { exaggeration: 0 },
  });
  await mounted.rerender(
    <NativeMap
      mapStyle={replacementStyle}
      initialViewState={initialViewState}
      terrain={null}
    />
  );
  expect(lastRenderingProps(RnTerrain).sourceID).toBeUndefined();
  await mounted.unmount();
});

const lastRenderingProps = (component: unknown): Record<string, unknown> =>
  (component as jest.Mock).mock.calls.at(-1)?.[0] as Record<string, unknown>;

test("selected native location follow rejects a simultaneous viewState target", async () => {
  await expect(
    render(
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        viewState={initialViewState}
        locationOptions={{
          followUserLocation: true,
          followHeading: undefined,
          followPitch: undefined,
          followUserMode: undefined,
          followZoomLevel: undefined,
          onUserTrackingModeChange: undefined,
        }}
      />
    )
  ).rejects.toThrow("Selected location follow conflicts with viewState.");
});

describe("mapbox-native entry binding", () => {
  testNativeCamera(nativeEntry.Map, {
    captureEvents: () => {
      const { onCameraChanged, onMapIdle } = lastMapProps<{
        onCameraChanged(event: object): void;
        onMapIdle(event: object): void;
      }>();
      const payload = (
        { longitude, latitude, zoom, bearing, pitch }: ViewState,
        isGestureActive: boolean,
        bounds?: readonly [number, number, number, number]
      ) => ({
        properties: {
          center: [longitude, latitude],
          zoom,
          heading: bearing,
          pitch,
          bounds: bounds && {
            sw: [bounds[0], bounds[1]],
            ne: [bounds[2], bounds[3]],
          },
        },
        gestures: { isGestureActive },
      });
      return {
        move: (viewState, isGestureActive, bounds) =>
          onCameraChanged(payload(viewState, isGestureActive, bounds)),
        settle: (viewState, bounds) =>
          onMapIdle(payload(viewState, false, bounds)),
      };
    },
    jump: mockSetCamera,
    centerProp: "centerCoordinate",
    zoomProp: "zoomLevel",
    bearingProp: "heading",
    getZoom: mockGetZoom,
    project: mockGetPointInView,
  });
  testNativeRendering(nativeEntry, "mapbox-native", {
    map: MapViewMock,
    image: ImageSourceMock,
    geojson: ShapeSourceMock,
    raster: RasterSourceMock,
  });

  testNativeEntryBinding(
    nativeEntry,
    "mapbox-native",
    {
      geometry: { coordinates: [-122.34, 47.61] },
      properties: { screenPointX: 23, screenPointY: 41 },
    },
    () => {
      let complete: () => void = () => {
        throw new Error("Rendered query was never dispatched.");
      };
      mockQueryRenderedFeaturesAtPoint.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = () => resolve(queryCollection);
          })
      );
      return () => complete();
    },
    mockGetClusterExpansionZoom,
    () =>
      expect(LineLayerMock.mock.lastCall?.[0]).toMatchObject({
        sourceID: "routes",
        style: { lineWidth: 3 },
      })
  );
});
