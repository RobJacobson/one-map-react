import { expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import {
  type ComponentType,
  createRef,
  forwardRef,
  type ReactNode,
  type RefAttributes,
  useLayoutEffect,
} from "react";
import { Text } from "react-native";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../example-map/src/scenarios/map-fixture.js";
import type { NativeBackend } from "../src/contracts/backend.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { LayerProps, SymbolLayout } from "../src/contracts/layer-types.js";
import type {
  NativeClickEvent,
  NativeMapInputs,
  NativeMapRef,
} from "../src/contracts/native-types.js";
import type { SourceProps } from "../src/contracts/source-types.js";
import type { MarkerRef } from "../src/contracts/ui-types.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";
import { UserLocation } from "../src/native-extensions.js";

type SelectedHandle = NativeMapRef & { getWrapperMap(): Promise<unknown> };
type MarkerCoordinates = {
  readonly longitude: number;
  readonly latitude: number;
  readonly children?: ReactNode;
};
type MapLookup<Handle> = Readonly<Record<string, Handle | undefined>>;

interface NativeEntry<Handle extends SelectedHandle> {
  readonly Map: ComponentType<NativeMapInputs & RefAttributes<Handle>>;
  readonly MapProvider: ComponentType<{ readonly children?: ReactNode }>;
  readonly Source: ComponentType<SourceProps>;
  readonly Layer: ComponentType<LayerProps>;
  readonly Marker: ComponentType<MarkerCoordinates & RefAttributes<MarkerRef>>;
  useMap(): MapLookup<Handle>;
}

type WrapperEvents = {
  onDidFinishLoadingMap(): void;
  onPress(event: object): void;
};

/**
 * Tests the selected entry using its actual wrapper mocks.
 *
 * @param entry - Native entry under test.
 * @param backend - SDK represented by this entry.
 * @param press - The selected wrapper's press payload.
 * @param beginPressQuery - Fakes a pending rendered-feature query and returns its completion.
 * @param clusterZoom - Mock cluster call exposed by mounted source refs.
 * @param checkLayer - Verifies style conversion and source injection on the wrapper layer.
 */
export const testNativeEntryBinding = <Handle extends SelectedHandle>(
  entry: NativeEntry<Handle>,
  backend: NativeBackend,
  press: object,
  beginPressQuery: () => () => void,
  clusterZoom: jest.Mock<(...args: never[]) => Promise<number>>,
  checkLayer: () => void
): void => {
  const { Map: NativeMap, MapProvider, Source, Layer, Marker, useMap } = entry;

  test("maps the desktop touchZoomRotate flag to both native gestures", async () => {
    const view = await render(
      <NativeMap mapStyle={emptyStyle} touchZoomRotate={false} />
    );
    const gestureProps = () => view.getByTestId("wrapper-map").props;
    const zoom = backend === "mapbox-native" ? "zoomEnabled" : "touchZoom";
    const rotate =
      backend === "mapbox-native" ? "rotateEnabled" : "touchRotate";
    expect(gestureProps()[zoom]).toBe(false);
    expect(gestureProps()[rotate]).toBe(false);
    await view.rerender(
      <NativeMap mapStyle={emptyStyle} touchZoomRotate touchRotate={false} />
    );
    expect(gestureProps()[zoom]).toBe(true);
    expect(gestureProps()[rotate]).toBe(false);
  });

  test.each([
    { "icon-overlap": "always" },
    { "text-overlap": "always" },
    { "text-variable-anchor-offset": ["top", [0, 1]] },
  ] as const)("rejects unsupported native symbol layout %j", async (layout) => {
    const [field] = Object.keys(layout);
    await expect(
      render(<Layer id="symbol" type="symbol" layout={layout} />)
    ).rejects.toThrow(`${field} is not available on ${backend}.`);
  });

  test.each([
    { "icon-overlap": "always" },
    { "text-overlap": "always" },
  ] as const)(
    "rejects unsupported symbol layout %j nested under a source on mount and update",
    async (unsupported) => {
      const [field] = Object.keys(unsupported);
      const scene = (layout: SymbolLayout) => (
        <NativeMap mapStyle={emptyStyle} initialViewState={initialViewState}>
          <Source id="routes" type="geojson" data={routes}>
            <Layer id="labels" type="symbol" layout={layout} />
          </Source>
        </NativeMap>
      );
      const message = `${field} is not available on ${backend}.`;
      await expect(render(scene(unsupported))).rejects.toThrow(message);

      const valid: SymbolLayout = { "text-field": ["get", "name"] };
      const view = await render(scene(valid));
      await expect(
        view.rerender(scene({ ...valid, ...unsupported }))
      ).rejects.toThrow(message);
    }
  );

  test("treats undefined as unset and still rejects a falsy symbol option on update", async () => {
    const view = await render(
      <Layer id="symbol" type="symbol" layout={{ "text-overlap": undefined }} />
    );
    // Exercise a JavaScript value outside the style-spec types.
    const rawLayout = { "text-overlap": false } as unknown as SymbolLayout;
    await expect(
      view.rerender(<Layer id="symbol" type="symbol" layout={rawLayout} />)
    ).rejects.toThrow(`text-overlap is not available on ${backend}.`);
  });

  test("a new key permits creation changes while an update keeps the committed source layer", async () => {
    const scene = (id: string, sourceLayer: string) => (
      <Layer key={id} id={id} type="line" source-layer={sourceLayer} />
    );
    const view = await render(scene("routes", "road"));
    await view.rerender(scene("bridges", "bridge"));
    const testId = backend === "mapbox-native" ? "LineLayer" : "Layer";
    expect(view.getByTestId(testId).props.id).toBe("bridges");

    await expect(view.rerender(scene("bridges", "road"))).rejects.toThrow(
      'Layer "bridges" changed the creation option "source-layer".'
    );
  });

  test("supplied location updates keep its accuracy and dot layers mounted", async () => {
    const scene = (latitude: number) => (
      <NativeMap mapStyle={emptyStyle}>
        <UserLocation
          position={{ lngLat: [7, latitude], accuracy: 30 }}
          showAccuracyCircle
        />
      </NativeMap>
    );
    const view = await render(scene(8));
    const layerTestId = /^(FillLayer|CircleLayer|Layer)$/;
    const layers = view.getAllByTestId(layerTestId);
    expect(layers).toHaveLength(2);
    const [accuracy, dot] = layers;
    const sourceProp = backend === "mapbox-native" ? "sourceID" : "source";
    expect(accuracy.props[sourceProp]).toMatch(/^one-map-location-/);
    expect(dot.props[sourceProp]).toBe(accuracy.props[sourceProp]);

    await view.rerender(scene(9));
    const [updatedAccuracy, updatedDot] = view.getAllByTestId(layerTestId);
    expect(updatedAccuracy).toBe(accuracy);
    expect(updatedDot).toBe(dot);
  });

  test("binds a map, source, layer, and marker without setup", async () => {
    const ref = createRef<Handle>();
    const detach = jest.fn<() => void>(() => {
      ref.current = null;
    });
    const attach = jest.fn((map: Handle | null) => {
      ref.current = map;
      return detach;
    });
    const markerRef = createRef<MarkerRef>();
    const record = jest.fn<(maps: MapLookup<Handle>) => void>();
    const onLoad = jest.fn();
    const Probe = () => {
      const maps = useMap();
      useLayoutEffect(() => record(maps), [maps]);
      return null;
    };

    const view = await render(
      <NativeMap
        id="harbor"
        ref={attach}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        onLoad={onLoad}
      >
        <Source id="routes" type="geojson" data={routes} cluster>
          <Layer id="route-line" type="line" paint={{ "line-width": 3 }} />
        </Source>
        <Marker ref={markerRef} longitude={-122.34} latitude={47.61} />
        <Probe />
      </NativeMap>
    );

    const access = record.mock.lastCall?.[0];
    const handle = ref.current;
    if (!access?.current || !handle) {
      throw new Error("Expected both enclosing and forwarded handles.");
    }
    expect(access.harbor).toBeUndefined();
    expect(access["constructor"]).toBeUndefined();
    await expect(access.current.getWrapperMap()).resolves.toBe(
      await handle.getWrapperMap()
    );
    await expect(handle.getClusterExpansionZoom("routes", 7)).resolves.toBe(13);
    checkLayer();
    expect(markerRef.current).not.toBeNull();
    const wrapper = view.getByTestId("wrapper-map");
    const { onDidFinishLoadingMap } = wrapper.props as WrapperEvents;
    expect(view.getByTestId("native-marker-overlay").props.pointerEvents).toBe(
      "none"
    );
    await act(async () => onDidFinishLoadingMap());
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("native-marker-overlay").props.pointerEvents).toBe(
      "auto"
    );
    expect(attach).toHaveBeenCalledTimes(1);
    expect(detach).not.toHaveBeenCalled();
    await view.unmount();
    expect(detach).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeNull();
    expect(markerRef.current).toBeNull();
    expect(access.current.getSource("routes")).toBeUndefined();
    await expect(access.current.getWrapperMap()).rejects.toThrow(
      "not attached"
    );
    await act(async () => onDidFinishLoadingMap());
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  test("keeps named handles local to each provider and follows replacement", async () => {
    const named = jest.fn<(map: Handle | undefined) => void>();
    const defaultNamed = jest.fn<(map: Handle | undefined) => void>();
    const innerNamed = jest.fn<(map: Handle | undefined) => void>();
    const unexpected = (): never => {
      throw new Error("Selected components reached the foreign binding.");
    };
    const { MapProvider: ForeignProvider, useMap: useForeignMap } =
      createNativeMapBinding(forwardRef<MapRef, NativeMapInputs>(unexpected), {
        backend:
          backend === "mapbox-native" ? "maplibre-native" : "mapbox-native",
        Source: unexpected,
        Layer: unexpected,
        Images: unexpected,
        Marker: unexpected,
      });
    const ForeignProbe = () => {
      const maps = useForeignMap();
      expect(maps.default).toBeUndefined();
      expect(maps.current).toBeUndefined();
      return <Text>Foreign lookup</Text>;
    };
    const Probe = ({
      observe,
      id,
    }: {
      readonly observe: (handle: Handle | undefined) => void;
      readonly id: string;
    }) => {
      const maps = useMap();
      const map = maps[id];
      useLayoutEffect(() => observe(map), [map, observe]);
      expect(maps.current).toBeUndefined();
      return null;
    };
    const scene = (generation: number | null) => (
      <>
        <MapProvider>
          <Probe observe={named} id="harbor" />
          <Probe observe={defaultNamed} id="default" />
          {generation !== null && (
            <NativeMap
              id="harbor"
              key={generation}
              mapStyle={emptyStyle}
              initialViewState={initialViewState}
            >
              <Source id="routes" type="geojson" data={routes}>
                <Layer id="route-line" type="line" />
              </Source>
              <Marker longitude={-122.34} latitude={47.61}>
                <Text>Vessel</Text>
              </Marker>
            </NativeMap>
          )}
          <NativeMap
            mapStyle={emptyStyle}
            initialViewState={initialViewState}
          />
          <MapProvider>
            <Probe observe={innerNamed} id="harbor" />
            <NativeMap
              id="harbor"
              mapStyle={emptyStyle}
              initialViewState={initialViewState}
            />
          </MapProvider>
        </MapProvider>
        <ForeignProvider>
          <NativeMap mapStyle={emptyStyle}>
            <ForeignProbe />
          </NativeMap>
        </ForeignProvider>
      </>
    );

    const view = await render(scene(1));
    const old = named.mock.lastCall?.[0];
    const inner = innerNamed.mock.lastCall?.[0];
    const defaultMap = defaultNamed.mock.lastCall?.[0];
    expect(old).toBeDefined();
    expect(inner).toBeDefined();
    expect(defaultMap).toBeDefined();
    expect(view.getByText("Foreign lookup")).toBeDefined();
    expect(old).not.toBe(inner);
    expect(defaultMap).not.toBe(old);
    expect(view.getByText("Vessel")).toBeDefined();
    await view.rerender(scene(2));
    expect(named.mock.lastCall?.[0]).toBeDefined();
    expect(named.mock.lastCall?.[0]).not.toBe(old);
    await expect(old?.getWrapperMap()).rejects.toThrow("not attached");
    await view.rerender(scene(null));
    expect(named).toHaveBeenLastCalledWith(undefined);
    expect(innerNamed.mock.lastCall?.[0]).toBe(inner);
    expect(defaultNamed.mock.lastCall?.[0]).toBe(defaultMap);
  });

  test("maps desktop point and bounds fields, viewport queries, and style readiness", async () => {
    const ref = createRef<Handle>();
    const onStyleData = jest.fn();
    const view = await render(
      <NativeMap ref={ref} mapStyle={emptyStyle} onStyleData={onStyleData} />
    );
    const map = ref.current;
    if (!map) throw new Error("Map is detached.");

    const center = await map.getCenter();
    expect([center.lng, center.lat]).toEqual(center);
    const point = await map.project({ lng: center.lng, lat: center.lat });
    expect([point.x, point.y]).toEqual(point);
    const unprojected = await map.unproject({ x: point.x, y: point.y });
    expect(unprojected.lng).toBe(unprojected[0]);
    const bounds = await map.getBounds();
    expect(bounds.toArray()).toEqual(bounds);
    expect(bounds.getWest()).toBe(bounds[0][0]);
    expect(bounds.getNorthEast().lat).toBe(bounds[1][1]);
    await expect(
      map.queryRenderedFeatures({ layers: ["route-line"] })
    ).resolves.toBeDefined();
    await expect(
      map.queryRenderedFeatures({ x: 3, y: 4 })
    ).resolves.toBeDefined();
    await expect(
      map.queryRenderedFeatures([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ])
    ).resolves.toBeDefined();

    const { onDidFinishLoadingStyle } = view.getByTestId("wrapper-map")
      .props as { onDidFinishLoadingStyle(): void };
    expect(onStyleData).not.toHaveBeenCalled();
    await act(async () => onDidFinishLoadingStyle());
    expect(onStyleData).toHaveBeenCalledTimes(1);
  });

  test("an explicit empty layer list matches no layers on an attached map", async () => {
    const ref = createRef<Handle>();
    const onClick = jest.fn<(event: NativeClickEvent) => void>();
    const view = await render(
      <NativeMap
        ref={ref}
        mapStyle={emptyStyle}
        interactiveLayerIds={[]}
        onClick={onClick}
      />
    );
    const map = ref.current;
    if (!map) throw new Error("Map is detached.");

    await expect(map.queryRenderedFeatures({ layers: [] })).resolves.toEqual(
      []
    );
    await expect(
      map.queryRenderedFeatures({ x: 10, y: 20 }, { layers: [] })
    ).resolves.toEqual([]);
    const wrapper = view.getByTestId("wrapper-map").props as WrapperEvents;
    await act(async () => wrapper.onPress(press));
    expect(onClick.mock.lastCall?.[0]?.features).toEqual([]);

    await view.unmount();
    await expect(map.queryRenderedFeatures({ layers: [] })).rejects.toThrow(
      "not attached"
    );
  });

  test("preserves dispatched source queries across replacement and drops detached clicks", async () => {
    const ref = createRef<Handle>();
    const onClick = jest.fn<(event: NativeClickEvent) => void>();
    const onError = jest.fn();
    const scene = (mapKey: number, sourceKey: number | null, data = routes) => (
      <NativeMap
        key={mapKey}
        ref={ref}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        interactiveLayerIds={["route-line"]}
        onClick={onClick}
        onError={onError}
      >
        {sourceKey !== null && (
          <Source
            key={sourceKey}
            id="routes"
            type="geojson"
            data={data}
            cluster
          >
            <Layer id="route-line" type="line" />
          </Source>
        )}
      </NativeMap>
    );
    const view = await render(scene(1, 1));
    const original = ref.current;
    if (!original) throw new Error("Original map is detached.");
    let completeSource: (zoom: number) => void = () => {
      throw new Error("Source query was never dispatched.");
    };
    clusterZoom.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeSource = resolve;
        })
    );
    const source = original.getSource("routes");
    if (!source) throw new Error("GeoJSON source is detached.");
    expect(original.getSource("missing")).toBeUndefined();
    expect(original.getSource("routes")).toBe(source);
    await view.rerender(scene(1, 1, { ...routes, features: [] }));
    expect(original.getSource("routes")).toBe(source);
    const sourceQuery = source.getClusterExpansionZoom(7);
    await view.rerender(scene(1, 2));
    const replacement = original.getSource("routes");
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(source);
    await expect(source.getClusterExpansionZoom(7)).rejects.toThrow(
      "no longer mounted"
    );
    const onExpansion = jest.fn();
    expect(replacement?.getClusterExpansionZoom(7, onExpansion)).toBe(
      replacement
    );
    await act(async () => {});
    expect(onExpansion).toHaveBeenCalledWith(null, 13);
    const onFailure = jest.fn();
    expect(source.getClusterExpansionZoom(7, onFailure)).toBe(source);
    await act(async () => {});
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("no longer mounted"),
      })
    );
    await expect(replacement?.getClusterChildren(7)).resolves.toBeDefined();
    await expect(replacement?.getClusterLeaves(7, 5, 2)).resolves.toBeDefined();
    await expect(original.getClusterExpansionZoom("routes", 7)).resolves.toBe(
      13
    );
    await view.rerender(scene(1, null));
    expect(original.getSource("routes")).toBeUndefined();
    await expect(original.getClusterExpansionZoom("routes", 7)).rejects.toThrow(
      "not a mounted"
    );

    const oldWrapper = view.getByTestId("wrapper-map").props as WrapperEvents;
    const completePress = beginPressQuery();
    await act(async () => oldWrapper.onPress(press));
    await view.rerender(scene(2, 1));
    expect(ref.current).not.toBe(original);
    await act(async () => {
      completeSource(14);
      completePress();
      oldWrapper.onPress(press);
    });
    await expect(sourceQuery).resolves.toBe(14);
    expect(onClick).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    const newWrapper = view.getByTestId("wrapper-map").props as WrapperEvents;
    await act(async () => newWrapper.onPress(press));
    expect(onClick).toHaveBeenCalledTimes(1);
    const event = onClick.mock.lastCall?.[0];
    expect(event?.lngLat.lng).toEqual(event?.lngLat[0]);
    expect(event?.point.x).toEqual(event?.point[0]);
  });
};
