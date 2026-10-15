import type { ComponentType, CSSProperties, ReactNode, Ref } from "react";

import type { Backend } from "../../contracts/adapter.js";
import type {
  Bounds,
  LngLat,
  Padding,
  Point,
  ViewState,
} from "../../contracts/camera-types.js";
import type {
  ExternalDrawingContext,
  MapProps,
} from "../../contracts/map-types.js";

interface TouchZoomRotateHandler {
  disableRotation: () => void;
  enableRotation: () => void;
}

interface StyleLoadTarget {
  on(
    type: "style.load" | "load" | "idle" | "render",
    listener: () => void
  ): void;
  on(type: "error", listener: (event: WebErrorNotice) => void): void;
  off(
    type: "style.load" | "load" | "idle" | "render",
    listener: () => void
  ): void;
  off(type: "error", listener: (event: WebErrorNotice) => void): void;
  // Pinned maplibre-gl returns void while no style is loaded; mapbox-gl
  // returns boolean. Callers treat non-true as not loaded.
  isStyleLoaded: () => unknown;
  touchZoomRotate?: TouchZoomRotateHandler;
  /** Current canvas, used only by opt-in capture. */
  getCanvas?: () => {
    readonly width: number;
    readonly height: number;
    toDataURL(type: string): string;
    getContext(type: "webgl2" | "webgl"): {
      getContextAttributes(): { preserveDrawingBuffer?: boolean } | null;
    } | null;
  };
  /** Capture requires an actual rendered frame; wrapper lifecycle owns these events. */
  triggerRepaint?: () => void;
}

interface WebMapHandle {
  jumpTo: (options: object) => unknown;
  easeTo: (options: object) => unknown;
  flyTo: (options: object) => unknown;
  fitBounds: (bounds: Bounds, options?: object) => unknown;
  zoomTo: (zoom: number, options?: object) => unknown;
  stop: () => unknown;
  resize: () => unknown;
  getCenter: () => unknown;
  getZoom: () => unknown;
  getBearing: () => unknown;
  getPitch: () => unknown;
  getPadding: () => unknown;
  getBounds: () => unknown;
  getMinZoom: () => unknown;
  getMaxZoom: () => unknown;
  getMaxBounds: () => unknown;
  project: (lngLat: LngLat) => unknown;
  unproject: (point: Point) => unknown;
  queryRenderedFeatures: (geometry?: unknown, options?: object) => unknown;
  querySourceFeatures: (sourceId: string, params?: object) => unknown;
  getSource: (id: string) => unknown;
  getLayer: (id: string) => unknown;
  setFeatureState: (target: object, state: object) => unknown;
  getFeatureState: (target: object) => unknown;
  removeFeatureState: (target: object, key?: string) => unknown;
  getMap: () => StyleLoadTarget;
}

/**
 * Cluster methods on a web GeoJSON source.
 *
 * Mapbox GL reports results through a trailing callback while MapLibre GL
 * returns promises, so both entries see one rest-argument signature and
 * normalize the result through {@link WebWrapper.callWebCluster}.
 */
interface WebClusterSource {
  readonly getClusterExpansionZoom: (...args: unknown[]) => unknown;
  readonly getClusterChildren: (...args: unknown[]) => unknown;
  readonly getClusterLeaves: (...args: unknown[]) => unknown;
}

/** Cluster method name shared by both web renderers. */
type WebClusterMethod =
  | "getClusterExpansionZoom"
  | "getClusterChildren"
  | "getClusterLeaves";

interface WebMoveNotice {
  readonly viewState: ViewState;
  readonly originalEvent?: unknown;
}

interface WebPointerNotice {
  readonly lngLat?: unknown;
  readonly point?: unknown;
  readonly features?: readonly object[];
}

interface WebErrorNotice {
  readonly error?: unknown;
}

interface WebViewState extends ViewState {
  readonly padding?: Required<Padding>;
}

interface WebMapProps {
  readonly mapStyle: MapProps["mapStyle"];
  readonly initialViewState: WebViewState;
  readonly viewState?: WebViewState;
  readonly padding?: Required<Padding>;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly maxBounds?: readonly [number, number, number, number];
  readonly style?: CSSProperties;
  readonly reuseMaps?: boolean;
  readonly preserveDrawingBuffer?: boolean;
  readonly canvasContextAttributes?: {
    readonly preserveDrawingBuffer: boolean;
  };
  readonly gl?: ExternalDrawingContext;
  /** Layers included in wrapper pointer feature hits. */
  readonly interactiveLayerIds?: string[];
  readonly interactive?: boolean;
  readonly dragPan?: boolean;
  readonly scrollZoom?: boolean;
  readonly doubleClickZoom?: boolean;
  readonly dragRotate?: boolean;
  readonly boxZoom?: boolean;
  readonly keyboard?: boolean;
  readonly cooperativeGestures?: boolean;
  readonly clickTolerance?: number;
  readonly hash?: boolean | string;
  readonly touchPitch?: boolean;
  readonly touchZoomRotate?: boolean;
  readonly onMove?: (event: WebMoveNotice) => void;
  readonly onMoveStart?: (event: WebMoveNotice) => void;
  readonly onMoveEnd?: (event: WebMoveNotice) => void;
  readonly onIdle?: () => void;
  readonly onClick?: (event: WebPointerNotice) => void;
  readonly onDblClick?: (event: WebPointerNotice) => void;
  readonly onContextMenu?: (event: WebPointerNotice) => void;
  readonly onMouseDown?: (event: WebPointerNotice) => void;
  readonly onMouseUp?: (event: WebPointerNotice) => void;
  readonly onMouseMove?: (event: WebPointerNotice) => void;
  readonly onMouseEnter?: (event: WebPointerNotice) => void;
  readonly onMouseLeave?: (event: WebPointerNotice) => void;
  readonly onMouseOver?: (event: WebPointerNotice) => void;
  readonly onMouseOut?: (event: WebPointerNotice) => void;
  readonly onWheel?: (event: WebPointerNotice) => void;
  readonly onDrag?: (event: WebMoveNotice) => void;
  readonly onDragStart?: (event: WebMoveNotice) => void;
  readonly onDragEnd?: (event: WebMoveNotice) => void;
  readonly onTouchStart?: (event: WebPointerNotice) => void;
  readonly onTouchMove?: (event: WebPointerNotice) => void;
  readonly onTouchEnd?: (event: WebPointerNotice) => void;
  readonly onTouchCancel?: (event: WebPointerNotice) => void;
  readonly onLoad?: () => void;
  readonly onError?: (event: WebErrorNotice) => void;
  readonly onResize?: () => void;
  readonly children?: ReactNode;
  readonly ref?: Ref<WebMapHandle>;
}

