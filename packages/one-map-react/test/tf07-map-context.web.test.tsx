import { act, render } from "@testing-library/react";
import {
  forwardRef,
  type ReactNode,
  StrictMode,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { describe, expect, expectTypeOf, vi, test } from "vite-plus/test";

import {
  NativeCameraContext,
  useNativeMapPresentation,
  withNativeMapPresentation,
} from "../src/adapters/shared/native-map-presentation.js";
import {
  nativeLngLat,
  nativePoint,
} from "../src/adapters/shared/native-values.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type {
  NativeClickEvent,
  NativeMapInputs,
} from "../src/contracts/native-types.js";
import type { GeoJsonFeature } from "../src/contracts/source-types.js";
import { type MapSession, useMapSession } from "../src/facade/map-context.js";
import type { ForwardedMapMethodKey } from "../src/facade/map.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";
import type { MapRef as MapboxMapRef } from "../src/mapbox-native.js";
import type { MapRef as MaplibreMapRef } from "../src/maplibre-native.js";

const hit: NativeClickEvent = {
  lngLat: nativeLngLat([1, 2]),
  point: nativePoint([3, 4]),
};
const camera = { longitude: 1, latitude: 2, zoom: 3, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };

const createFixture = () => {
  let mapProps: NativeMapInputs | undefined;
  const query = vi.fn<MapRef["queryRenderedFeatures"]>();
  const features: (GeoJsonFeature & { source: string })[] = [
    {
      type: "Feature",
      source: "places",
      geometry: { type: "Point", coordinates: [1, 2] },
      properties: {},
    },
  ];
  query.mockResolvedValue(features);
  const map = {
    queryRenderedFeatures: query,
    getZoom: vi.fn<MapRef["getZoom"]>().mockResolvedValue(3),
  } as unknown as MapRef;
  const FakeMap = forwardRef<MapRef, NativeMapInputs>((props, ref) => {
    // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
    mapProps = props;
    useImperativeHandle(ref, () => map, []);
    return <div>{props.children}</div>;
  });
  const components = {
    backend: "mapbox-native" as const,
    Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Layer: () => null,
    Images: () => null,
    Marker: () => null,
  };
  const binding = createNativeMapBinding(FakeMap, components);
  const click = async () => {
    await act(async () => {
      mapProps?.onClick?.(hit);
    });
  };
  return {
    binding,
    components,
    FakeMap,
    map,
    query,
    click,
    props: () => mapProps,
  };
};

test.each(
  (["enclosing", "named"] as const).flatMap((access) =>
    (["promise", "async return"] as const).map((transport) => ({
      access,
      transport,
    }))
  )
)(
  "$access map references survive $transport and retain command forwarding",
  async ({ access, transport }) => {
    const fixture = createFixture();
    const flyTo = vi.fn<MapRef["flyTo"]>().mockResolvedValue(undefined);
    fixture.map.flyTo = flyTo;
    let observed: MapRef | undefined;
    const { Map: NativeMap, MapProvider, useMap } = fixture.binding;
    const Capture = () => {
      const maps = useMap();
      // eslint-disable-next-line react/globals -- Test readback captures the map reference returned by the public hook.
      observed = access === "named" ? maps["promise-map"] : maps.current;
      return null;
    };
    const view = render(
      <MapProvider>
        {access === "named" && <Capture />}
        <NativeMap id="promise-map" mapStyle={style} initialViewState={camera}>
          {access === "enclosing" && <Capture />}
        </NativeMap>
      </MapProvider>
    );
    if (!observed) throw new Error("Map reference was not attached.");
    const retained = observed;
    const returning = async () => retained;
    const transferred =
      transport === "promise" ? Promise.resolve(retained) : returning();
    await expect(transferred).resolves.toBe(retained);
    const command = { center: [7, 8] as const, zoom: 9, duration: 0 };
    await retained.flyTo(command);
    expect(flyTo).toHaveBeenCalledWith(command);
    view.unmount();
    await expect(Promise.resolve(retained)).resolves.toBe(retained);
    await expect(retained.flyTo(command)).rejects.toThrow("not attached");
  }
);

