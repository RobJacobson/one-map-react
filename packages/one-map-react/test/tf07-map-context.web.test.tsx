import { act, render } from "@testing-library/react";
import {
  forwardRef,
  type ReactNode,
  StrictMode,
  useContext,
  useImperativeHandle,
} from "react";
import { describe, expect, expectTypeOf, vi, test } from "vite-plus/test";

import {
  NativeCameraContext,
  useNativeMapPresentation,
  withNativeMapPresentation,
} from "../src/adapters/shared/native-map-presentation.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { ClickEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type { GeoJsonFeature } from "../src/contracts/source-types.js";
import { type MapSession, useMapSession } from "../src/facade/map-context.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap, useMap } from "../src/facade/map.js";
import { Source } from "../src/facade/source.js";

const hit: ClickEvent = { lngLat: [1, 2], point: [3, 4] };
const camera = { longitude: 1, latitude: 2, zoom: 3, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };

const createFixture = () => {
  let mapProps: MapProps | undefined;
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
  const FakeMap = forwardRef<MapRef, MapProps>((props, ref) => {
    // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
    mapProps = props;
    useImperativeHandle(ref, () => map, []);
    return <div>{props.children}</div>;
  });
  const adapter = {
    backend: "mapbox-web",
    Map: FakeMap,
    Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  } as unknown as Adapter;
  const click = async () => {
    await act(async () => {
      mapProps?.onClick?.(hit);
    });
  };
  return { adapter, map, query, click, props: () => mapProps };
};

const Probe = ({ capture }: { capture: (map: MapRef) => void }) => {
  capture(useMap());
  return null;
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
    const Capture = () => {
      // eslint-disable-next-line react/globals -- Test readback captures the map reference returned by the public hook.
      observed = useMap(access === "named" ? "promise-map" : undefined);
      return null;
    };
    const view = render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap id="promise-map" mapStyle={style} initialViewState={camera}>
          <Capture />
        </OneMap>
      </MapSetup>
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

describe("TF07 map-local UI lifetime", () => {
  test("move subscriber teardown suppresses the map callback and retained movement handler", () => {
    const fixture = createFixture();
    const onMove = vi.fn();
    let session: MapSession | undefined;
    const SessionProbe = () => {
      // eslint-disable-next-line react/globals -- Test readback captures the committed map session.
      session = useMapSession();
      return null;
    };
    const mounted = render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap mapStyle={style} initialViewState={camera} onMove={onMove}>
          <SessionProbe />
        </OneMap>
      </MapSetup>
    );
    const move = fixture.props()?.onMove;
    session?.subscribe("move", () => mounted.unmount());

    act(() => move?.({ viewState: camera, origin: "user" }));
    act(() => move?.({ viewState: camera, origin: "user" }));
    expect(onMove).not.toHaveBeenCalled();
  });

  test("enclosing useMap forwards commands after attachment and rejects after teardown", async () => {
    const fixture = createFixture();
    let observed: MapRef | undefined;
    const rendered = render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <Probe
            capture={(map) => {
              observed = map;
            }}
          />
        </OneMap>
      </MapSetup>
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
    const mapClick = vi.fn();
    const rendered = render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap
          mapStyle={style}
          initialViewState={camera}
          onClick={mapClick}
          interactiveLayerIds={["places-layer"]}
        >
          <Source id="places" type="vector" url="fixture://places" />
        </OneMap>
      </MapSetup>
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
    const mapClick = vi.fn();
    render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap
          mapStyle={style}
          initialViewState={camera}
          onError={report}
          interactiveLayerIds={["places-layer"]}
          onClick={mapClick}
        >
          <Source id="places" type="vector" url="fixture://places" />
        </OneMap>
      </MapSetup>
    );
    await fixture.click();
    expect(report).toHaveBeenCalledWith({ error });
    expect(mapClick).not.toHaveBeenCalled();
  });
  test("named consumers can mount with their map and observe removal and reattachment", async () => {
    const fixture = createFixture();
    let named: MapRef | undefined;
    const NamedProbe = () => {
      const map = useMap("named");
      expectTypeOf(map).toEqualTypeOf<MapRef | undefined>();
      // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
      named = map;
      return null;
    };
    const tree = (attached: boolean) => (
      <StrictMode>
        <MapSetup adapter={fixture.adapter}>
          <NamedProbe />
          {attached && (
            <OneMap id="named" mapStyle={style} initialViewState={camera} />
          )}
        </MapSetup>
      </StrictMode>
    );
    const rendered = render(tree(true));
    await expect(named?.getZoom()).resolves.toBe(3);
    const detached = named;
    rendered.rerender(tree(false));
    expect(named).toBeUndefined();
    await expect(detached?.getZoom()).rejects.toThrow("not attached");
    rendered.rerender(tree(true));
    expect(named).not.toBe(detached);
    await expect(named?.getZoom()).resolves.toBe(3);
    rendered.unmount();
    await expect(named?.getZoom()).rejects.toThrow("not attached");
  });

  test("changing the adapter requires a new MapSetup key", () => {
    const first = createFixture();
    const second = createFixture();
    const tree = (adapter: Adapter) => (
      <MapSetup adapter={adapter}>
        <OneMap mapStyle={style} initialViewState={camera} />
      </MapSetup>
    );
    const rendered = render(tree(first.adapter));
    expect(() => rendered.rerender(tree(second.adapter))).toThrow(
      "MapSetup adapter changed. Remount with a new key."
    );
  });

  test("keyed adapter replacement resets readiness and discards pending hits", async () => {
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
    const tree = (replacement: boolean) => (
      <MapSetup
        key={replacement ? "second" : "first"}
        adapter={replacement ? second.adapter : first.adapter}
      >
        <OneMap
          mapStyle={style}
          initialViewState={camera}
          interactiveLayerIds={["places"]}
          onClick={replacement ? secondClick : firstClick}
        >
          <SessionProbe />
        </OneMap>
      </MapSetup>
    );
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
  const observed = vi.fn();
  const AccessProbe = () => {
    observed(useMapSession());
    return null;
  };
  const children = <AccessProbe />;
  const tree = (zoom: number) => (
    <MapSetup adapter={fixture.adapter}>
      <OneMap
        mapStyle={style}
        initialViewState={camera}
        viewState={{ ...camera, zoom }}
      >
        {children}
      </OneMap>
    </MapSetup>
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
  const ObservedMap = forwardRef<MapRef, MapProps>((props, ref) => {
    rendererRendered();
    return <fixture.adapter.Map {...props} ref={ref} />;
  });
  const adapter = {
    ...fixture.adapter,
    backend: "mapbox-native" as const,
    Map: withNativeMapPresentation(ObservedMap),
  };
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
    <MapSetup adapter={adapter}>
      <OneMap
        mapStyle={style}
        initialViewState={camera}
        viewState={zoom === undefined ? undefined : { ...camera, zoom }}
      >
        {children}
      </OneMap>
    </MapSetup>
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
  const adapter = {
    ...fixture.adapter,
    backend: "mapbox-native" as const,
    Map: withNativeMapPresentation(fixture.adapter.Map),
  };
  const observe = vi.fn();
  const Probe = () => {
    observe(useNativeMapPresentation());
    return null;
  };
  const mounted = render(
    <MapSetup adapter={adapter}>
      <OneMap mapStyle={style} initialViewState={camera}>
        <Probe />
      </OneMap>
    </MapSetup>
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
