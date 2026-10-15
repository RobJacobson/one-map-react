import { act, fireEvent, render } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeEach, expect, vi, test } from "vite-plus/test";

import {
  emptyStyle,
  initialViewState,
} from "../../../tests/fixtures/map-fixture.js";
import type { WebMapProps, WebWrapper } from "../src/adapters/web/contracts.js";
import { createWebMap } from "../src/adapters/web/map.js";
import type { ClickEvent } from "../src/contracts/event-types.js";

const calls: WebMapProps[] = [];
const styleTarget = {
  on: vi.fn(),
  off: vi.fn(),
  isStyleLoaded: () => true,
};
const mapHandle = { getMap: () => styleTarget };
// Matches the pinned react-map-gl boundary: generic DOM attributes are ignored.
const WrapperMap = forwardRef((props: WebMapProps, ref) => {
  calls.push(props);
  useImperativeHandle(ref, () => mapHandle, []);
  return (
    <div data-testid="renderer" style={props.style}>
      {props.children}
    </div>
  );
});
const WebMap = createWebMap({
  Map: WrapperMap,
  backend: "mapbox-web",
} as unknown as WebWrapper<"mapbox-web">);

beforeEach(() => {
  calls.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

test("forwards DOM attributes and full CSS to an actual map host while the renderer fills it", () => {
  const onHostClick = vi.fn();
  const onMapClick = vi.fn<(event: ClickEvent) => void>();
  const view = render(
    <WebMap
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={{ width: 600, height: 400 }}
      hostProps={{
        id: "map-host",
        role: "region",
        "aria-label": "Route map",
        tabIndex: 0,
        className: "map-presentation",
        title: "Interactive routes",
        onClick: onHostClick,
        style: {
          height: 320,
          border: "2px solid red",
          backgroundColor: "white",
        },
      }}
      onClick={onMapClick}
    >
      <span>Map child</span>
    </WebMap>
  );
  const host = view.getByRole("region", { name: "Route map" });
  expect(host.id).toBe("map-host");
  expect(host.className).toBe("map-presentation");
  expect(host.getAttribute("tabindex")).toBe("0");
  expect(host.title).toBe("Interactive routes");
  expect(host.style.width).toBe("600px");
  expect(host.style.height).toBe("320px");
  expect(host.style.border).toBe("2px solid red");
  expect(host.style.backgroundColor).toBe("white");
  expect(view.getByTestId("renderer").style.width).toBe("100%");
  expect(view.getByTestId("renderer").style.height).toBe("100%");
  expect(host.contains(view.getByText("Map child"))).toBe(true);
  fireEvent.click(host);
  expect(onHostClick).toHaveBeenCalledTimes(1);
  expect(onMapClick).not.toHaveBeenCalled();
  const renderer = calls.at(-1);
  expect(renderer).toBeDefined();
  act(() => {
    renderer?.onClick?.({ lngLat: { lng: 1, lat: 2 }, point: { x: 3, y: 4 } });
  });
  expect(onMapClick).toHaveBeenCalledWith({ lngLat: [1, 2], point: [3, 4] });
  expect(onHostClick).toHaveBeenCalledTimes(1);
});

test("updates host attributes and styles without leaking DOM callbacks to renderer callbacks", () => {
  const first = vi.fn();
  const second = vi.fn();
  const view = render(
    <WebMap
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      hostProps={{
        "aria-label": "First map",
        onKeyDown: first,
        style: { color: "red" },
      }}
    />
  );
  view.rerender(
    <WebMap
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      hostProps={{
        "aria-label": "Current map",
        onKeyDown: second,
        style: { color: "blue" },
      }}
    />
  );
  const host = view.getByLabelText("Current map");
  fireEvent.keyDown(host, { key: "Enter" });
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(host.style.color).toBe("blue");
  expect(calls.at(-1)).not.toHaveProperty("onKeyDown");
});