test.each(["enclosing", "named"] as const)(
  "%s map handles expose only known stable methods and serialize safely",
  async (access) => {
    expectTypeOf<keyof MapboxMapRef>().toEqualTypeOf<ForwardedMapMethodKey>();
    expectTypeOf<keyof MaplibreMapRef>().toEqualTypeOf<ForwardedMapMethodKey>();
    const fixture = createFixture();
    const { Map: NativeMap, MapProvider, useMap } = fixture.binding;
    const observe =
      vi.fn<
        (entry: {
          readonly label: string;
          readonly map: MapRef | undefined;
        }) => void
      >();
    const Probe = ({ label }: { readonly label: string }) => {
      const maps = useMap();
      const map = access === "named" ? maps["inspect-map"] : maps.current;
      useLayoutEffect(() => {
        observe({ label, map });
      }, [label, map]);
      return null;
    };
    const scene = (label: string) => (
      <MapProvider>
        <div>{label}</div>
        {access === "named" && <Probe label={label} />}
        <NativeMap id="inspect-map" mapStyle={style} initialViewState={camera}>
          <div>{label}</div>
          {access === "enclosing" && <Probe label={label} />}
        </NativeMap>
      </MapProvider>
    );

    const view = render(scene("first"));
    const first = observe.mock.calls.at(-1)?.[0];
    expect(first?.label).toBe("first");
    const map = first?.map as
      | (MapRef & {
          getSource?: (id: string) => unknown;
          getWrapperMap?: () => Promise<unknown>;
          getMap?: unknown;
          getLayer?: unknown;
          then?: unknown;
        })
      | undefined;
    if (!map) throw new Error("Map reference was not attached.");

    expect(Object.isFrozen(map)).toBe(true);
    expect("flyTo" in map).toBe(true);
    expect("getSource" in map).toBe(true);
    expect("getWrapperMap" in map).toBe(true);
    expect(Object.hasOwn(map, "flyTo")).toBe(true);
    expect("getMap" in map).toBe(false);
    expect("getLayer" in map).toBe(false);
    expect("then" in map).toBe(false);
    expect(Symbol.toPrimitive in map).toBe(false);
    expect(Symbol.toStringTag in map).toBe(false);
    expect(typeof map.getMap).toBe("undefined");
    expect(typeof map.then).toBe("undefined");

    const initialFlyTo = map.flyTo;
    const initialGetZoom = map.getZoom;
    expect(map.flyTo).toBe(initialFlyTo);
    expect(map.getZoom).toBe(initialGetZoom);

    view.rerender(scene("second"));
    const second = observe.mock.calls.at(-1)?.[0];
    expect(second?.label).toBe("second");
    expect(second?.map).toBe(map);
    expect(second?.map?.flyTo).toBe(initialFlyTo);
    expect(second?.map?.getZoom).toBe(initialGetZoom);

    expect(String(map)).toBe("[object Object]");
    expect(JSON.stringify(map)).toBe("{}");

    // Partial attached fakes omit unimplemented methods; forwarding rejects cleanly.
    await expect(map.flyTo({ center: [7, 8] })).rejects.toThrow(
      'Map method "flyTo" is not available.'
    );
    expect(map.getSource?.("routes")).toBeUndefined();
    await expect(map.getZoom()).resolves.toBe(3);

    view.unmount();
    expect(String(map)).toBe("[object Object]");
    expect(JSON.stringify(map)).toBe("{}");
    expect(map.getSource?.("routes")).toBeUndefined();
    await expect(map.flyTo({ center: [7, 8] })).rejects.toThrow(
      "Map is not attached."
    );
    await expect(initialGetZoom()).rejects.toThrow("Map is not attached.");
  }
);

test("a provider reserves current and detects a collision with its default map", () => {
  const { Map: NativeMap, MapProvider } = createFixture().binding;
  expect(() =>
    render(
      <MapProvider>
        <NativeMap id="current" mapStyle={style} />
      </MapProvider>
    )
  ).toThrow('MapProvider reserves the map id "current".');
  expect(() =>
    render(
      <MapProvider>
        <NativeMap mapStyle={style} />
        <NativeMap id="default" mapStyle={style} />
      </MapProvider>
    )
  ).toThrow('Map id "default" is already registered');
});

