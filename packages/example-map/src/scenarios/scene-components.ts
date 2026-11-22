import type { LngLat, MapLayoutStyle, Point, ViewState } from "one-map-react";
import type { ComponentType, ReactNode, RefCallback } from "react";
import type {
  LayerProps as BoxLayerProps,
  MapProps as BoxMapProps,
  SourceProps as BoxSourceProps,
} from "react-map-gl/mapbox";
import type {
  LayerProps as LibreLayerProps,
  MapProps as LibreMapProps,
  SourceProps as LibreSourceProps,
} from "react-map-gl/maplibre";

import type { BrowserStyleImageMap } from "./web-style-image.js";

/** The renderer entries used by browser acceptance. */
export type WebBackend = "mapbox-web" | "maplibre-web";

/** Coordinates returned by the selected renderer, before making a test receipt. */
export type MapCoordinate =
  | LngLat
  | { readonly lng: number; readonly lat: number };

/** Points returned by the selected renderer, before making a test receipt. */
export type MapPoint = Point | { readonly x: number; readonly y: number };

/** Mutable bounds accepted by both stock renderers and the native shim. */
export type SceneBounds = [[number, number], [number, number]];

/** The stock browser style shape shared by these fixtures. */
export type SceneStyle = Extract<BoxMapProps["mapStyle"], { version: 8 }> &
  Extract<LibreMapProps["mapStyle"], { version: 8 }>;

/** Only renderer methods used to collect the shared scene observations. */
export interface SceneMap {
  getCenter(): MapCoordinate | Promise<MapCoordinate>;
  isStyleLoaded?(): boolean | void;
  queryTerrainElevation?(
    coordinate: [number, number]
  ): number | null | undefined | Promise<number | null>;
  getZoom(): number | Promise<number>;
  getBearing(): number | Promise<number>;
  getPitch(): number | Promise<number>;
  jumpTo(
    target: Partial<Omit<ViewState, "longitude" | "latitude">> & {
      readonly center?: [number, number];
    }
  ): unknown;
  flyTo(target: {
    readonly center: [number, number];
    readonly duration?: number;
  }): unknown;
  fitBounds(
    bounds: SceneBounds,
    options: { readonly duration: number }
  ): unknown;
  stop(): unknown;
  project(coordinate: [number, number]): MapPoint | Promise<MapPoint>;
  queryRenderedFeatures(
    point?: [number, number] | SceneBounds,
    options?: { layers?: string[] }
  ): readonly object[] | Promise<readonly object[]>;
}

/** Camera fields used by scenario observations. */
export interface SceneMove {
  readonly viewState: ViewState;
  readonly origin?: string;
  readonly originalEvent?: unknown;
}

/** Click fields used by scenario observations. */
export interface SceneClick {
  readonly lngLat: MapCoordinate;
  readonly features?: readonly { readonly id?: string | number }[];
}

/** Stock browser handle used by the scenes that register images or capture canvases. */
export interface WebSceneMap extends SceneMap, BrowserStyleImageMap {
  getCanvas(): HTMLCanvasElement;
  getMap(): {
    getTerrain(): unknown;
    setTerrain(terrain: null): unknown;
    touchZoomRotate: { enableRotation(): void; disableRotation(): void };
  };
  isStyleLoaded(): boolean | void;
  queryTerrainElevation(
    coordinate: [number, number]
  ): number | null | undefined;
}

type SceneWebMapProps = {
  readonly ref?: RefCallback<WebSceneMap>;
  readonly id?: string;
  readonly mapStyle: SceneStyle | string;
  readonly initialViewState: ViewState;
  readonly style?: MapLayoutStyle;
  readonly gl?: WebGLRenderingContext;
  readonly reuseMaps?: boolean;
  readonly interactiveLayerIds?: string[];
  readonly onClick?: (event: SceneClick) => void;
  readonly onMove?: (event: SceneMove) => void;
  readonly onMoveStart?: () => void;
  readonly onMoveEnd?: (event: SceneMove) => void;
  readonly onError?: (event: { readonly error: unknown }) => void;
  readonly onLoad?: () => void;
  readonly onIdle?: () => void;
  readonly children?: ReactNode;
} & Pick<
  BoxMapProps,
  | "preserveDrawingBuffer"
  | "longitude"
  | "latitude"
  | "zoom"
  | "bearing"
  | "pitch"
  | "padding"
  | "boxZoom"
  | "dragPan"
  | "dragRotate"
  | "doubleClickZoom"
  | "scrollZoom"
  | "keyboard"
  | "touchPitch"
  | "touchZoomRotate"
  | "light"
  | "terrain"
  | "minZoom"
  | "projection"
> &
  Pick<LibreMapProps, "canvasContextAttributes"> & {
    readonly maxBounds?: [number, number, number, number];
  };

interface SceneMarkerProps {
  readonly longitude: number;
  readonly latitude: number;
  readonly offset?: [number, number];
  readonly draggable?: boolean;
  readonly onClick?: () => void;
  readonly onDragStart?: () => void;
  readonly onDrag?: (event: { readonly lngLat: MapCoordinate }) => void;
  readonly onDragEnd?: (event: { readonly lngLat: MapCoordinate }) => void;
  readonly children?: ReactNode;
}

/** Direct stock components, typed to the props used by the browser scenarios. */
export interface WebSceneComponents {
  readonly platform: "web";
  readonly Map: ComponentType<SceneWebMapProps>;
  readonly Source: ComponentType<BoxSourceProps & LibreSourceProps>;
  readonly Layer: ComponentType<BoxLayerProps & LibreLayerProps>;
  readonly Marker: ComponentType<SceneMarkerProps>;
}

/** Native bindings supplied by a native-only scenario entry point. */
export interface NativeSceneComponents {
  readonly platform: "native";
  readonly Map: typeof import("one-map-react/legacy").Map;
  readonly Marker: typeof import("one-map-react/legacy").Marker;
  readonly Source: typeof import("one-map-react/legacy").Source;
  readonly Layer: typeof import("one-map-react/legacy").Layer;
  readonly Images: typeof import("one-map-react/native-extensions").Images;
  readonly UserLocation: typeof import("one-map-react/native-extensions").UserLocation;
  readonly captureRendering: typeof import("./capture-rendering.native.js").captureRendering;
}

/**
 * Identifies the stock handle in a scene that also accepts a native attachment.
 *
 * @param map - Ref delivered by the selected component.
 * @returns Whether browser-only drawing methods are present.
 */
export const isBrowserMap = (map: unknown): map is WebSceneMap =>
  map !== null &&
  typeof map === "object" &&
  "getCanvas" in map &&
  typeof map.getCanvas === "function";

/**
 * Converts a camera or click coordinate into the acceptance receipt format.
 *
 * @param value - Coordinate from an attached renderer.
 * @returns Longitude and latitude in receipt order.
 */
export const coordinateTuple = (value: MapCoordinate): [number, number] =>
  "lng" in value ? [value.lng, value.lat] : [value[0], value[1]];

/**
 * Converts a projected point into the acceptance receipt format.
 *
 * @param value - Point from an attached renderer.
 * @returns Horizontal and vertical layout values.
 */
export const pointTuple = (value: MapPoint): [number, number] =>
  "x" in value ? [value.x, value.y] : [value[0], value[1]];
