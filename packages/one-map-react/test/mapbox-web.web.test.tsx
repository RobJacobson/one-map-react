import { render, waitFor } from "@testing-library/react";
import { createRef, type ReactNode, type Ref, StrictMode } from "react";
import type { Mock } from "vite-plus/test";
import { beforeEach, describe, expect, vi, test } from "vite-plus/test";

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
import type { SourceProps } from "../src/contracts/source-types.js";
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Source } from "../src/facade/source.js";
import type { createWebMapMock } from "./create-web-map-mock.js";
import { runWebFollowupRegressions } from "./web-followup-regressions.js";

vi.mock("react-map-gl/mapbox", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");

  return createWebMapMock();
});

import {
  Layer as MapboxLayer,
  Map as MapboxMap,
  Source as MapboxSource,
} from "react-map-gl/mapbox";

import { adapter } from "../src/mapbox-web.js";

type WebMapMockModule = ReturnType<typeof createWebMapMock>;

const MapMock = MapboxMap as unknown as Mock;
const LayerMock = MapboxLayer as unknown as Mock;
const SourceMock = MapboxSource as unknown as Mock;
const {
  resetWebMapMock,
  enableRotation,
  getStyleTarget,
  flyTo: mockFlyTo,
  jumpTo: mockJumpTo,
  fitBounds: mockFitBounds,
  stop: mockStop,
  resize: mockResize,
  disableRotation,
  queryRenderedFeatures: mockQueryRenderedFeatures,
  querySourceFeatures: mockQuerySourceFeatures,
  setFeatureState: mockSetFeatureState,
  getFeatureState: mockGetFeatureState,
  removeFeatureState: mockRemoveFeatureState,
  clusterSource: mockClusterSource,
  registerMockSource,
} = (await vi.importMock("react-map-gl/mapbox")) as WebMapMockModule;

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
    const onMove = vi.fn();
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
    const onLoad = vi.fn();
    const onError = vi.fn();
    const onResize = vi.fn();
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
    const onStyleLoad = vi.fn();
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
    const onStyleLoad = vi.fn();

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
    const onStyleLoad = vi.fn();
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
    const onStyleLoad = vi.fn();

    render(example(undefined, undefined, { onStyleLoad }));
    const styleTarget = getStyleTarget();

    if (!styleTarget) {
      throw new Error("Map did not attach a style listener");
    }

    styleTarget.emitIdle();

    expect(onStyleLoad).toHaveBeenCalledTimes(1);
  });

  test("StrictMode replay leaves the current load callback active", () => {
    const onLoad = vi.fn();

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
    const firstLoad = vi.fn();
    const first = render(
      example(undefined, undefined, { onLoad: firstLoad, reuseMaps: true })
    );

    first.unmount();

    const secondLoad = vi.fn();

    render(
      example(undefined, undefined, { onLoad: secondLoad, reuseMaps: true })
    );
    const props = lastMapProps<{ onLoad: () => void }>();

    props.onLoad();

    expect(secondLoad).toHaveBeenCalledTimes(1);
    expect(firstLoad).not.toHaveBeenCalled();
  });

  test("a reused loaded map reports the new onStyleLoad and keeps one listener", () => {
    const firstStyleLoad = vi.fn();
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

    const secondStyleLoad = vi.fn();

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
    const firstLoad = vi.fn();
    const secondLoad = vi.fn();
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
    const onClick = vi.fn();
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
      render(example(undefined, undefined, { onLongPress: vi.fn() }))
    ).toThrow("onLongPress is not available on web maps.");
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

describe("mapbox-web sources and layers", () => {
  beforeEach(() => {
    resetWebMapMock();
  });

  const sourceCases: ReadonlyArray<readonly [string, SourceProps]> = [
    [
      "vector",
      {
        id: "tiles",
        type: "vector",
        tiles: ["https://example.com/{z}/{x}/{y}.pbf"],
        minzoom: 2,
        maxzoom: 16,
        scheme: "tms",
        attribution: "Example",
      },
    ],
    [
      "raster",
      {
        id: "base",
        type: "raster",
        url: "https://example.com/raster.json",
        tileSize: 512,
      },
    ],
    [
      "raster-dem",
      {
        id: "terrain",
        type: "raster-dem",
        url: "https://example.com/terrain.json",
        encoding: "mapbox",
        attribution: "Example",
        scheme: "tms",
      },
    ],
  ];

  test.each(sourceCases)(
    "a %s source forwards style-spec fields",
    (_family, props) => {
      render(tree(<Source {...props} />));

      expect(SourceMock).toHaveBeenCalledWith(
        expect.objectContaining({ ...props }),
        undefined
      );
    }
  );

  test("an image source forwards copied corners", () => {
    const coordinates = [
      [-122.5, 47.8],
      [-122.1, 47.8],
      [-122.1, 47.4],
      [-122.5, 47.4],
    ] as const;

    render(
      tree(
        <Source
          id="overlay"
          type="image"
          url="https://example.com/overlay.png"
          coordinates={coordinates}
        />
      )
    );

    const forwarded = SourceMock.mock.calls.at(-1)?.[0] as {
      coordinates: unknown;
    };

    expect(forwarded.coordinates).toEqual([
      [-122.5, 47.8],
      [-122.1, 47.8],
      [-122.1, 47.4],
      [-122.5, 47.4],
    ]);
    expect(forwarded.coordinates).not.toBe(coordinates);
  });

  test("a geojson source forwards cluster options and data updates", () => {
    const updated = { type: "FeatureCollection" as const, features: [] };
    const rendered = render(
      tree(
        <Source
          id="points"
          type="geojson"
          data={routes}
          cluster
          clusterRadius={50}
          clusterMaxZoom={12}
        />
      )
    );

    expect(SourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "points",
        data: routes,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
      }),
      undefined
    );

    rendered.rerender(
      tree(
        <Source
          id="points"
          type="geojson"
          data={updated}
          cluster
          clusterRadius={50}
          clusterMaxZoom={12}
        />
      )
    );

    expect(SourceMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ data: updated })
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

  test("a layer forwards filter, beforeId, and source-layer", () => {
    render(
      tree(
        <Source id="tiles" type="vector" url="https://example.com/t.json">
          <Layer
            id="roads"
            type="line"
            source-layer="road"
            filter={["==", ["get", "class"], "street"]}
            minzoom={5}
            maxzoom={18}
            beforeId="labels"
            paint={{ "line-width": 2 }}
          />
        </Source>
      )
    );

    expect(LayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "roads",
        type: "line",
        source: "tiles",
        "source-layer": "road",
        filter: ["==", ["get", "class"], "street"],
        minzoom: 5,
        maxzoom: 18,
        beforeId: "labels",
        paint: { "line-width": 2 },
      }),
      undefined
    );
  });

  test("a removed paint key leaves the layer props", () => {
    const rendered = render(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#2563eb", "line-width": 3 }}
          />
        </Source>
      )
    );

    rendered.rerender(
      tree(
        <Source id="routes" type="geojson" data={routes}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#2563eb" }}
          />
        </Source>
      )
    );

    expect(LayerMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ paint: { "line-color": "#2563eb" } })
    );
  });

  test("changing the injected source throws and asks for a remount", () => {
    const rendered = render(
      tree(<Layer id="route-line" type="line" source="routes" />)
    );

    expect(() =>
      rendered.rerender(
        tree(<Layer id="route-line" type="line" source="other" />)
      )
    ).toThrow('Layer "route-line" changed the creation option "source".');
  });
});

