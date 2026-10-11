import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react";
import { createRef, type Ref, StrictMode } from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/camera-types.js";
import { Layer } from "../src/layer.js";
import { Map as OneMap } from "../src/map.js";
import { MapSetup } from "../src/map-setup.js";
import type { ExternalDrawingContext, MapProps } from "../src/map-types.js";
import { Source } from "../src/source.js";
import type { createWebMapMock } from "./create-web-map-mock.js";

jest.mock("react-map-gl/mapbox", () => {
  const { createWebMapMock } = require("./create-web-map-mock.js");

  return createWebMapMock();
});

import { Layer as MapboxLayer, Map as MapboxMap } from "react-map-gl/mapbox";

import { adapter } from "../src/mapbox-web.js";

type WebMapMockModule = ReturnType<typeof createWebMapMock>;

const MapMock = MapboxMap as unknown as jest.Mock;
const LayerMock = MapboxLayer as unknown as jest.Mock;
const {
  resetWebMapMock,
  getStyleTarget,
  flyTo: mockFlyTo,
  jumpTo: mockJumpTo,
  fitBounds: mockFitBounds,
  stop: mockStop,
  resize: mockResize,
  disableRotation,
} = jest.requireMock("react-map-gl/mapbox") as WebMapMockModule;

const example = (
  ref?: Ref<MapRef>,
  onMove?: (event: object) => void,
  extra?: Partial<MapProps> & { readonly layerId?: string }
) => {
  const { layerId = "route-line", ...mapProps } = extra ?? {};

  return (
    <MapSetup adapter={adapter}>
      <OneMap
        ref={ref}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        style={{ width: "100%", height: 400 }}
        onMove={onMove}
        {...mapProps}
      >
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id={layerId}
            type="line"
            paint={{ "line-color": "#2563eb", "line-width": 3 }}
            layout={{ "line-cap": "round" }}
          />
        </Source>
      </OneMap>
    </MapSetup>
  );
};

const lastMapProps = <Props,>(): Props => {
  const lastCall = MapMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("Map was not rendered");
  }

  return lastCall[0] as Props;
};

const drawingContext = (
  drawingBufferWidth: number
): ExternalDrawingContext => ({
  canvas: {},
  drawingBufferWidth,
  drawingBufferHeight: 1,
});

