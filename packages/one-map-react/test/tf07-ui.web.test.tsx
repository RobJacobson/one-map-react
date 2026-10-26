import { act, fireEvent, render } from "@testing-library/react";
import {
  createRef,
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi,
  test,
} from "vite-plus/test";

import type {
  WebCustomControl,
  WebForwardedProps,
  WebWrapper,
} from "../src/adapters/web/contracts.js";
import { createWebUi } from "../src/adapters/web/ui.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type { MarkerRef } from "../src/contracts/ui-types.js";
import {
  type MapSession,
  MapSessionContext,
} from "../src/facade/map-context.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import {
  Marker as SharedMarker,
  ScaleControl as SharedScaleControl,
  Control as SharedControl,
} from "../src/facade/ui.js";

const markerProps: WebForwardedProps[] = [];
const controlProps: WebForwardedProps[] = [];
const markerHandle = { setLngLat: vi.fn() };
const MarkerMock = forwardRef((props: WebForwardedProps, ref) => {
  useImperativeHandle(ref, () => markerHandle, []);
  markerProps.push(props);
  return <div>{props.children}</div>;
});
const ControlMock = (props: WebForwardedProps) => {
  controlProps.push(props);
  return null;
};
const wrapper = {
  Marker: MarkerMock,

  AttributionControl: ControlMock,
  ScaleControl: ControlMock,
  GeolocateControl: ControlMock,

  useControl: (create: () => WebCustomControl) => {
    const control = useMemo(create, [create]);
    useEffect(() => {
      document.body.append(control.onAdd());
      return control.onRemove;
    }, [control]);
    return control;
  },
} as unknown as WebWrapper<"mapbox-web">;
const { Marker, Control, ScaleControl, GeolocateControl } =
  createWebUi(wrapper);