describe("mapbox-web images", () => {
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

  test("entries register through the callback loader and remove on unmount", async () => {
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
      "https://example.com/marker.png",
      expect.any(Function)
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

  test("style.load re-registers current entries after a replacement", async () => {
    render(tree(<Images images={{ marker: "https://example.com/m.png" }} />));
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(true);
    });

    target.clearImages();
    target.emitStyleLoad();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(true);
    });
    expect(target.addImage).toHaveBeenCalledTimes(2);
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

  test("added and removed entries update without reloading the rest", async () => {
    const rendered = render(
      tree(
        <Images
          images={{
            marker: "https://example.com/marker.png",
            shield: "https://example.com/shield.png",
          }}
        />
      )
    );
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(2);
    });

    rendered.rerender(
      tree(
        <Images
          images={{
            marker: "https://example.com/marker.png",
            pin: "https://example.com/pin.png",
          }}
        />
      )
    );

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledWith(
        "pin",
        expect.objectContaining({ url: "https://example.com/pin.png" }),
        {}
      );
    });
    expect(target.removeImage).toHaveBeenCalledWith("shield");
    expect(target.removeImage).not.toHaveBeenCalledWith("marker");
    expect(target.hasImage("marker")).toBe(true);
  });

  test("a changed URL reloads that image", async () => {
    const rendered = render(
      tree(<Images images={{ marker: "https://example.com/a.png" }} />)
    );
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(
      tree(<Images images={{ marker: "https://example.com/b.png" }} />)
    );

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledWith(
        "marker",
        expect.objectContaining({ url: "https://example.com/b.png" }),
        {}
      );
    });
    expect(target.removeImage).toHaveBeenCalledWith("marker");
  });

  test("a URL change while a load is pending registers only the new image", async () => {
    const rendered = render(tree(null));
    const target = loadedStyle();

    const pending = new Map<
      string,
      (error: unknown, image?: unknown) => void
    >();

    target.loadImage.mockImplementation(
      (url: string, callback?: (error: unknown, image?: unknown) => void) => {
        if (callback) {
          pending.set(url, callback);
        }

        return undefined;
      }
    );

    rendered.rerender(
      tree(<Images images={{ marker: "https://example.com/a.png" }} />)
    );

    expect(pending.has("https://example.com/a.png")).toBe(true);

    rendered.rerender(
      tree(<Images images={{ marker: "https://example.com/b.png" }} />)
    );

    expect(pending.has("https://example.com/b.png")).toBe(true);

    pending.get("https://example.com/a.png")?.(null, {
      url: "https://example.com/a.png",
      width: 1,
      height: 1,
    });
    expect(target.addImage).not.toHaveBeenCalled();

    pending.get("https://example.com/b.png")?.(null, {
      url: "https://example.com/b.png",
      width: 1,
      height: 1,
    });

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(1);
    });
    expect(target.addImage).toHaveBeenCalledWith(
      "marker",
      expect.objectContaining({ url: "https://example.com/b.png" }),
      {}
    );
  });

  test("registration waits until the style is loaded", async () => {
    render(tree(<Images images={{ marker: "https://example.com/m.png" }} />));
    const target = getStyleTarget();

    if (!target) {
      throw new Error("Map did not attach");
    }

    expect(target.addImage).not.toHaveBeenCalled();

    target.emitStyleLoad();

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(1);
    });
    expect(target.hasImage("marker")).toBe(true);
  });

  test("a thrown addImage stays unregistered until the next style.load", async () => {
    render(tree(<Images images={{ marker: "https://example.com/m.png" }} />));
    const target = getStyleTarget();

    if (!target) {
      throw new Error("Map did not attach");
    }

    target.addImage.mockImplementationOnce(() => {
      throw new Error("addImage failed");
    });
    target.emitStyleLoad();

    await waitFor(() => {
      expect(target.addImage).toHaveBeenCalledTimes(1);
    });
    expect(target.hasImage("marker")).toBe(false);

    target.emitStyleLoad();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(true);
    });
  });

  test("images outside a map are rejected", () => {
    expect(() =>
      render(
        <MapSetup adapter={adapter}>
          <Images images={{ marker: "https://example.com/m.png" }} />
        </MapSetup>
      )
    ).toThrow("Images must render inside Map.");
  });
});