/**
 * Props at the react-map-gl source and layer boundary.
 *
 * The facade converts common props before forwarding, so the wrapper's
 * fields stay opaque here. react-map-gl accepts every style-spec source
 * and layer field; the index signature covers that surface without
 * importing wrapper types into this shared web module.
 */
export interface WebForwardedProps {
  /** Resource id. */
  readonly id?: string;
  /** Nested layers for a source. */
  readonly children?: ReactNode;
  /** Forwarded style-spec fields. */
  readonly [key: string]: unknown;
}

/**
 * Style image operations used from the web map instance. Image loading
 * differs by renderer (Mapbox callbacks, MapLibre promises), so each web
 * adapter supplies `loadWebImage` on the wrapper record.
 */
interface WebImageMap {
  // Pinned maplibre-gl returns void while no style is loaded; mapbox-gl
  // returns boolean. Callers treat non-true as not loaded.
  isStyleLoaded: () => unknown;
  hasImage: (name: string) => boolean;
  // Each renderer declares its own image union; this boundary accepts any
  // decoded image a renderer-specific loadWebImage produced.
  // biome-ignore lint/suspicious/noExplicitAny: renderer-specific image union
  addImage: (name: string, image: any, options?: { sdf?: boolean }) => void;
  removeImage: (name: string) => void;
  on: (type: "styledata" | "style.load", listener: () => void) => void;
  off: (type: "styledata" | "style.load", listener: () => void) => void;
}

/**
 * Maps visible to a component inside react-map-gl; `current` is the
 * enclosing map.
 */
interface WebMapSelection {
  readonly current?: { readonly getMap: () => WebImageMap };
}

interface WebWrapper<
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
> {
  readonly backend: Name;
  readonly Map: ComponentType<WebMapProps>;
  readonly Source: ComponentType<WebForwardedProps>;
  readonly Layer: ComponentType<WebForwardedProps>;
  /** Live marker delegated to the selected wrapper. */
  readonly Marker: ComponentType<WebForwardedProps>;
  /** Standalone popup delegated to the selected wrapper. */
  readonly Popup: ComponentType<WebForwardedProps>;
  /** Selected wrapper navigation buttons and compass. */
  readonly NavigationControl: ComponentType<WebForwardedProps>;
  /** Selected wrapper attribution control. */
  readonly AttributionControl: ComponentType<WebForwardedProps>;
  /** Selected wrapper scale control. */
  readonly ScaleControl: ComponentType<WebForwardedProps>;
  /** Selected wrapper browser location control. */
  readonly GeolocateControl: ComponentType<WebForwardedProps>;
  /** Selected wrapper browser fullscreen control. */
  readonly FullscreenControl: ComponentType<WebForwardedProps>;
  /** Registers facade-owned hosts through the wrapper lifecycle. */
  readonly useControl: (
    create: () => WebCustomControl,
    options: { readonly position?: string }
  ) => WebCustomControl;
  readonly useMap: () => WebMapSelection;
  readonly loadWebImage: (map: WebImageMap, url: string) => Promise<unknown>;
  /**
   * Invokes a cluster method on a web GeoJSON source.
   *
   * Mapbox GL takes a trailing callback; MapLibre GL returns a promise. The
   * shared surface passes the source and forwarded arguments and adopts the
   * renderer's own result channel.
   */
  readonly callWebCluster: (
    source: WebClusterSource,
    method: WebClusterMethod,
    args: readonly unknown[]
  ) => Promise<unknown>;
}

/** DOM control owned by the facade and registered through react-map-gl. */
interface WebCustomControl {
  /** Portal container returned when the map adds the control. */
  readonly element: Element & { className: string; remove(): void };
  /** Returns the owned host; the wrapper appends it to the map. */
  readonly onAdd: () => Element;
  /** Removes the owned host when the wrapper releases this control. */
  readonly onRemove: () => void;
}

export type {
  StyleLoadTarget,
  WebClusterMethod,
  WebClusterSource,
  WebCustomControl,
  WebErrorNotice,
  WebImageMap,
  WebMapHandle,
  WebMapProps,
  WebMapSelection,
  WebMoveNotice,
  WebPointerNotice,
  WebViewState,
  WebWrapper,
};
