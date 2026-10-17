import type {
  ComponentProps,
  ComponentType,
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from "react";
import {
  AttributionControl as MaplibreAttributionControl,
  FullscreenControl as MaplibreFullscreenControl,
  GeolocateControl as MaplibreGeolocateControl,
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  type MapRef as MaplibreMapRef,
  type MapProps as SelectedWrapperMapProps,
  Marker as MaplibreMarker,
  NavigationControl as MaplibreNavigationControl,
  Popup as MaplibrePopup,
  ScaleControl as MaplibreScaleControl,
  Source as MaplibreSource,
  useControl,
  useMap,
} from "react-map-gl/maplibre";

import type { WebWrapper } from "./adapters/web/contracts.js";
import {
  createWebAdapter,
  type WebForwardedProps,
} from "./adapters/web/create-adapter.js";
import { createWebMethodForwarders } from "./adapters/web/method-forwarders.js";
import type { Adapter } from "./contracts/adapter.js";
import type { MapRef } from "./contracts/camera-types.js";
import type { MapProps } from "./contracts/map-types.js";
import type {
  AttributionControlProps,
  ControlProps,
  FullscreenControlProps,
  GeolocateControlProps,
  MarkerProps,
  MarkerRef,
  NavigationControlProps,
  PopupProps,
  ScaleControlProps,
} from "./contracts/ui-types.js";
import { Map as OneMap } from "./facade/map.js";
import {
  AttributionControl as OneAttributionControl,
  Control as OneControl,
  FullscreenControl as OneFullscreenControl,
  GeolocateControl as OneGeolocateControl,
  Marker as OneMarker,
  NavigationControl as OneNavigationControl,
  Popup as OnePopup,
  ScaleControl as OneScaleControl,
} from "./facade/ui.js";
import { useStableOptions } from "./facade/use-stable-options.js";

type WebControlHook = WebWrapper<"maplibre-web">["useControl"];

type MaplibreMapInstance = ReturnType<MaplibreMapRef["getMap"]>;

// MapLibre GL JS cluster sources return promises directly.
interface MaplibreClusterCaller {
  readonly getClusterExpansionZoom: (clusterId: number) => Promise<number>;
  readonly getClusterChildren: (
    clusterId: number
  ) => Promise<readonly object[]>;
  readonly getClusterLeaves: (
    clusterId: number,
    limit: number,
    offset: number
  ) => Promise<readonly object[]>;
}

const forwardedMethodNames = [
  "on",
  "off",
  "once",
  "addControl",
  "removeControl",
  "hasControl",
  "getSource",
  "getLayer",
  "getCanvas",
  "getCanvasContainer",
  "getContainer",
  "getStyle",
  "loaded",
  "isStyleLoaded",
  "areTilesLoaded",
  "triggerRepaint",
  "getVerticalFieldOfView",
  "setVerticalFieldOfView",
  "getTerrain",
  "getProjection",
  "getLight",
  "getStyleUrl",
  "redraw",
  "setSky",
  "getSky",
  "refreshTiles",
  "setGlyphs",
  "getGlyphs",
  "setFontFaces",
  "getFontFaces",
  "getPixelRatio",
  "setPixelRatio",
  "getRoll",
  "setRoll",
  "getCameraTargetElevation",
  "getCenterElevation",
  "setCenterElevation",
  "setTransformConstrain",
  "setGlobalStateProperty",
  "getGlobalState",
  "setSourceTileLodParams",
  "setTransformRequest",
] as const satisfies readonly (keyof MaplibreMapRef)[];

// The react-map-gl components accept the full style-spec surface; the facade
// converts props before they reach this boundary.
/** Selects maplibre-web and supplies react-map-gl MapLibre components. */
export const adapter: Adapter & { readonly backend: "maplibre-web" } =
  createWebAdapter({
    backend: "maplibre-web",
    createAdvancedMethods: (getHandle) => {
      const selectedHandle = () => getHandle() as unknown as MaplibreMapRef;
      return {
        ...createWebMethodForwarders(selectedHandle, forwardedMethodNames),
        setEventedParent: (
          ...args: Parameters<MaplibreMapInstance["setEventedParent"]>
        ) =>
          selectedHandle()
            .getMap()
            .setEventedParent(...args),
        fire: ((...args: Parameters<MaplibreMapInstance["fire"]>) =>
          selectedHandle()
            .getMap()
            .fire(...args)) as MaplibreMapInstance["fire"],
        getGestureHandler: <Name extends keyof WebGestureHandlers>(
          name: Name
        ): WebGestureHandlers[Name] => {
          const map = selectedHandle().getMap();
          const handlers = {
            boxZoom: map.boxZoom,
            doubleClickZoom: map.doubleClickZoom,
            dragPan: map.dragPan,
            dragRotate: map.dragRotate,
            keyboard: map.keyboard,
            scrollZoom: map.scrollZoom,
            touchPitch: map.touchPitch,
            touchZoomRotate: map.touchZoomRotate,
          };
          if (!Object.hasOwn(handlers, name))
            throw new RangeError(`Unknown gesture handler: ${name}`);
          return handlers[name];
        },
        getCancelPendingTileRequestsWhileZooming: (): boolean =>
          selectedHandle().getMap().cancelPendingTileRequestsWhileZooming,
        setCancelPendingTileRequestsWhileZooming: (value: boolean): void => {
          (
            getHandle() as unknown as MaplibreMapRef
          ).getMap().cancelPendingTileRequestsWhileZooming = value;
        },
        getVersion: (): string => selectedHandle().getMap().version,
        getCanvasSource: (id: string): import("maplibre-gl").CanvasSource => {
          const source = selectedHandle().getSource(id);
          if (!source || source.type !== "canvas")
            throw new Error(`Source "${id}" is not an attached CanvasSource.`);
          return source as import("maplibre-gl").CanvasSource;
        },
        getVideoSource: (id: string): import("maplibre-gl").VideoSource => {
          const source = selectedHandle().getSource(id);
          if (!source || source.type !== "video")
            throw new Error(`Source "${id}" is not an attached VideoSource.`);
          return source as import("maplibre-gl").VideoSource;
        },
        setDebugOptions: (options: Partial<WebDebugOptions>) => {
          const map = selectedHandle().getMap();
          Object.assign(map, options);
        },
        getDebugOptions: (): WebDebugOptions => {
          const map = selectedHandle().getMap();
          return {
            showCollisionBoxes: map.showCollisionBoxes,
            showTileBoundaries: map.showTileBoundaries,
            showOverdrawInspector: map.showOverdrawInspector,
            showPadding: map.showPadding,
            vertices: map.vertices,
            repaint: map.repaint,
          };
        },
      };
    },
    Map: MaplibreMap,
    Source: MaplibreSource as ComponentType<WebForwardedProps>,
    Layer: MaplibreLayer as Adapter["Layer"],
    Marker: MaplibreMarker as unknown as ComponentType<WebForwardedProps>,
    Popup: MaplibrePopup as unknown as ComponentType<WebForwardedProps>,
    NavigationControl:
      MaplibreNavigationControl as ComponentType<WebForwardedProps>,
    AttributionControl:
      MaplibreAttributionControl as ComponentType<WebForwardedProps>,
    ScaleControl: MaplibreScaleControl as ComponentType<WebForwardedProps>,
    GeolocateControl:
      MaplibreGeolocateControl as ComponentType<WebForwardedProps>,
    FullscreenControl:
      MaplibreFullscreenControl as ComponentType<WebForwardedProps>,
    useControl: useControl as unknown as WebControlHook,
    useMap,
    // MapLibre GL resolves image loads with a { data } response; the shared
    // web surface omits the loader so each entry normalizes its own.
    loadWebImage: (map, url) =>
      (map as MaplibreMapInstance)
        .loadImage(url)
        .then((response) => response.data),
    // MapLibre GL cluster methods return promises directly.
    callWebCluster: (source, method, args) => {
      const [clusterId, limit, offset] = args as [number, number, number];
      const clusterSource = source as unknown as MaplibreClusterCaller;

      if (method === "getClusterLeaves") {
        return clusterSource.getClusterLeaves(clusterId, limit, offset);
      }

      if (method === "getClusterChildren") {
        return clusterSource.getClusterChildren(clusterId);
      }

      return clusterSource.getClusterExpansionZoom(clusterId);
    },
  });

/** Complete selected wrapper facilities, preserving SDK-specific refs and events. */
export {
  MaplibreAttributionControl as WrapperAttributionControl,
  MaplibreFullscreenControl as WrapperFullscreenControl,
  MaplibreGeolocateControl as WrapperGeolocateControl,
  MaplibreMarker as WrapperMarker,
  MaplibreNavigationControl as WrapperNavigationControl,
  MaplibrePopup as WrapperPopup,
  MaplibreScaleControl as WrapperScaleControl,
  useControl,
};

/** Selected advanced methods retain the pinned wrapper's signatures. */
export type WebMapRef = MapRef & {
  /** Bubbles plugin events through the public selected SDK parent facility. */
  readonly setEventedParent: MaplibreMapInstance["setEventedParent"];
  /** Public SDK event producer for plugins; dispatch is synchronous and follows SDK event semantics. */
  readonly fire: MaplibreMapInstance["fire"];
  /**
   * Selects an attached renderer's public gesture controls and independent state readback.
   * @param name - SDK gesture handler name.
   * @returns The renderer-owned public handler; use only while this map remains mounted.
   * @throws For an unknown handler name or a detached map.
   */
  readonly getGestureHandler: <Name extends keyof WebGestureHandlers>(
    name: Name
  ) => WebGestureHandlers[Name];
  /**
   * Reads whether obsolete loading tiles are cancelled while zooming in.
   * @returns The attached SDK's current cancellation setting.
   */
  readonly getCancelPendingTileRequestsWhileZooming: () => boolean;
  /**
   * Updates whether obsolete loading tiles are cancelled while zooming in.
   * @param value - True cancels previous zoom levels' pending requests.
   */
  readonly setCancelPendingTileRequestsWhileZooming: (value: boolean) => void;
  /**
   * Reads the attached renderer's pinned SDK version.
   * @returns SDK version string; throws when detached.
   */
  readonly getVersion: () => string;
  /** Reads the attached CanvasSource with its named media/model operations. */
  readonly getCanvasSource: (id: string) => import("maplibre-gl").CanvasSource;
  /** Reads the attached VideoSource with its named media/model operations. */
  readonly getVideoSource: (id: string) => import("maplibre-gl").VideoSource;

  /** Updates selected renderer diagnostics; settings follow SDK lifetime. */
  readonly setDebugOptions: (options: Partial<WebDebugOptions>) => void;
  /** Reads renderer diagnostics. */
  readonly getDebugOptions: () => WebDebugOptions;
} & Pick<MaplibreMapRef, (typeof forwardedMethodNames)[number]>;

/** Map props with DOM presentation forwarded to the map container. */
export interface WebMapProps extends Omit<MapProps, "mapStyle"> {
  /** Complete selected style document, including renderer extensions. */
  readonly mapStyle: string | import("maplibre-gl").StyleSpecification;
  /** Selected wrapper options and events; common supplied values take precedence. Constructor-only fields require a fresh map and are retained by reuseMaps. */
  readonly options?: Omit<
    SelectedWrapperMapProps,
    | "children"
    | "ref"
    | "mapStyle"
    | "initialViewState"
    | "viewState"
    | "style"
    | "interactiveLayerIds"
    | "padding"
    | Extract<keyof MapProps, `on${string}`>
  >;

  /** Outer map-host attributes and CSS; facade owns nested children. */
  readonly hostProps?: Omit<
    HTMLAttributes<HTMLDivElement>,
    "children" | "dangerouslySetInnerHTML"
  >;
}
/** Map with selected DOM host attributes. */
const SelectedWebMap = OneMap as ForwardRefExoticComponent<
  WebMapProps & RefAttributes<WebMapRef>
>;

/** Marker props with selected wrapper options and DOM content attributes. */
export interface WebMarkerProps extends MarkerProps {
  /** Remaining selected wrapper options; common fields take precedence. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibreMarker>,
    keyof MarkerProps | "ref"
  >;
  /** Attributes applied to the marker content host. */
  readonly hostProps?: HTMLAttributes<HTMLDivElement>;
}
/** Marker with selected web options. */
export const Marker = OneMarker as ForwardRefExoticComponent<
  WebMarkerProps & RefAttributes<MarkerRef>
>;

/** Popup props with selected wrapper options and DOM content attributes. */
export interface WebPopupProps extends PopupProps {
  /** Remaining selected wrapper options; common fields take precedence. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibrePopup>,
    keyof PopupProps | "ref"
  >;
  /** Attributes applied to the popup content host. */
  readonly hostProps?: HTMLAttributes<HTMLDivElement>;
}
/** Popup with selected web options. */
export const Popup = OnePopup as ComponentType<WebPopupProps>;

/** Custom control props with DOM content attributes. */
export interface WebControlProps extends ControlProps {
  /** Attributes applied to the custom control content host. */
  readonly hostProps?: HTMLAttributes<HTMLDivElement>;
}
/** Custom control with DOM content attributes. */
export const Control = OneControl as ComponentType<WebControlProps>;

/** Navigation control props with selected wrapper options. */
export interface WebNavigationControlProps extends NavigationControlProps {
  /** Remaining selected constructor options and CSS presentation. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibreNavigationControl>,
    keyof NavigationControlProps
  >;
}
/** Navigation control with selected web options. */
export const NavigationControl =
  OneNavigationControl as ComponentType<WebNavigationControlProps>;

/** Attribution control props with selected wrapper options. */
export interface WebAttributionControlProps extends AttributionControlProps {
  /** Remaining selected constructor options and CSS presentation. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibreAttributionControl>,
    keyof AttributionControlProps
  >;
}
/** Attribution control with selected web options. */
export const AttributionControl =
  OneAttributionControl as ComponentType<WebAttributionControlProps>;

/** Scale control props with selected wrapper options. */
export interface WebScaleControlProps extends ScaleControlProps {
  /** Remaining selected constructor options and CSS presentation. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibreScaleControl>,
    keyof ScaleControlProps
  >;
}
/** Scale control with selected web options. */
export const ScaleControl =
  OneScaleControl as ComponentType<WebScaleControlProps>;

/** Geolocation control props with selected browser facilities. */
export interface WebGeolocateControlProps extends GeolocateControlProps {
  /** Remaining selected browser options and events. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibreGeolocateControl>,
    keyof GeolocateControlProps | "ref"
  >;
}
/** Geolocation control with selected web options. */
export const GeolocateControl =
  OneGeolocateControl as ComponentType<WebGeolocateControlProps>;

/** Fullscreen control props with selected browser target. */
export interface WebFullscreenControlProps extends FullscreenControlProps {
  /** Remaining selected constructor options and CSS presentation. */
  readonly options?: Omit<
    ComponentProps<typeof MaplibreFullscreenControl>,
    keyof FullscreenControlProps
  >;
}
/** Fullscreen control with selected web options. */
export const FullscreenControl =
  OneFullscreenControl as ComponentType<WebFullscreenControlProps>;

export {
  GlobeControl as WrapperGlobeControl,
  LogoControl as WrapperLogoControl,
  TerrainControl as WrapperTerrainControl,
} from "react-map-gl/maplibre";

/** Direct wrapper map and map access for selected canvas/container facilities. */
export {
  MaplibreMap as WrapperMap,
  SelectedWebMap as Map,
  useMap as useWrapperMap,
};

/** Complete selected layer families, including custom callbacks, ordering and renderer expressions. */
export const Layer = (props: ComponentProps<typeof MaplibreLayer>) => {
  useStableOptions(
    `Selected layer "${props.id}"`,
    props.type === "custom"
      ? { ...props }
      : {
          id: props.id,
          type: props.type,
          source: "source" in props ? props.source : undefined,
          sourceLayer:
            "source-layer" in props ? props["source-layer"] : undefined,
        }
  );
  return <MaplibreLayer {...props} />;
};

/** Selected source types with media lifetime owned by the application. */
export type WebSourceProps =
  | ComponentProps<typeof MaplibreSource>
  | (import("maplibre-gl").CanvasSourceSpecification & {
      readonly id?: string;
      readonly children?: import("react").ReactNode;
    });

/** Source delegated to the wrapper; replace media identity/URLs with a new key. */
export const Source = (props: WebSourceProps) => {
  const creation: Record<string, unknown> = { id: props.id, type: props.type };
  if (props.type === "canvas") {
    creation.canvas = props.canvas;
    creation.animate = props.animate;
  }
  if (props.type === "video") creation.urls = props.urls;
  useStableOptions(`Selected source "${props.id}"`, creation);
  return (
    <MaplibreSource {...(props as ComponentProps<typeof MaplibreSource>)} />
  );
};

/** Selected SDK types for style documents and advanced callback implementations. */
export type {
  StyleSpecification,
  SourceSpecification,
  LayerSpecification,
  CustomLayerInterface,
  CanvasSourceSpecification,
  VideoSourceSpecification,
  MapOptions,
} from "maplibre-gl";

/** Explicit SDK worker/protocol configuration; importing starts no work. */
export {
  LngLat,
  LngLatBounds,
  MercatorCoordinate,
  setWorkerCount,
  getWorkerCount,
  setWorkerUrl,
  getWorkerUrl,
  setMaxParallelImageRequests,
  getMaxParallelImageRequests,
  setRTLTextPlugin,
  getRTLTextPluginStatus,
  addProtocol,
  removeProtocol,
  prewarm,
  clearPrewarmedResources,
} from "maplibre-gl";

/** Renderer diagnostic properties, with SDK defaults and units. */
export type WebDebugOptions = Pick<
  ReturnType<MaplibreMapRef["getMap"]>,
  | "showCollisionBoxes"
  | "showTileBoundaries"
  | "showOverdrawInspector"
  | "showPadding"
  | "vertices"
  | "repaint"
>;

/** Public gesture controls/readbacks; renderer input dispatch and frame hooks stay private. */
export type WebGestureHandlers = {
  readonly [
    Name in
      | "boxZoom"
      | "doubleClickZoom"
      | "dragPan"
      | "dragRotate"
      | "keyboard"
      | "scrollZoom"
      | "touchPitch"
      | "touchZoomRotate"
  ]: Pick<
    MaplibreMapInstance[Name],
    Extract<
      keyof MaplibreMapInstance[Name],
      | "enable"
      | "disable"
      | "isEnabled"
      | "isActive"
      | "isZooming"
      | "enableRotation"
      | "disableRotation"
      | "setZoomRate"
      | "setWheelZoomRate"
    >
  >;
};