describe("mapbox-web queries and feature state", () => {
  beforeEach(() => {
    resetWebMapMock();
  });

  test("queryRenderedFeatures forwards point, bounds, and viewport targets", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    await ref.current?.queryRenderedFeatures([240, 320], {
      layers: ["route-line"],
      filter: ["==", "kind", "route"],
    });

    expect(mockQueryRenderedFeatures).toHaveBeenCalledWith([240, 320], {
      layers: ["route-line"],
      filter: ["==", "kind", "route"],
    });

    await ref.current?.queryRenderedFeatures([
      [10, 20],
      [30, 40],
    ]);

    expect(mockQueryRenderedFeatures).toHaveBeenLastCalledWith(
      [
        [10, 20],
        [30, 40],
      ],
      undefined
    );

    await ref.current?.queryRenderedFeatures(undefined);

    expect(mockQueryRenderedFeatures).toHaveBeenLastCalledWith(
      undefined,
      undefined
    );
  });

  test("queryRenderedFeatures preserves duplicate features in order", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    const features = await ref.current?.queryRenderedFeatures([1, 2]);

    expect(features).toHaveLength(2);
    expect(features?.[0]).toHaveProperty("id", 1);
    expect(features?.[1]).toHaveProperty("id", 1);
  });

  test("querySourceFeatures forwards the source id and options", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    await ref.current?.querySourceFeatures("routes", {
      sourceLayer: "way",
      filter: ["==", "kind", "route"],
    });

    expect(mockQuerySourceFeatures).toHaveBeenCalledWith("routes", {
      sourceLayer: "way",
      filter: ["==", "kind", "route"],
    });
  });

  test("cluster methods dispatch through the source and callbacks", async () => {
    const ref = createRef<MapRef>();

    registerMockSource("routes", mockClusterSource);
    render(example(ref));

    await expect(
      ref.current?.getClusterExpansionZoom("routes", 7)
    ).resolves.toBe(13);

    expect(mockClusterSource.getClusterExpansionZoom).toHaveBeenCalledWith(
      7,
      expect.any(Function)
    );

    await expect(
      ref.current?.getClusterLeaves("routes", 7, 10, 2)
    ).resolves.toHaveLength(2);

    expect(mockClusterSource.getClusterLeaves).toHaveBeenCalledWith(
      7,
      10,
      2,
      expect.any(Function)
    );

    await expect(
      ref.current?.getClusterChildren("routes", 7)
    ).resolves.toHaveLength(1);
  });

  test("cluster methods reject when the source is missing", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));

    await expect(
      ref.current?.getClusterExpansionZoom("unknown", 7)
    ).rejects.toThrow('Source "unknown" is not present');
  });

  test("setFeatureState forwards the identifier object and state", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    await ref.current?.setFeatureState(
      { source: "routes", id: "route-1" },
      { selected: true }
    );

    expect(mockSetFeatureState).toHaveBeenCalledWith(
      { source: "routes", id: "route-1" },
      { selected: true }
    );
  });

  test("setFeatureState rejects sparse arrays before renderer dispatch", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: "route-1" },
        // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
        { meta: { values: new Array<number>(1) } }
      )
    ).rejects.toThrow('Feature state key "meta"');
    expect(mockSetFeatureState).not.toHaveBeenCalled();
  });

  test("setFeatureState includes sourceLayer and rejects invalid state", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    registerMockSource("tiles", { type: "vector" });

    await expect(
      ref.current?.setFeatureState(
        { source: "tiles", id: 7, sourceLayer: "way" },
        { meta: { level: null as unknown as number } }
      )
    ).rejects.toThrow("non-finite");

    expect(mockSetFeatureState).not.toHaveBeenCalled();
  });

  test("getFeatureState resolves absent state to an empty object", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));

    await expect(
      ref.current?.getFeatureState({ source: "routes", id: "route-1" })
    ).resolves.toEqual({});
    expect(mockGetFeatureState).toHaveBeenCalledWith({
      source: "routes",
      id: "route-1",
    });
  });

  test("removeFeatureState forwards an optional key", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));
    await ref.current?.removeFeatureState({ source: "routes", id: "route-1" });
    await ref.current?.removeFeatureState(
      { source: "routes", id: "route-1" },
      "selected"
    );

    expect(mockRemoveFeatureState).toHaveBeenNthCalledWith(
      1,
      { source: "routes", id: "route-1" },
      undefined
    );
    expect(mockRemoveFeatureState).toHaveBeenNthCalledWith(
      2,
      { source: "routes", id: "route-1" },
      "selected"
    );
  });

  test("feature state methods reject malformed identifiers", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));

    await expect(
      ref.current?.setFeatureState(
        { source: "", id: "route-1" },
        { selected: true }
      )
    ).rejects.toThrow("nonempty string");

    await expect(
      ref.current?.getFeatureState({
        source: "routes",
        id: undefined as unknown as string,
      })
    ).rejects.toThrow("string or number id");
  });
});

