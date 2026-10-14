import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react";
import {
  createRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import type {
  WebCustomControl,
  WebForwardedProps,
  WebWrapper,
} from "../src/adapters/web/contracts.js";
import { createWebUi } from "../src/adapters/web/ui.js";
import type { MarkerRef } from "../src/contracts/ui-types.js";
import {
  type MapSession,
  MapSessionContext,
} from "../src/facade/map-context.js";

const markerProps: WebForwardedProps[] = [];
const popupProps: WebForwardedProps[] = [];
const controlProps: WebForwardedProps[] = [];
const popupHandle = { options: { anchor: "bottom" }, setOffset: jest.fn() };
const markerHandle = { setLngLat: jest.fn() };
const MarkerMock = forwardRef((props: WebForwardedProps, ref) => {
  useImperativeHandle(ref, () => markerHandle, []);
  markerProps.push(props);
  return <div>{props.children}</div>;
});
const PopupMock = forwardRef((props: WebForwardedProps, ref) => {
  popupProps.push(props);
  useImperativeHandle(ref, () => popupHandle, []);
  const initialProps = useRef(props);
  useEffect(() => {
    (initialProps.current.onOpen as () => void)?.();
    return () => (initialProps.current.onClose as () => void)?.();
  }, []);
  return <div>{props.children}</div>;
});
const ControlMock = (props: WebForwardedProps) => {
  controlProps.push(props);
  return null;
};
const wrapper = {
  Marker: MarkerMock,
  Popup: PopupMock,
  NavigationControl: ControlMock,
  AttributionControl: ControlMock,
  ScaleControl: ControlMock,
  GeolocateControl: ControlMock,
  FullscreenControl: ControlMock,
  useControl: (create: () => WebCustomControl) => {
    const control = useMemo(create, [create]);
    useEffect(() => {
      document.body.append(control.onAdd());
      return control.onRemove;
    }, [control]);
    return control;
  },
} as unknown as WebWrapper<"mapbox-web">;
const {
  Marker,
  Popup,
  Control,
  NavigationControl,
  ScaleControl,
  GeolocateControl,
} = createWebUi(wrapper);

beforeEach(() => {
  markerProps.length = 0;
  popupProps.length = 0;
  controlProps.length = 0;
  popupHandle.setOffset.mockClear();
  markerHandle.setLngLat.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
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
  test("normalizes marker drag proposals, resets omitted offset, and refreshes without work", async () => {
    const onDrag = jest.fn();
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
    const childClick = jest.fn();
    const markerClick = jest.fn();
    const stopPropagation = jest.fn();
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
    const first = jest.fn();
    const second = jest.fn();
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

  test("applies popup anchor-only changes, width conversion, and offset clearing", () => {
    const view = render(
      <Popup
        longitude={5}
        latitude={6}
        anchor="bottom"
        offset={[2, 3]}
        maxWidth={300}
      >
        Content
      </Popup>
    );
    expect(latest(popupProps).maxWidth).toBe("300px");
    view.rerender(
      <Popup longitude={5} latitude={6} anchor="top" offset={[2, 3]}>
        Content
      </Popup>
    );
    expect(popupHandle.options.anchor).toBe("top");
    expect(popupHandle.setOffset).toHaveBeenLastCalledWith([2, 3]);
    view.rerender(
      <Popup longitude={5} latitude={6} anchor="top">
        Content
      </Popup>
    );
    expect(popupHandle.setOffset).toHaveBeenLastCalledWith([0, 0]);
  });

  test("popup dismissal calls current callback while teardown emits no close", () => {
    const onOpen = jest.fn();
    const first = jest.fn();
    const second = jest.fn();
    const view = render(
      <Popup longitude={5} latitude={6} onOpen={onOpen} onClose={first} />
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    view.rerender(<Popup longitude={5} latitude={6} onClose={second} />);
    notify(latest(popupProps), "onClose", {});
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("custom control registers a host with live children and releases it", () => {
    const click = jest.fn();
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
      jest.fn<() => Promise<{ lngLat: readonly [number, number] }>>();
    const onGeolocate = jest.fn();
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
    const provider = jest.fn(
      () =>
        new Promise<{ lngLat: readonly [number, number] }>((resolve) => {
          resolvePosition = resolve;
        })
    );
    const flyTo = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onGeolocate = jest.fn();
    const session = { ready: true, map: { flyTo } } as unknown as MapSession;
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
    jest.spyOn(console, "error").mockImplementation(() => {});
    const marker = render(
      <Marker longitude={5} latitude={6} anchor="bottom" />
    );
    expect(() =>
      marker.rerender(<Marker longitude={5} latitude={6} anchor="top" />)
    ).toThrow("creation option");
    const control = render(<NavigationControl position="top-left" />);
    expect(() =>
      control.rerender(<NavigationControl position="bottom-left" />)
    ).toThrow("creation option");
  });
});