describe("TF07 map-local UI lifetime", () => {
  test("movement callback teardown suppresses its retained handler", () => {
    const fixture = createFixture();
    const { Map: NativeMap } = fixture.binding;
    const onMove = vi.fn(() => mounted.unmount());
    const mounted = render(
      <NativeMap mapStyle={style} initialViewState={camera} onMove={onMove} />
    );
    const move = fixture.props()?.onMove;

    act(() => move?.({ viewState: camera, origin: "user" }));
    act(() => move?.({ viewState: camera, origin: "user" }));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  test("enclosing useMap forwards commands after attachment and rejects after teardown", async () => {
    const fixture = createFixture();
    let observed: MapRef | undefined;
    const { Map: NativeMap, useMap } = fixture.binding;
    const Probe = () => {
      const { current } = useMap();
      // eslint-disable-next-line react/globals -- Capture the handle for lifecycle assertions.
      observed = current;
      return null;
    };
    const rendered = render(
      <NativeMap mapStyle={style} initialViewState={camera}>
        <Probe />
      </NativeMap>
    );
    await expect(observed?.getZoom()).resolves.toBe(3);
    rendered.unmount();
    await expect(observed?.getZoom()).rejects.toThrow("not attached");
  });

  test("late query completion does not dispatch map callbacks after teardown", async () => {
    const fixture = createFixture();
    let resolve: ((features: readonly GeoJsonFeature[]) => void) | undefined;
    fixture.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { Map: NativeMap, Source } = fixture.binding;
    const mapClick = vi.fn();
    const rendered = render(
      <NativeMap
        mapStyle={style}
        initialViewState={camera}
        onClick={mapClick}
        interactiveLayerIds={["places-layer"]}
      >
        <Source id="places" type="vector" url="fixture://places" />
      </NativeMap>
    );
    await fixture.click();
    rendered.unmount();
    await act(async () => {
      resolve?.([
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [1, 2] },
          properties: {},
        },
      ]);
    });
    expect(mapClick).not.toHaveBeenCalled();
  });

  test("failed hit queries report failures without inventing empty successful hits", async () => {
    const fixture = createFixture();
    const error = new Error("query failed");
    fixture.query.mockRejectedValue(error);
    const report = vi.fn();
    const { Map: NativeMap, Source } = fixture.binding;
    const mapClick = vi.fn();
    render(
      <NativeMap
        mapStyle={style}
        initialViewState={camera}
        onError={report}
        interactiveLayerIds={["places-layer"]}
        onClick={mapClick}
      >
        <Source id="places" type="vector" url="fixture://places" />
      </NativeMap>
    );
    await fixture.click();
    expect(report).toHaveBeenCalledWith({ error });
    expect(mapClick).not.toHaveBeenCalled();
  });
  test("named consumers can mount with their map and observe removal and reattachment", async () => {
    const fixture = createFixture();
    const { Map: NativeMap, MapProvider, useMap } = fixture.binding;
    let named: MapRef | undefined;
    const NamedProbe = () => {
      const map = useMap().named;
      expectTypeOf(map).toEqualTypeOf<MapRef | undefined>();
      // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
      named = map;
      return null;
    };
    const tree = (attached: boolean) => (
      <StrictMode>
        <MapProvider>
          <NamedProbe />
          {attached && (
            <NativeMap id="named" mapStyle={style} initialViewState={camera} />
          )}
        </MapProvider>
      </StrictMode>
    );
    const rendered = render(tree(true));
    await expect(named?.getZoom()).resolves.toBe(3);
    const detached = named;
    const retainedGetZoom = named?.getZoom;
    rendered.rerender(tree(true));
    expect(named).toBe(detached);
    rendered.rerender(tree(false));
    expect(named).toBeUndefined();
    await expect(detached?.getZoom()).rejects.toThrow("not attached");
    await expect(retainedGetZoom?.()).rejects.toThrow("not attached");
    rendered.rerender(tree(true));
    expect(named).not.toBe(detached);
    await expect(named?.getZoom()).resolves.toBe(3);
    await expect(retainedGetZoom?.()).rejects.toThrow("not attached");
    rendered.unmount();
    await expect(named?.getZoom()).rejects.toThrow("not attached");
  });

  test("bound map replacement resets readiness and discards pending hits", async () => {
    const first = createFixture();
    const second = createFixture();
    let resolve: ((features: readonly GeoJsonFeature[]) => void) | undefined;
    first.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const firstClick = vi.fn();
    const secondClick = vi.fn();
    const observed = vi.fn<(session: MapSession) => void>();
    const SessionProbe = () => {
      observed(useMapSession());
      return null;
    };
    const tree = (replacement: boolean) => {
      const { Map: NativeMap } = replacement ? second.binding : first.binding;
      return (
        <NativeMap
          mapStyle={style}
          initialViewState={camera}
          interactiveLayerIds={["places"]}
          onClick={replacement ? secondClick : firstClick}
        >
          <SessionProbe />
        </NativeMap>
      );
    };
    const rendered = render(tree(false));
    act(() => first.props()?.onLoad?.());
    expect(observed.mock.calls.at(-1)?.[0].ready).toBe(true);
    await first.click();
    expect(first.query).toHaveBeenCalledTimes(1);
    rendered.rerender(tree(true));
    expect(observed.mock.calls.at(-1)?.[0].ready).toBe(false);
    await act(async () => resolve?.([]));
    expect(firstClick).not.toHaveBeenCalled();
    expect(secondClick).not.toHaveBeenCalled();
    act(() => second.props()?.onLoad?.());
    expect(observed.mock.calls.at(-1)?.[0].ready).toBe(true);
    await second.click();
    expect(secondClick).toHaveBeenCalledTimes(1);
  });
});