describe("web correction regressions", () => {
  beforeEach(() => resetWebMapMock());
  test("padding updates and resets once without controlling the camera", () => {
    const rendered = render(example());
    const props = () =>
      MapMock.mock.calls.at(-1)?.[0] as {
        padding?: object;
        viewState?: object;
        initialViewState?: object;
      };
    expect(props().padding).toBeUndefined();
    rendered.rerender(example(undefined, undefined, { padding: { top: 24 } }));
    expect(props().padding).toEqual({ top: 24, bottom: 0, left: 0, right: 0 });
    expect(props().viewState).toBeUndefined();
    rendered.rerender(example());
    expect(props().padding).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    rendered.rerender(example());
    expect(props().padding).toBeUndefined();
  });
  test("double-tap and double-click flags share the web handler", () => {
    const rendered = render(
      example(undefined, undefined, { doubleTapZoom: false })
    );
    expect(MapMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ doubleClickZoom: false })
    );
    rendered.rerender(
      example(undefined, undefined, {
        doubleTapZoom: true,
        doubleClickZoom: true,
      })
    );
    expect(MapMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ doubleClickZoom: true })
    );
    rendered.rerender(example());
    expect(MapMock.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      "doubleClickZoom"
    );
    expect(() =>
      rendered.rerender(
        example(undefined, undefined, {
          doubleTapZoom: false,
          doubleClickZoom: true,
        })
      )
    ).toThrow("must agree");
  });
  test("rotation reset and unmount release overrides on reused maps", () => {
    const rendered = render(
      example(undefined, undefined, { touchRotate: false, reuseMaps: true })
    );
    expect(disableRotation).toHaveBeenCalledTimes(1);
    rendered.rerender(
      example(undefined, undefined, { touchZoom: false, reuseMaps: true })
    );
    expect(enableRotation).toHaveBeenCalledTimes(1);
    expect(MapMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ touchZoomRotate: false })
    );
    rendered.rerender(
      example(undefined, undefined, { touchRotate: false, reuseMaps: true })
    );
    rendered.unmount();
    expect(enableRotation).toHaveBeenCalledTimes(2);
    render(example(undefined, undefined, { reuseMaps: true }));
    expect(enableRotation).toHaveBeenCalledTimes(2);
  });
  test.each(["set", "get", "remove"] as const)(
    "%s feature state preflights source families and vector sourceLayer",
    async (method) => {
      const ref = createRef<MapRef>();
      render(example(ref));
      const dispatch = (source: string, sourceLayer?: string) => {
        const target = { source, sourceLayer, id: 7 };
        if (method === "set")
          return ref.current?.setFeatureState(target, { selected: true });
        if (method === "get") return ref.current?.getFeatureState(target);
        return ref.current?.removeFeatureState(target);
      };
      await expect(dispatch("absent")).rejects.toThrow("not present");
      registerMockSource("terrain", { type: "raster-dem" });
      await expect(dispatch("terrain")).rejects.toThrow("GeoJSON or vector");
      registerMockSource("tiles", { type: "vector" });
      await expect(dispatch("tiles")).rejects.toThrow("nonempty sourceLayer");
      await expect(dispatch("tiles", "  ")).rejects.toThrow(
        "nonempty sourceLayer"
      );
      expect(mockSetFeatureState).not.toHaveBeenCalled();
      expect(mockGetFeatureState).not.toHaveBeenCalled();
      expect(mockRemoveFeatureState).not.toHaveBeenCalled();
      await dispatch("tiles", "way");
    }
  );
  test.each([undefined, null])(
    "absent web state result %s rejects",
    async (absent) => {
      const ref = createRef<MapRef>();
      render(example(ref));
      mockGetFeatureState.mockImplementationOnce(
        // Deliberate malformed renderer response at the test boundary.
        () => absent as unknown as Record<string, unknown>
      );
      await expect(
        ref.current?.getFeatureState({ source: "routes", id: 1 })
      ).rejects.toThrow("returned no result");
    }
  );
  test("removing a pending image during style loading invalidates its completion", async () => {
    const rendered = render(
      tree(<Images images={{ delayed: "https://example.com/delayed.png" }} />)
    );
    const target = getStyleTarget();
    if (!target) throw new Error("missing mock map");
    target.emitStyleLoad();
    // First let the initial registration finish, then start a deferred replacement.
    await waitFor(() => expect(target.hasImage("delayed")).toBe(true));
    let finish: (data: unknown) => void = () => {};
    target.loadImage.mockImplementationOnce((_url, callback) => {
      const promise = new Promise<unknown>((resolve) => {
        finish = (data) => {
          callback?.(null, data);
          resolve({ data });
        };
      });
      return promise;
    });
    rendered.rerender(
      tree(<Images images={{ delayed: "https://example.com/replaced.png" }} />)
    );
    const ready = vi.spyOn(target, "isStyleLoaded").mockReturnValue(false);
    rendered.rerender(tree(<Images images={{}} />));
    ready.mockReturnValue(true);
    finish({ width: 1, height: 1, data: new Uint8Array(4) });
    await Promise.resolve();
    target.emitStyleLoad();
    await waitFor(() => expect(target.hasImage("delayed")).toBe(false));
    expect(target.addImage).toHaveBeenCalledTimes(1);
    ready.mockRestore();
  });
});

