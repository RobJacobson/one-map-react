import { act, fireEvent, render } from "@testing-library/react";
import {
  createRef,
  type ReactNode,
  forwardRef,
  useImperativeHandle,
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
  WebForwardedProps,
  WebWrapper,
} from "../src/adapters/web/contracts.js";
import { createWebUi } from "../src/adapters/web/ui.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type { MarkerRef } from "../src/contracts/ui-types.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Marker as SharedMarker } from "../src/facade/ui.js";

const markerProps: WebForwardedProps[] = [];
const markerHandle = { setLngLat: vi.fn() };
const MarkerMock = forwardRef((props: WebForwardedProps, ref) => {
  useImperativeHandle(ref, () => markerHandle, []);
  markerProps.push(props);
  return <div>{props.children}</div>;
});
const wrapper = {
  Marker: MarkerMock,
} as unknown as WebWrapper<"mapbox-web">;
const { Marker } = createWebUi(wrapper);

beforeEach(() => {
  markerProps.length = 0;
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

  test("rejects changes to marker creation options", () => {
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
      </OneMap>
    </MapSetup>
  );
  const mounted = render(tree(false));
  expect(() => mounted.rerender(tree(true))).not.toThrow();
  expect(() => mounted.rerender(tree(false))).not.toThrow();
  mounted.unmount();
});
