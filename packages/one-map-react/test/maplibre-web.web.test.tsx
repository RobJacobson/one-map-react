import { act, render, waitFor } from "@testing-library/react";
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
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Source } from "../src/facade/source.js";
import type { createWebMapMock } from "./create-web-map-mock.js";
import { runWebFollowupRegressions } from "./web-followup-regressions.js";

vi.mock("react-map-gl/maplibre", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");

  return createWebMapMock();
});

import {
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  Source as MaplibreSource,
} from "react-map-gl/maplibre";

import { adapter, Map as SelectedMap } from "../src/maplibre-web.js";

type WebMapMockModule = ReturnType<typeof createWebMapMock>;

const MapMock = MaplibreMap as unknown as Mock;
const LayerMock = MaplibreLayer as unknown as Mock;
const SourceMock = MaplibreSource as unknown as Mock;
const {
  resetWebMapMock,
  enableRotation,
  disableRotation,
  getStyleTarget,
  flyTo: mockFlyTo,
  resize: mockResize,
  queryRenderedFeatures: mockQueryRenderedFeatures,
  querySourceFeatures: mockQuerySourceFeatures,
  getSource: mockGetSource,
  setFeatureState: mockSetFeatureState,
  getFeatureState: mockGetFeatureState,
  removeFeatureState: mockRemoveFeatureState,
  registerMockSource,
  enableControlledSizeFeedback,
} = (await vi.importMock("react-map-gl/maplibre")) as WebMapMockModule;

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

  test("styledata does not replay dropped images", async () => {
    render(tree(<Images images={{ marker: "https://example.com/m.png" }} />));
    const target = loadedStyle();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(true);
    });

    // Style replacement drops registered images on the renderer.
    target.clearImages();
    target.emitStyleData();

    await waitFor(() => {
      expect(target.hasImage("marker")).toBe(false);
    });
    expect(target.addImage).toHaveBeenCalledTimes(1);
  });
});

// MapLibre GL cluster sources return promises rather than callbacks.
const maplibreClusterSource = {
  getClusterExpansionZoom: vi.fn(async () => 13),
  getClusterChildren: vi.fn(async () => [{ type: "Feature", id: 11 }]),
  getClusterLeaves: vi.fn(async () => [
    { type: "Feature", id: 21 },
    { type: "Feature", id: 22 },
  ]),
};

describe("maplibre-web queries and feature state", () => {
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

  test("cluster methods await the promise-returning source", async () => {
    const ref = createRef<MapRef>();

    registerMockSource("routes", maplibreClusterSource);
    render(example(ref));

    await expect(
      ref.current?.getClusterExpansionZoom("routes", 7)
    ).resolves.toBe(13);
    expect(maplibreClusterSource.getClusterExpansionZoom).toHaveBeenCalledWith(
      7
    );

    await expect(
      ref.current?.getClusterLeaves("routes", 7, 10, 2)
    ).resolves.toHaveLength(2);
    expect(maplibreClusterSource.getClusterLeaves).toHaveBeenCalledWith(
      7,
      10,
      2
    );

    await expect(
      ref.current?.getClusterChildren("routes", 7)
    ).resolves.toHaveLength(1);
  });

  test("cluster methods reject when the source is missing", async () => {
    const ref = createRef<MapRef>();

    render(example(ref));

    await expect(
      ref.current?.getClusterLeaves("unknown", 7, 10, 0)
    ).rejects.toThrow('Source "unknown" is not present');
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

  test("feature state methods forward identifiers and validate state", async () => {
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

    await expect(
      ref.current?.getFeatureState({ source: "routes", id: 9 })
    ).resolves.toEqual({});
    await ref.current?.removeFeatureState(
      { source: "routes", id: 9, sourceLayer: "way" },
      "selected"
    );

    expect(mockRemoveFeatureState).toHaveBeenCalledWith(
      { source: "routes", id: 9, sourceLayer: "way" },
      "selected"
    );

    await expect(
      ref.current?.setFeatureState(
        { source: "routes", id: "route-1" },
        { selected: Number.NaN }
      )
    ).rejects.toThrow("non-finite");
    expect(mockGetSource).toHaveBeenCalledWith("routes");
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

test("failed image cleanup reports an error without style-event retry", async () => {
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
  expect(target.hasImage("marker")).toBe(true);
  expect(target.removeImage).toHaveBeenCalledTimes(1);
  ready.mockRestore();
});

runWebFollowupRegressions(
  adapter,
  (await vi.importMock("react-map-gl/maplibre")) as WebMapMockModule
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
      ...initialViewState,
      viewState: undefined,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
    })
  );
});

test("portable controlled camera settles repeated MapLibre resize/move feedback without suppressing movement", () => {
  resetWebMapMock();
  enableControlledSizeFeedback();
  const onMove = vi.fn();
  const onResize = vi.fn();
  const target = {
    longitude: 12,
    latitude: 34,
    zoom: 5,
    bearing: 60,
    pitch: 20,
  };
  const mounted = render(
    example(undefined, onMove, {
      viewState: target,
      padding: { left: 30 },
      onResize,
    })
  );
  expect(mockResize).not.toHaveBeenCalled();
  expect(lastMapProps()).toMatchObject({
    ...target,
    viewState: undefined,
    padding: { top: 0, bottom: 0, left: 30, right: 0 },
  });
  for (let report = 0; report < 5; report += 1) {
    act(() => {
      lastMapProps<{ onResize: () => void }>().onResize();
      lastMapProps<{ onMove: (event: object) => void }>().onMove({
        viewState: { ...target },
        originalEvent: {},
      });
    });
  }
  expect(onMove).toHaveBeenCalledTimes(5);
  expect(onResize).toHaveBeenCalledTimes(5);
  expect(mockResize).not.toHaveBeenCalled();
  const next = {
    ...target,
    longitude: 13,
    latitude: 35,
    zoom: 6,
    bearing: 70,
    pitch: 25,
  };
  mounted.rerender(example(undefined, onMove, { viewState: next }));
  expect(lastMapProps()).toMatchObject({
    ...next,
    viewState: undefined,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  mounted.rerender(example(undefined, onMove));
  expect(lastMapProps()).toMatchObject({
    longitude: undefined,
    latitude: undefined,
    zoom: undefined,
    bearing: undefined,
    pitch: undefined,
    viewState: undefined,
    padding: undefined,
  });
  expect(mockResize).not.toHaveBeenCalled();
  mounted.unmount();
});

test("common MapLibre control overrides selected camera options and releases back to them", () => {
  resetWebMapMock();
  enableControlledSizeFeedback();
  const selected = { longitude: 1, latitude: 2, zoom: 3, bearing: 4, pitch: 5 };
  const target = { longitude: 0, latitude: 0, zoom: 0, bearing: 0, pitch: 0 };
  const tree = (controlled: boolean) => (
    <MapSetup adapter={adapter}>
      <SelectedMap
        mapStyle={{ version: 8, sources: {}, layers: [] }}
        initialViewState={initialViewState}
        options={selected}
        viewState={controlled ? target : undefined}
      />
    </MapSetup>
  );
  const mounted = render(tree(true));
  expect(lastMapProps()).toMatchObject({ ...target, viewState: undefined });
  mounted.rerender(tree(false));
  expect(lastMapProps()).toMatchObject({ ...selected, viewState: undefined });
  expect(mockResize).not.toHaveBeenCalled();
  mounted.unmount();
});