beforeEach(() => {
  markerProps.length = 0;
  controlProps.length = 0;
  markerHandle.setLngLat.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const latest = (calls: WebForwardedProps[]): WebForwardedProps => {
  const props = calls.at(-1);
  if (!props) throw new Error("UI delegate was not rendered");
  return props;
};
const notify = (props: WebForwardedProps, key: string, event: object): void => {
  (props[key] as (event: object) => void)(event);
};

describe("TF07 web UI delegates", () => {
  test("custom control placement is forwarded", () => {
    const placement = vi.spyOn(wrapper, "useControl");
    render(<Control position="bottom-left" />);
    expect(placement).toHaveBeenLastCalledWith(expect.any(Function), {
      position: "bottom-left",
    });
  });
  test("normalizes marker drag proposals, resets omitted offset, and refreshes without work", async () => {
    const onDrag = vi.fn();
    const ref = createRef<MarkerRef>();
    const view = render(
      <Marker
        ref={ref}
        longitude={5}
        latitude={6}
        offset={[10, 12]}
        onDrag={onDrag}
      />
    );
    expect(latest(markerProps).anchor).toBe("bottom");
    expect(view.container.querySelector("svg")?.getAttribute("width")).toBe(
      "24"
    );
    act(() =>
      notify(latest(markerProps), "onDrag", {
        lngLat: { lng: 7, lat: 8 },
        point: { x: 20, y: 21 },
      })
    );
    expect(onDrag).toHaveBeenCalledWith({ lngLat: [7, 8], point: [20, 21] });
    view.rerender(
      <Marker ref={ref} longitude={5} latitude={6} onDrag={onDrag} />
    );
    expect(latest(markerProps).offset).toEqual([0, 0]);
    await expect(ref.current?.refresh()).resolves.toBeUndefined();
    act(() =>
      notify(latest(markerProps), "onDragEnd", { lngLat: { lng: 7, lat: 8 } })
    );
    expect(markerHandle.setLngLat).toHaveBeenLastCalledWith([5, 6]);
  });

  test("keeps its initial default anchor when live content changes", () => {
    const view = render(<Marker longitude={5} latitude={6} />);
    view.rerender(
      <Marker longitude={5} latitude={6}>
        <span>Updated live child</span>
      </Marker>
    );
    expect(latest(markerProps).anchor).toBe("bottom");
    expect(view.getByText("Updated live child")).toBeTruthy();
  });

  test("keeps nested marker buttons interactive and prevents marker activation bubbling", () => {
    const childClick = vi.fn();
    const markerClick = vi.fn();
    const stopPropagation = vi.fn();
    const view = render(
      <Marker longitude={5} latitude={6} onClick={markerClick}>
        <button type="button" onClick={childClick}>
          Child
        </button>
      </Marker>
    );
    expect(latest(markerProps).anchor).toBe("center");
    fireEvent.click(view.getByText("Child"));
    expect(childClick).toHaveBeenCalledTimes(1);
    notify(latest(markerProps), "onClick", {
      target: { getLngLat: () => ({ lng: 5, lat: 6 }) },
      originalEvent: { stopPropagation },
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(markerClick).toHaveBeenCalledWith({ lngLat: [5, 6] });
  });

  test("updates marker callbacks and ignores stale notifications after unmount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Marker longitude={5} latitude={6} onClick={first} />);
    const staleProps = latest(markerProps);
    view.rerender(<Marker longitude={5} latitude={6} onClick={second} />);
    notify(staleProps, "onClick", {});
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    view.unmount();
    notify(staleProps, "onClick", {});
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("custom control registers a host with live children and releases it", () => {
    const click = vi.fn();
    const view = render(
      <Control>
        <button type="button" onClick={click}>
          Custom action
        </button>
      </Control>
    );
    fireEvent.click(view.getByText("Custom action"));
    expect(click).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector(".mapboxgl-ctrl.maplibregl-ctrl")
    ).not.toBeNull();
    view.rerender(
      <Control>
        <span>Updated content</span>
      </Control>
    );
    expect(view.getByText("Updated content")).toBeTruthy();
    view.unmount();
    expect(document.querySelector(".mapboxgl-ctrl.maplibregl-ctrl")).toBeNull();
  });

  test("delegates scale unit changes and supplies common defaults", () => {
    const view = render(<ScaleControl unit="metric" />);
    view.rerender(<ScaleControl unit="nautical" />);
    expect(latest(controlProps).unit).toBe("nautical");
    expect(latest(controlProps).maxWidth).toBe(100);
    expect(latest(controlProps).position).toBe("top-right");
  });

  test("uses browser geolocation and strips the native provider and zoom", () => {
    const provider =
      vi.fn<() => Promise<{ lngLat: readonly [number, number] }>>();
    const onGeolocate = vi.fn();
    render(<GeolocateControl zoom={9} onGeolocate={onGeolocate} />);
    const props = latest(controlProps);
    expect(props.getCurrentPosition).toBeUndefined();
    expect(props.zoom).toBeUndefined();
    notify(props, "onGeolocate", {
      coords: { longitude: 7, latitude: 8, accuracy: 10 },
      timestamp: 12,
    });
    expect(onGeolocate).toHaveBeenCalledWith({
      lngLat: [7, 8],
      accuracy: 10,
      timestamp: 12,
    });
    expect(provider).not.toHaveBeenCalled();
  });

  test("injected geolocation ignores repeat presses, centers once, and discards work after teardown", async () => {
    let resolvePosition: (value: {
      lngLat: readonly [number, number];
    }) => void = () => {};
    const provider = vi.fn(
      () =>
        new Promise<{ lngLat: readonly [number, number] }>((resolve) => {
          resolvePosition = resolve;
        })
    );
    const flyTo = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onGeolocate = vi.fn();
    const map = { flyTo };
    const session = {
      ready: true,
      map,
      ref: { current: map },
      subscribe: () => () => {},
    } as unknown as MapSession;
    const view = render(
      <MapSessionContext.Provider value={session}>
        <GeolocateControl
          getCurrentPosition={provider}
          onGeolocate={onGeolocate}
          zoom={11}
        />
      </MapSessionContext.Provider>
    );
    fireEvent.click(view.getByRole("button", { name: "Locate me" }));
    fireEvent.click(view.getByRole("button", { name: "Locate me" }));
    expect(provider).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePosition({ lngLat: [7, 8] });
    });
    expect(flyTo).toHaveBeenCalledWith({ center: [7, 8], zoom: 11 });
    expect(onGeolocate).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole("button", { name: "Locate me" }));
    view.unmount();
    await act(async () => {
      resolvePosition({ lngLat: [9, 10] });
    });
    expect(flyTo).toHaveBeenCalledTimes(1);
    expect(onGeolocate).toHaveBeenCalledTimes(1);
  });

  test("rejects changes to marker and control creation options", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = (children: ReactNode) => (
      <MapSetup adapter={sharedUiAdapter}>
        <OneMap
          mapStyle={{ version: 8, sources: {}, layers: [] }}
          initialViewState={{
            longitude: 0,
            latitude: 0,
            zoom: 1,
            bearing: 0,
            pitch: 0,
          }}
        >
          {children}
        </OneMap>
      </MapSetup>
    );
    const marker = render(
      tree(<SharedMarker longitude={5} latitude={6} anchor="bottom" />)
    );
    expect(() =>
      marker.rerender(
        tree(<SharedMarker longitude={5} latitude={6} anchor="top" />)
      )
    ).toThrow("creation option");
  });
  test("adapter-specific marker creation options remain guarded", () => {
    const SelectedMarker =
      Marker as typeof import("../src/mapbox-web.js").Marker;
    const view = render(
      <SelectedMarker longitude={5} latitude={6} options={{ color: "red" }} />
    );
    expect(() =>
      view.rerender(
        <SelectedMarker
          longitude={5}
          latitude={6}
          options={{ color: "blue" }}
        />
      )
    ).toThrow('creation option "color"');
  });
  test("TF08 tracking-mode changes release the old SDK control resource", () => {
    const release = vi.fn();
    const ControlWithResource = () => {
      useEffect(
        () => () => {
          release();
        },
        []
      );
      return null;
    };
    const ui = createWebUi({
      ...wrapper,
      GeolocateControl: ControlWithResource,
    });
    const view = render(<ui.GeolocateControl trackUserLocation />);
    view.rerender(<ui.GeolocateControl trackUserLocation={false} />);
    expect(release).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(release).toHaveBeenCalledTimes(2);
  });
});

