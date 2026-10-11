import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react";
import { createRef, type Ref } from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/camera-types.js";
import { Layer } from "../src/layer.js";
import { Map as OneMap } from "../src/map.js";
import { MapSetup } from "../src/map-setup.js";
import { Source } from "../src/source.js";

const mockFlyTo = jest.fn(() => ({ id: "map" }));

jest.mock("react-map-gl/mapbox", () => {
  const React = require("react");
  let mapSerial = 0;

  return {
    Map: jest.fn(
      ({
        children,
        ref,
      }: {
        children?: React.ReactNode;
        ref?: React.Ref<{ flyTo: typeof mockFlyTo }>;
      }) => {
        const [mapId] = React.useState(() => {
          mapSerial += 1;
          return String(mapSerial);
        });
        React.useImperativeHandle(ref, () => ({ flyTo: mockFlyTo }));

        return React.createElement(
          "div",
          { "data-testid": "wrapper-map", "data-map-id": mapId },
          children
        );
      }
    ),
    Source: ({ id, children }: { id: string; children?: React.ReactNode }) =>
      React.createElement(
        "div",
        { id },
        React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement, { source: id })
            : child
        )
      ),
    Layer: jest.fn(() => React.createElement("div")),
  };
});

import { Layer as MapboxLayer, Map as MapboxMap } from "react-map-gl/mapbox";

import { adapter } from "../src/mapbox-web.js";

const MapMock = MapboxMap as unknown as jest.Mock;
const LayerMock = MapboxLayer as unknown as jest.Mock;

const example = (ref?: Ref<MapRef>, onMove?: (event: object) => void) => (
  <MapSetup adapter={adapter}>
    <OneMap
      ref={ref}
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={{ width: "100%", height: 400 }}
      onMove={onMove}
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

describe("mapbox-web adapter", () => {
  test("nested Source injects source onto the line layer", () => {
    render(example());

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

  test("flyTo invokes the wrapper map flyTo", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    await ref.current?.flyTo({
      center: [-122.34, 47.61],
      duration: 1000,
    });

    expect(mockFlyTo).toHaveBeenCalledWith({
      center: [-122.34, 47.61],
      duration: 1000,
    });
  });

  test("onMove receives converted camera fields and stops after unmount", () => {
    const onMove = jest.fn();
    const rendered = render(example(undefined, onMove));
    const lastCall = MapMock.mock.calls.at(-1);

    if (!lastCall) {
      throw new Error("Map was not rendered");
    }

    const onMoveProp = (lastCall[0] as { onMove: (event: object) => void })
      .onMove;

    onMoveProp({
      viewState: initialViewState,
      originalEvent: {},
    });

    expect(onMove).toHaveBeenCalledWith({
      viewState: initialViewState,
      origin: "user",
    });

    rendered.unmount();
    onMoveProp({
      viewState: { ...initialViewState, zoom: 12 },
      originalEvent: {},
    });

    expect(onMove).toHaveBeenCalledTimes(1);
  });

  test("rerender keeps the wrapper map id and a new mount replaces it", () => {
    const first = render(example());
    const firstId = first
      .getByTestId("wrapper-map")
      .getAttribute("data-map-id");

    first.rerender(example());

    expect(first.getByTestId("wrapper-map").getAttribute("data-map-id")).toBe(
      firstId
    );

    first.unmount();
    const second = render(example());

    expect(
      second.getByTestId("wrapper-map").getAttribute("data-map-id")
    ).not.toBe(firstId);
  });
});