describe("mapbox-web adapter", () => {
  beforeEach(() => {
    resetWebMapMock();
  });

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

  test("resize calls the wrapper resize", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    await ref.current?.resize();

    expect(mockResize).toHaveBeenCalledTimes(1);
  });

  test("reuseMaps keeps the wrapper instance and the new children", () => {
    const first = render(
      example(undefined, undefined, { reuseMaps: true, layerId: "route-a" })
    );
    const firstId = first
      .getByTestId("wrapper-map")
      .getAttribute("data-map-id");

    first.unmount();
    const second = render(
      example(undefined, undefined, { reuseMaps: true, layerId: "route-b" })
    );

    expect(second.getByTestId("wrapper-map").getAttribute("data-map-id")).toBe(
      firstId
    );
    expect(second.container.querySelector("#routes")).not.toBeNull();
    expect(LayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "route-b", source: "routes" }),
      undefined
    );
  });

  test("a pooled map is not reused when reuseMaps is omitted", () => {
    const first = render(example(undefined, undefined, { reuseMaps: true }));
    const firstId = first
      .getByTestId("wrapper-map")
      .getAttribute("data-map-id");

    first.unmount();
    const second = render(example());

    expect(
      second.getByTestId("wrapper-map").getAttribute("data-map-id")
    ).not.toBe(firstId);
  });

  test("a reused map keeps the drawing context from construction", () => {
    const firstGl = drawingContext(11);
    const secondGl = drawingContext(22);
    const first = render(
      example(undefined, undefined, { reuseMaps: true, gl: firstGl })
    );
    const firstId = first
      .getByTestId("wrapper-map")
      .getAttribute("data-map-id");

    expect(
      first.getByTestId("wrapper-map").getAttribute("data-constructed")
    ).toBe("true");
    expect(
      first.getByTestId("wrapper-map").getAttribute("data-context-width")
    ).toBe("11");

    first.unmount();
    const second = render(
      example(undefined, undefined, { reuseMaps: true, gl: secondGl })
    );

    expect(second.getByTestId("wrapper-map").getAttribute("data-map-id")).toBe(
      firstId
    );
    expect(
      second.getByTestId("wrapper-map").getAttribute("data-constructed")
    ).toBe("false");
    expect(
      second.getByTestId("wrapper-map").getAttribute("data-context-width")
    ).toBe("11");
    expect(lastMapProps<{ readonly gl?: ExternalDrawingContext }>().gl).toBe(
      secondGl
    );
  });

  test("load, error, and resize callbacks stop after unmount", () => {
    const onLoad = jest.fn();
    const onError = jest.fn();
    const onResize = jest.fn();
    const rendered = render(
      example(undefined, undefined, { onLoad, onError, onResize })
    );
    const props = lastMapProps<{
      onLoad: () => void;
      onError: (event: { error?: unknown }) => void;
      onResize: () => void;
    }>();

    props.onLoad();
    props.onError({ error: new Error("tile") });
    props.onResize();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      error: expect.objectContaining({ message: "tile" }),
    });
    expect(onResize).toHaveBeenCalledTimes(1);

    rendered.unmount();
    props.onLoad();
    props.onError({ error: new Error("later") });
    props.onResize();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  test("style.load reaches onStyleLoad and is removed on unmount", () => {
    const onStyleLoad = jest.fn();
    const rendered = render(example(undefined, undefined, { onStyleLoad }));
    const styleTarget = getStyleTarget();

    if (!styleTarget) {
      throw new Error("Map did not attach a style listener");
    }

    expect(styleTarget.listenerCount()).toBe(1);
    styleTarget.emitStyleLoad();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);

    rendered.unmount();
    expect(styleTarget.listenerCount()).toBe(0);
    styleTarget.emitStyleLoad();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);
  });

  test("a missed style.load is reported when the map load finds the style loaded", () => {
    const onStyleLoad = jest.fn();

    render(example(undefined, undefined, { onStyleLoad }));
    const styleTarget = getStyleTarget();

    if (!styleTarget) {
      throw new Error("Map did not attach a style listener");
    }

    expect(onStyleLoad).not.toHaveBeenCalled();
    styleTarget.emitLoad();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);

    styleTarget.emitIdle();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);

    styleTarget.emitStyleLoad();

    expect(onStyleLoad).toHaveBeenCalledTimes(2);
  });

  test("a reused map reports onStyleLoad when idle finds the style loaded", () => {
    const onStyleLoad = jest.fn();

    render(example(undefined, undefined, { onStyleLoad }));
    const styleTarget = getStyleTarget();

    if (!styleTarget) {
      throw new Error("Map did not attach a style listener");
    }

    styleTarget.emitIdle();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);
  });

  test("StrictMode replay leaves the current load callback active", () => {
    const onLoad = jest.fn();

    const rendered = render(
      <StrictMode>
        {example(undefined, undefined, { onLoad, reuseMaps: true })}
      </StrictMode>
    );
    const props = lastMapProps<{ onLoad: () => void }>();

    props.onLoad();

    expect(onLoad).toHaveBeenCalledTimes(1);

    rendered.unmount();
    props.onLoad();

    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  test("a reused mount calls the new onLoad", () => {
    const firstLoad = jest.fn();
    const first = render(
      example(undefined, undefined, { onLoad: firstLoad, reuseMaps: true })
    );

    first.unmount();

    const secondLoad = jest.fn();

    render(
      example(undefined, undefined, { onLoad: secondLoad, reuseMaps: true })
    );
    const props = lastMapProps<{ onLoad: () => void }>();

    props.onLoad();

    expect(secondLoad).toHaveBeenCalledTimes(1);
    expect(firstLoad).not.toHaveBeenCalled();
  });

  test("a reused loaded map reports the new onStyleLoad and keeps one listener", () => {
    const firstStyleLoad = jest.fn();
    const first = render(
      example(undefined, undefined, {
        onStyleLoad: firstStyleLoad,
        reuseMaps: true,
      })
    );
    const styleTarget = getStyleTarget();

    if (!styleTarget) {
      throw new Error("Map did not attach a style listener");
    }

    styleTarget.emitStyleLoad();

    expect(firstStyleLoad).toHaveBeenCalledTimes(1);
    expect(styleTarget.listenerCount()).toBe(1);

    first.unmount();

    expect(styleTarget.listenerCount()).toBe(0);

    const secondStyleLoad = jest.fn();

    render(
      example(undefined, undefined, {
        onStyleLoad: secondStyleLoad,
        reuseMaps: true,
      })
    );

    expect(getStyleTarget()).toBe(styleTarget);
    expect(styleTarget.listenerCount()).toBe(1);
    expect(styleTarget.isStyleLoaded()).toBe(true);
    expect(secondStyleLoad).toHaveBeenCalledTimes(1);
    expect(firstStyleLoad).toHaveBeenCalledTimes(1);

    styleTarget.emitStyleLoad();

    expect(secondStyleLoad).toHaveBeenCalledTimes(2);
    expect(firstStyleLoad).toHaveBeenCalledTimes(1);
  });

  test("StrictMode uses the load callback from the latest render", () => {
    const firstLoad = jest.fn();
    const secondLoad = jest.fn();
    const rendered = render(
      <StrictMode>
        {example(undefined, undefined, { onLoad: firstLoad, reuseMaps: true })}
      </StrictMode>
    );

    rendered.rerender(
      <StrictMode>
        {example(undefined, undefined, {
          onLoad: secondLoad,
          reuseMaps: true,
        })}
      </StrictMode>
    );
    const props = lastMapProps<{ onLoad: () => void }>();

    props.onLoad();

    expect(secondLoad).toHaveBeenCalledTimes(1);
    expect(firstLoad).not.toHaveBeenCalled();

    rendered.unmount();
    props.onLoad();

    expect(secondLoad).toHaveBeenCalledTimes(1);
  });

  test("commands, getters, and controlled viewState go to the wrapper", async () => {
    const ref = createRef<MapRef>();
    const rendered = render(
      example(ref, undefined, {
        viewState: { ...initialViewState, zoom: 12 },
        minZoom: 2,
        maxBounds: [
          [170, -10],
          [-170, 10],
        ],
      })
    );

    expect(lastMapProps<object>()).toEqual(
      expect.objectContaining({
        viewState: { ...initialViewState, zoom: 12 },
        minZoom: 2,
        maxBounds: [170, -10, -170, 10],
      })
    );

    await ref.current?.jumpTo({ center: [-122.3, 47.6] });
    await ref.current?.fitBounds(
      [
        [170, -10],
        [-170, 10],
      ],
      { duration: 200 }
    );
    await ref.current?.stop();

    expect(mockJumpTo).toHaveBeenCalledWith({ center: [-122.3, 47.6] });
    expect(mockFitBounds).toHaveBeenCalledWith(
      [
        [170, -10],
        [-170, 10],
      ],
      { duration: 200 }
    );
    expect(mockStop).toHaveBeenCalled();
    await expect(ref.current?.getCenter()).resolves.toEqual([-122.34, 47.61]);
    await expect(ref.current?.getBounds()).resolves.toEqual([
      [170, -10],
      [-170, 10],
    ]);
    await expect(ref.current?.getMaxBounds()).resolves.toBeNull();

    rendered.rerender(
      example(ref, undefined, {
        viewState: { ...initialViewState, zoom: 13 },
      })
    );

    expect(lastMapProps<{ viewState: { zoom: number } }>().viewState.zoom).toBe(
      13
    );
  });

  test("touchRotate false disables rotation without disabling pinch zoom", () => {
    render(example(undefined, undefined, { touchRotate: false }));

    expect(lastMapProps<{ touchZoomRotate?: boolean }>().touchZoomRotate).toBe(
      true
    );
    expect(disableRotation).toHaveBeenCalled();
  });

  test("onClick converts the wrapper event and onLongPress is rejected", () => {
    const onClick = jest.fn();
    const rendered = render(example(undefined, undefined, { onClick }));
    const props = lastMapProps<{
      onClick: (event: object) => void;
    }>();

    props.onClick({
      lngLat: { lng: -122.34, lat: 47.61 },
      point: { x: 8, y: 9 },
    });

    expect(onClick).toHaveBeenCalledWith({
      lngLat: [-122.34, 47.61],
      point: [8, 9],
    });

    rendered.unmount();
    props.onClick({
      lngLat: { lng: -122, lat: 47 },
      point: { x: 1, y: 1 },
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(() =>
      render(example(undefined, undefined, { onLongPress: jest.fn() }))
    ).toThrow("onLongPress is not available on web maps.");
  });
});
