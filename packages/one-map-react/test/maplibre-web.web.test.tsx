import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, waitFor } from "@testing-library/react";
import { createRef, type ReactNode, type Ref, StrictMode } from "react";

import {
  emptyStyle,
  initialViewState,
  replacementStyle,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { LayerProps, LayerType } from "../src/contracts/layer-types.js";
import type {
  ExternalDrawingContext,
  MapProps,
} from "../src/contracts/map-types.js";
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { Map as OneMap } from "../src/facade/map.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Source } from "../src/facade/source.js";
import type { createWebMapMock } from "./create-web-map-mock.js";

jest.mock("react-map-gl/maplibre", () => {
  const { createWebMapMock } = require("./create-web-map-mock.js");

  return createWebMapMock();
});

import {
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  Source as MaplibreSource,
} from "react-map-gl/maplibre";

import { adapter } from "../src/maplibre-web.js";

type WebMapMockModule = ReturnType<typeof createWebMapMock>;

const MapMock = MaplibreMap as unknown as jest.Mock;
const LayerMock = MaplibreLayer as unknown as jest.Mock;
const SourceMock = MaplibreSource as unknown as jest.Mock;
const {
  resetWebMapMock,
  getStyleTarget,
  flyTo: mockFlyTo,
  resize: mockResize,
} = jest.requireMock("react-map-gl/maplibre") as WebMapMockModule;

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

describe("maplibre-web adapter", () => {
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

  test("a mapStyle replacement reports onStyleLoad when the style is already loaded", () => {
    const onStyleLoad = jest.fn();
    const rendered = render(example(undefined, undefined, { onStyleLoad }));
    const styleTarget = getStyleTarget();

    if (!styleTarget) {
      throw new Error("Map did not attach a style listener");
    }

    styleTarget.emitStyleLoad();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);

    rendered.rerender(
      example(undefined, undefined, {
        onStyleLoad,
        mapStyle: replacementStyle,
      })
    );

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
});

const tree = (children: ReactNode) => (
  <MapSetup adapter={adapter}>
    <OneMap
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={{ width: "100%", height: 400 }}
    >
      {children}
    </OneMap>
  </MapSetup>
);

describe("maplibre-web sources and layers", () => {
  beforeEach(() => {
    resetWebMapMock();
  });

  test("a vector source forwards style-spec fields", () => {
    render(
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

    expect(SourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tiles",
        type: "vector",
        tiles: ["https://example.com/{z}/{x}/{y}.pbf"],
        minzoom: 2,
        maxzoom: 16,
        scheme: "tms",
        attribution: "Example",
      }),
      undefined
    );
  });

  test("a raster-dem source forwards attribution and scheme", () => {
    render(
      tree(
        <Source
          id="terrain"
          type="raster-dem"
          url="https://example.com/terrain.json"
          encoding="mapbox"
          attribution="Example"
          scheme="tms"
        />
      )
    );

    expect(SourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "terrain",
        type: "raster-dem",
        url: "https://example.com/terrain.json",
        encoding: "mapbox",
        attribution: "Example",
        scheme: "tms",
      }),
      undefined
    );
  });

  test("an image source forwards four corners", () => {
    render(
      tree(
        <Source
          id="overlay"
          type="image"
          url="https://example.com/overlay.png"
          coordinates={[
            [-122.5, 47.8],
            [-122.1, 47.8],
            [-122.1, 47.4],
            [-122.5, 47.4],
          ]}
        />
      )
    );

    expect(SourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "overlay",
        type: "image",
        url: "https://example.com/overlay.png",
        coordinates: [
          [-122.5, 47.8],
          [-122.1, 47.8],
          [-122.1, 47.4],
          [-122.5, 47.4],
        ],
      }),
      undefined
    );
  });

  const layerCases: ReadonlyArray<
    readonly [LayerType, Record<string, unknown>]
  > = [
    ["background", { "background-color": "#ffffff" }],
    ["fill", { "fill-color": "#111111" }],
    ["line", { "line-color": "#222222" }],
    ["circle", { "circle-radius": 4 }],
    ["symbol", { "text-color": "#333333" }],
    ["raster", { "raster-opacity": 0.5 }],
    ["heatmap", { "heatmap-radius": 8 }],
    ["fill-extrusion", { "fill-extrusion-height": 10 }],
  ];

  test.each(layerCases)("a %s layer forwards type and paint", (type, paint) => {
    LayerMock.mockClear();
    const layerProps = {
      id: `l-${type}`,
      type,
      paint,
    } as unknown as LayerProps;

    render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer {...layerProps} />
        </Source>
      )
    );

    expect(LayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `l-${type}`,
        type,
        paint,
      }),
      undefined
    );
  });

  test("a symbol layer allows web-only layout keys", () => {
    render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="labels"
            type="symbol"
            layout={{ "icon-overlap": "always", "text-field": ["get", "name"] }}
          />
        </Source>
      )
    );

    expect(LayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "labels",
        layout: { "icon-overlap": "always", "text-field": ["get", "name"] },
      }),
      undefined
    );
  });

  test("updated geojson data reaches the wrapper", () => {
    const updated = { type: "FeatureCollection" as const, features: [] };
    const rendered = render(
      tree(<Source id="routes" type="geojson" data={routes} />)
    );

    rendered.rerender(
      tree(<Source id="routes" type="geojson" data={updated} />)
    );

    expect(SourceMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ id: "routes", data: updated })
    );
  });

  test("changing a source creation option throws", () => {
    const rendered = render(
      tree(<Source id="points" type="geojson" data={routes} cluster={false} />)
    );

    expect(() =>
      rendered.rerender(
        tree(<Source id="points" type="geojson" data={routes} cluster />)
      )
    ).toThrow('Source "points" changed the creation option "cluster".');
  });
});