test("camera movement and controlled camera updates preserve map-access consumers", async () => {
  const fixture = createFixture();
  const { Map: NativeMap } = fixture.binding;
  const observed = vi.fn();
  const AccessProbe = () => {
    observed(useMapSession());
    return null;
  };
  const children = <AccessProbe />;
  const tree = (zoom: number) => (
    <NativeMap
      mapStyle={style}
      initialViewState={camera}
      viewState={{ ...camera, zoom }}
    >
      {children}
    </NativeMap>
  );
  const mounted = render(tree(3));
  const session = observed.mock.calls.at(-1)?.[0];
  const renders = observed.mock.calls.length;
  await act(async () =>
    fixture
      .props()
      ?.onMove?.({ viewState: { ...camera, zoom: 4 }, origin: "user" })
  );
  expect(observed).toHaveBeenCalledTimes(renders);
  mounted.rerender(tree(5));
  expect(observed).toHaveBeenCalledTimes(renders);
  expect(observed.mock.calls.at(-1)?.[0]).toBe(session);
});

test("native camera observations and controls leave unrelated contexts unchanged", async () => {
  const fixture = createFixture();
  const rendererRendered = vi.fn();
  const { FakeMap, components } = fixture;
  const ObservedMap = forwardRef<MapRef, NativeMapInputs>((props, ref) => {
    rendererRendered();
    return <FakeMap {...props} ref={ref} />;
  });
  const { Map: NativeMap } = createNativeMapBinding(
    withNativeMapPresentation(ObservedMap),
    components
  );
  const access = vi.fn();
  const presentation = vi.fn();
  const cameraChanged = vi.fn();
  const Access = () => {
    access(useMapSession());
    return null;
  };
  const Presentation = () => {
    presentation(useNativeMapPresentation());
    return null;
  };
  const Camera = () => {
    cameraChanged(useContext(NativeCameraContext)?.viewState);
    return null;
  };
  const children = (
    <>
      <Access />
      <Presentation />
      <Camera />
    </>
  );
  const tree = (zoom?: number) => (
    <NativeMap
      mapStyle={style}
      initialViewState={camera}
      viewState={zoom === undefined ? undefined : { ...camera, zoom }}
    >
      {children}
    </NativeMap>
  );
  const mounted = render(tree());
  const accessRenders = access.mock.calls.length;
  const presentationRenders = presentation.mock.calls.length;
  const rendererRenders = rendererRendered.mock.calls.length;
  await act(async () =>
    fixture
      .props()
      ?.onMove?.({ viewState: { ...camera, zoom: 7 }, origin: "user" })
  );
  expect(cameraChanged.mock.calls.at(-1)?.[0].zoom).toBe(7);
  expect(access).toHaveBeenCalledTimes(accessRenders);
  expect(presentation).toHaveBeenCalledTimes(presentationRenders);
  expect(rendererRendered).toHaveBeenCalledTimes(rendererRenders);
  await act(async () =>
    fixture
      .props()
      ?.onMoveEnd?.({ viewState: { ...camera, zoom: 6 }, origin: "unknown" })
  );
  expect(cameraChanged.mock.calls.at(-1)?.[0].zoom).toBe(6);
  expect(access).toHaveBeenCalledTimes(accessRenders);
  expect(presentation).toHaveBeenCalledTimes(presentationRenders);
  expect(rendererRendered).toHaveBeenCalledTimes(rendererRenders);
  mounted.rerender(tree(8));
  const controlledAccessRenders = access.mock.calls.length;
  const controlledPresentationRenders = presentation.mock.calls.length;
  mounted.rerender(tree(9));
  expect(cameraChanged.mock.calls.at(-1)?.[0].zoom).toBe(6);
  expect(access).toHaveBeenCalledTimes(controlledAccessRenders);
  expect(presentation).toHaveBeenCalledTimes(controlledPresentationRenders);
  mounted.unmount();
});

test("native presentation retains viewport layout and stable setters", async () => {
  const fixture = createFixture();
  const { Map: NativeMap } = createNativeMapBinding(
    withNativeMapPresentation(fixture.FakeMap),
    fixture.components
  );
  const observe = vi.fn();
  const Probe = () => {
    observe(useNativeMapPresentation());
    return null;
  };
  const mounted = render(
    <NativeMap mapStyle={style} initialViewState={camera}>
      <Probe />
    </NativeMap>
  );
  const initial = observe.mock.calls.at(-1)?.[0];
  await act(async () => {
    initial.setNativeLayout(400, 300);
  });
  const updated = observe.mock.calls.at(-1)?.[0];
  expect(updated).toMatchObject({
    nativeLayout: { width: 400, height: 300 },
  });
  expect(updated.setNativeLayout).toBe(initial.setNativeLayout);
  const renders = observe.mock.calls.length;
  await act(async () => {
    updated.setNativeLayout(400, 300);
  });
  expect(observe).toHaveBeenCalledTimes(renders);
  mounted.unmount();
});