test("registered image removals retry when image methods are unavailable", async () => {
  resetWebMapMock();
  const rendered = render(
    tree(<Images images={{ marker: "https://example.com/marker.png" }} />)
  );
  const target = getStyleTarget();
  if (!target) throw new Error("missing mock map");
  target.emitStyleLoad();
  await waitFor(() => expect(target.hasImage("marker")).toBe(true));
  const ready = vi.spyOn(target, "isStyleLoaded").mockReturnValue(false);
  target.removeImage.mockImplementationOnce(() => {
    throw new Error("Style image methods unavailable.");
  });
  rendered.rerender(tree(<Images images={{}} />));
  expect(target.hasImage("marker")).toBe(true);
  ready.mockReturnValue(true);
  target.emitStyleLoad();
  expect(target.hasImage("marker")).toBe(false);
  ready.mockRestore();
});

runWebFollowupRegressions(
  adapter,
  (await vi.importMock("react-map-gl/mapbox")) as WebMapMockModule
);

test("a removed and re-added image ignores the earlier load of the same URL", async () => {
  resetWebMapMock();
  const rendered = render(tree(<Images images={{}} />));
  const target = getStyleTarget();
  if (!target) throw new Error("missing mock map");
  target.emitStyleLoad();
  const completions: Array<(image: object) => void> = [];
  target.loadImage.mockImplementation(
    (_url, callback) =>
      new Promise((resolve) => {
        completions.push((image) => {
          callback?.(null, image);
          resolve({ data: image });
        });
      })
  );
  const entry = { marker: "https://example.com/marker.png" };
  rendered.rerender(tree(<Images images={entry} />));
  rendered.rerender(tree(<Images images={{}} />));
  rendered.rerender(tree(<Images images={entry} />));
  expect(completions).toHaveLength(2);
  completions[0]?.({ version: "stale" });
  await Promise.resolve();
  expect(target.hasImage("marker")).toBe(false);
  completions[1]?.({ version: "current" });
  await waitFor(() => expect(target.hasImage("marker")).toBe(true));
  expect(target.addImage).toHaveBeenCalledWith(
    "marker",
    { version: "current" },
    {}
  );
});

test("controlled web padding receives a zero reset", () => {
  resetWebMapMock();
  const rendered = render(
    example(undefined, undefined, {
      viewState: initialViewState,
      padding: { left: 30 },
    })
  );
  rendered.rerender(
    example(undefined, undefined, { viewState: initialViewState })
  );
  expect(MapMock.mock.calls.at(-1)?.[0]).toEqual(
    expect.objectContaining({
      viewState: {
        ...initialViewState,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
    })
  );
});