describe("maplibre-web images", () => {
  const loadedStyle = () => {
    const target = getStyleTarget();

    if (!target) {
      throw new Error("Map did not attach");
    }

    target.emitStyleLoad();

    return target;
  };

  beforeEach(() => {
    resetWebMapMock();
  });

  test("entries register through the promise loader and remove on unmount", async () => {
    const rendered = render(
      tree(
        <Images
          images={{
            marker: "https://example.com/marker.png",
            shield: { url: "https://example.com/shield.png", sdf: true },
          }}
        />
      )
    );
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(2);
    });
    expect(target.loadImage).toHaveBeenCalledWith(
      "https://example.com/marker.png"
    );
    expect(target.addImage).toHaveBeenCalledWith(
      "marker",
      expect.objectContaining({ url: "https://example.com/marker.png" }),
      {}
    );
    expect(target.addImage).toHaveBeenCalledWith(
      "shield",
      expect.objectContaining({ url: "https://example.com/shield.png" }),
      { sdf: true }
    );

    rendered.unmount();

    expect(target.removeImage).toHaveBeenCalledWith("marker");
    expect(target.removeImage).toHaveBeenCalledWith("shield");
  });

  test("a new images object with the same entries does not reload", async () => {
    const rendered = render(
      tree(<Images images={{ marker: "https://example.com/m.png" }} />)
    );
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(
      tree(<Images images={{ marker: "https://example.com/m.png" }} />)
    );

    expect(target.removeImage).not.toHaveBeenCalled();
    expect(target.addImage).toHaveBeenCalledTimes(1);
  });

  test("a replaced style drops images and styledata re-registers them", async () => {
    render(tree(<Images images={{ marker: "https://example.com/m.png" }} />));
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(true);
    });

    // Style replacement drops registered images on the renderer.
    target.clearImages();
    target.emitStyleData();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(true);
    });
    expect(target.addImage).toHaveBeenCalledTimes(2);
  });
});