const UIMap = forwardRef<never, MapProps>((props, _ref) => (
  <div>{props.children}</div>
));
const sharedUiAdapter = {
  backend: "mapbox-web",
  services: { location: {} },
  Map: UIMap,
  ...createWebUi(wrapper),
} as unknown as Adapter;

test("shared UI accepts effective creation defaults in both directions", () => {
  const tree = (explicit: boolean) => (
    <MapSetup adapter={sharedUiAdapter}>
      <OneMap
        mapStyle={{ version: 8, sources: {}, layers: [] }}
        initialViewState={{
          longitude: 0,
          latitude: 0,
          zoom: 1,
          bearing: 0,
          pitch: 0,
        }}
      >
        <SharedMarker
          longitude={0}
          latitude={0}
          anchor={explicit ? "bottom" : undefined}
          renderMode={explicit ? "view" : undefined}
        />

        <SharedScaleControl
          position={explicit ? "top-right" : undefined}
          maxWidth={explicit ? 100 : undefined}
        />
        <SharedControl position={explicit ? "top-right" : undefined} />
      </OneMap>
    </MapSetup>
  );
  const mounted = render(tree(false));
  expect(() => mounted.rerender(tree(true))).not.toThrow();
  expect(() => mounted.rerender(tree(false))).not.toThrow();
  mounted.unmount();
});
