import MapboxRenderer from "mapbox-gl";
import { useId, useLayoutEffect } from "react";
import type {
  ComponentProps,
  ComponentType,
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from "react";
import {
  AttributionControl as MapboxAttributionControl,
  FullscreenControl as MapboxFullscreenControl,
  GeolocateControl as MapboxGeolocateControl,
  Layer as MapboxLayer,
  Map as MapboxMap,
  type MapRef as MapboxMapRef,
  type MapProps as SelectedWrapperMapProps,
  Marker as MapboxMarker,
  NavigationControl as MapboxNavigationControl,
  Popup as MapboxPopup,
  ScaleControl as MapboxScaleControl,
  Source as MapboxSource,
  useControl,
  useMap,
} from "react-map-gl/mapbox";

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

/** Reports browser/GPU support using the pinned Mapbox renderer probe. */
export const {
  supported,
}: Pick<(typeof import("mapbox-gl"))["default"], "supported"> =
  MapboxRenderer as unknown as (typeof import("mapbox-gl"))["default"];

type WebControlHook = WebWrapper<"mapbox-web">["useControl"];

type MapboxMapInstance = ReturnType<MapboxMapRef["getMap"]>;

// Mapbox GL JS cluster sources report results through a trailing callback.
interface MapboxClusterCaller {
  readonly getClusterExpansionZoom: (
    clusterId: number,
    callback: (error: unknown, zoom: number) => void
  ) => unknown;
  readonly getClusterChildren: (
    clusterId: number,
    callback: (error: unknown, features: readonly object[]) => void
  ) => unknown;
  readonly getClusterLeaves: (
    clusterId: number,
    limit: number,
    offset: number,
    callback: (error: unknown, features: readonly object[]) => void
  ) => unknown;
}

// The react-map-gl components accept the full style-spec surface; the facade
// converts props before they reach this boundary.
/** Selects mapbox-web and supplies react-map-gl Mapbox components. */
export const adapter: Adapter & { readonly backend: "mapbox-web" } =
  createWebAdapter({
    backend: "mapbox-web",
    createAdvancedMethods: (getHandle) => {
      const selectedHandle = () => getHandle() as unknown as MapboxMapRef;
      return {
        ...createWebMethodForwarders(selectedHandle, [
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
        ]),
        fire: ((...args: Parameters<MapboxMapInstance["fire"]>) =>
          selectedHandle()
            .getMap()
            .fire(...args)) as MapboxMapInstance["fire"],
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
        getVersion: (): string => selectedHandle().getMap().version,
        queryRasterValue: (
          ...args: Parameters<MapboxMapRef["queryRasterValue"]>
        ) => selectedHandle().queryRasterValue(...args),
        getHorizontalFieldOfView: (
          ...args: Parameters<MapboxMapRef["getHorizontalFieldOfView"]>
        ) => selectedHandle().getHorizontalFieldOfView(...args),
        getFeaturesetDescriptors: (
          ...args: Parameters<MapboxMapRef["getFeaturesetDescriptors"]>
        ) => selectedHandle().getFeaturesetDescriptors(...args),
        getIndoorTileOptions: (
          ...args: Parameters<MapboxMapRef["getIndoorTileOptions"]>
        ) => selectedHandle().getIndoorTileOptions(...args),
        getLanguage: (...args: Parameters<MapboxMapRef["getLanguage"]>) =>
          selectedHandle().getLanguage(...args),
        setLanguage: (...args: Parameters<MapboxMapRef["setLanguage"]>) =>
          selectedHandle().setLanguage(...args),
        getWorldview: (...args: Parameters<MapboxMapRef["getWorldview"]>) =>
          selectedHandle().getWorldview(...args),
        setWorldview: (...args: Parameters<MapboxMapRef["setWorldview"]>) =>
          selectedHandle().setWorldview(...args),
        getScaleFactor: (...args: Parameters<MapboxMapRef["getScaleFactor"]>) =>
          selectedHandle().getScaleFactor(...args),
        setScaleFactor: (...args: Parameters<MapboxMapRef["setScaleFactor"]>) =>
          selectedHandle().setScaleFactor(...args),
        getCanvasSource: (id: string): import("mapbox-gl").CanvasSource => {
          const source = selectedHandle().getSource(id);
          if (!source || source.type !== "canvas")
            throw new Error(`Source "${id}" is not an attached CanvasSource.`);
          return source as import("mapbox-gl").CanvasSource;
        },
        getVideoSource: (id: string): import("mapbox-gl").VideoSource => {
          const source = selectedHandle().getSource(id);
          if (!source || source.type !== "video")
            throw new Error(`Source "${id}" is not an attached VideoSource.`);
          return source as import("mapbox-gl").VideoSource;
        },
        getModelSource: (id: string): import("mapbox-gl").ModelSource => {
          const source = selectedHandle().getSource(id);
          if (!source || source.type !== "model")
            throw new Error(`Source "${id}" is not an attached ModelSource.`);
          return source as import("mapbox-gl").ModelSource;
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
            showTerrainWireframe: map.showTerrainWireframe,
            showLayers2DWireframe: map.showLayers2DWireframe,
            showLayers3DWireframe: map.showLayers3DWireframe,
            showElevationIdDebug: map.showElevationIdDebug,
            showPadding: map.showPadding,
            vertices: map.vertices,
            repaint: map.repaint,
            showParseStatus: map.showParseStatus,
            showTileAABBs: map.showTileAABBs,
          };
        },
        getGlyphsUrl: (...args: Parameters<MapboxMapRef["getGlyphsUrl"]>) =>
          selectedHandle().getGlyphsUrl(...args),
        getNearClipOffset: (
          ...args: Parameters<MapboxMapRef["getNearClipOffset"]>
        ) => selectedHandle().getNearClipOffset(...args),
        getSchema: (...args: Parameters<MapboxMapRef["getSchema"]>) =>
          selectedHandle().getSchema(...args),
        getSlot: (...args: Parameters<MapboxMapRef["getSlot"]>) =>
          selectedHandle().getSlot(...args),
        getSlots: (...args: Parameters<MapboxMapRef["getSlots"]>) =>
          selectedHandle().getSlots(...args),
        listModels: (...args: Parameters<MapboxMapRef["listModels"]>) =>
          selectedHandle().listModels(...args),
        setGlyphsUrl: (...args: Parameters<MapboxMapRef["setGlyphsUrl"]>) =>
          selectedHandle().setGlyphsUrl(...args),
        setNearClipOffset: (
          ...args: Parameters<MapboxMapRef["setNearClipOffset"]>
        ) => selectedHandle().setNearClipOffset(...args),
        setSchema: (...args: Parameters<MapboxMapRef["setSchema"]>) =>
          selectedHandle().setSchema(...args),
        setSlot: (...args: Parameters<MapboxMapRef["setSlot"]>) =>
          selectedHandle().setSlot(...args),
        setRain: (...args: Parameters<MapboxMapRef["setRain"]>) =>
          selectedHandle().setRain(...args),
        getRain: (...args: Parameters<MapboxMapRef["getRain"]>) =>
          selectedHandle().getRain(...args),
        setSnow: (...args: Parameters<MapboxMapRef["setSnow"]>) =>
          selectedHandle().setSnow(...args),
        getSnow: (...args: Parameters<MapboxMapRef["getSnow"]>) =>
          selectedHandle().getSnow(...args),
        setLights: (...args: Parameters<MapboxMapRef["setLights"]>) =>
          selectedHandle().setLights(...args),
        getLights: (...args: Parameters<MapboxMapRef["getLights"]>) =>
          selectedHandle().getLights(...args),
        getFog: (...args: Parameters<MapboxMapRef["getFog"]>) =>
          selectedHandle().getFog(...args),
        addImport: (...args: Parameters<MapboxMapRef["addImport"]>) =>
          selectedHandle().addImport(...args),
        updateImport: (...args: Parameters<MapboxMapRef["updateImport"]>) =>
          selectedHandle().updateImport(...args),
        removeImport: (...args: Parameters<MapboxMapRef["removeImport"]>) =>
          selectedHandle().removeImport(...args),
        moveImport: (...args: Parameters<MapboxMapRef["moveImport"]>) =>
          selectedHandle().moveImport(...args),
        setImportColorTheme: (
          ...args: Parameters<MapboxMapRef["setImportColorTheme"]>
        ) => selectedHandle().setImportColorTheme(...args),
        setColorTheme: (...args: Parameters<MapboxMapRef["setColorTheme"]>) =>
          selectedHandle().setColorTheme(...args),
        setConfig: (...args: Parameters<MapboxMapRef["setConfig"]>) =>
          selectedHandle().setConfig(...args),
        getConfig: (...args: Parameters<MapboxMapRef["getConfig"]>) =>
          selectedHandle().getConfig(...args),
        setConfigProperty: (
          ...args: Parameters<MapboxMapRef["setConfigProperty"]>
        ) => selectedHandle().setConfigProperty(...args),
        getConfigProperty: (
          ...args: Parameters<MapboxMapRef["getConfigProperty"]>
        ) => selectedHandle().getConfigProperty(...args),
        addInteraction: (...args: Parameters<MapboxMapRef["addInteraction"]>) =>
          selectedHandle().addInteraction(...args),
        removeInteraction: (
          ...args: Parameters<MapboxMapRef["removeInteraction"]>
        ) => selectedHandle().removeInteraction(...args),
        addModel: (...args: Parameters<MapboxMapRef["addModel"]>) =>
          selectedHandle().addModel(...args),
        removeModel: (...args: Parameters<MapboxMapRef["removeModel"]>) =>
          selectedHandle().removeModel(...args),
        hasModel: (...args: Parameters<MapboxMapRef["hasModel"]>) =>
          selectedHandle().hasModel(...args),
      };
    },
    Map: MapboxMap,
    Source: MapboxSource as ComponentType<WebForwardedProps>,
    Layer: MapboxLayer as ComponentType<WebForwardedProps>,
    Marker: MapboxMarker as unknown as ComponentType<WebForwardedProps>,
    Popup: MapboxPopup as unknown as ComponentType<WebForwardedProps>,
    NavigationControl:
      MapboxNavigationControl as ComponentType<WebForwardedProps>,
    AttributionControl:
      MapboxAttributionControl as ComponentType<WebForwardedProps>,
    ScaleControl: MapboxScaleControl as ComponentType<WebForwardedProps>,
    GeolocateControl:
      MapboxGeolocateControl as ComponentType<WebForwardedProps>,
    FullscreenControl:
      MapboxFullscreenControl as ComponentType<WebForwardedProps>,
    useControl: useControl as unknown as WebControlHook,
    useMap,
    // Mapbox GL JS reports image loads through a callback; the shared web
    // surface omits the loader so each entry normalizes its own.
    loadWebImage: (map, url) =>
      new Promise((resolve, reject) => {
        (map as MapboxMapInstance).loadImage(url, (error, image) => {
          if (error) {
            reject(new Error(`Image failed to load: ${url}`));
            return;
          }

          resolve(image);
        });
      }),
    // Mapbox GL JS cluster methods take a trailing callback; translate it
    // into the shared promise result.
    callWebCluster: (source, method, args) =>
      new Promise((resolve, reject) => {
        const [clusterId, limit, offset] = args as [number, number, number];
        const clusterSource = source as unknown as MapboxClusterCaller;
        const onResult = (error: unknown, result: unknown): void => {
          if (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }

          resolve(result);
        };

        if (method === "getClusterLeaves") {
          clusterSource.getClusterLeaves(clusterId, limit, offset, onResult);
          return;
        }

        if (method === "getClusterChildren") {
          clusterSource.getClusterChildren(clusterId, onResult);
          return;
        }

        clusterSource.getClusterExpansionZoom(clusterId, onResult);
      }),
  });

/** Complete selected wrapper facilities, preserving SDK-specific refs and events. */
export {
  MapboxAttributionControl as WrapperAttributionControl,
  MapboxFullscreenControl as WrapperFullscreenControl,
  MapboxGeolocateControl as WrapperGeolocateControl,
  MapboxMarker as WrapperMarker,
  MapboxNavigationControl as WrapperNavigationControl,
  MapboxPopup as WrapperPopup,
  MapboxScaleControl as WrapperScaleControl,
  useControl,
};

/** Selected advanced methods retain the pinned wrapper's signatures. */
export type WebMapRef = MapRef & {
  /** Public SDK event producer for plugins; dispatch is synchronous and follows SDK event semantics. */
  readonly fire: MapboxMapInstance["fire"];
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
   * Reads the attached renderer's pinned SDK version.
   * @returns SDK version string; throws when detached.
   */
  readonly getVersion: () => string;
  /** Reads the attached CanvasSource with its named media/model operations. */
  readonly getCanvasSource: (id: string) => import("mapbox-gl").CanvasSource;
  /** Reads the attached VideoSource with its named media/model operations. */
  readonly getVideoSource: (id: string) => import("mapbox-gl").VideoSource;
  /** Reads the attached ModelSource with its named media/model operations. */
  readonly getModelSource: (id: string) => import("mapbox-gl").ModelSource;

  /** Updates selected renderer diagnostics; settings follow SDK lifetime. */
  readonly setDebugOptions: (options: Partial<WebDebugOptions>) => void;
  /** Reads renderer diagnostics. */
  readonly getDebugOptions: () => WebDebugOptions;
} & Pick<
    MapboxMapRef,
    | "on"
    | "off"
    | "once"
    | "addControl"
    | "removeControl"
    | "hasControl"
    | "getSource"
    | "getLayer"
    | "getCanvas"
    | "getCanvasContainer"
    | "getContainer"
    | "getStyle"
    | "loaded"
    | "isStyleLoaded"
    | "areTilesLoaded"
    | "triggerRepaint"
    | "queryRasterValue"
    | "getVerticalFieldOfView"
    | "setVerticalFieldOfView"
    | "getHorizontalFieldOfView"
    | "setRain"
    | "getRain"
    | "setSnow"
    | "getSnow"
    | "setLights"
    | "getLights"
    | "getFog"
    | "getTerrain"
    | "getProjection"
    | "getLight"
    | "addImport"
    | "updateImport"
    | "removeImport"
    | "moveImport"
    | "setImportColorTheme"
    | "setColorTheme"
    | "setConfig"
    | "getConfig"
    | "setConfigProperty"
    | "getConfigProperty"
    | "addInteraction"
    | "removeInteraction"
    | "addModel"
    | "removeModel"
    | "hasModel"
    | "getGlyphsUrl"
    | "getNearClipOffset"
    | "getSchema"
    | "getSlot"
    | "getSlots"
    | "listModels"
    | "setGlyphsUrl"
    | "setNearClipOffset"
    | "setSchema"
    | "setSlot"
    | "getFeaturesetDescriptors"
    | "getIndoorTileOptions"
    | "getLanguage"
    | "setLanguage"
    | "getWorldview"
    | "setWorldview"
    | "getScaleFactor"
    | "setScaleFactor"
  >;

/** Map props with DOM presentation forwarded to the map container. */
export interface WebMapProps extends Omit<MapProps, "mapStyle"> {
  /** Complete selected style document, including renderer extensions. */
  readonly mapStyle: string | import("mapbox-gl").StyleSpecification;
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
    ComponentProps<typeof MapboxMarker>,
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
    ComponentProps<typeof MapboxPopup>,
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
    ComponentProps<typeof MapboxNavigationControl>,
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
    ComponentProps<typeof MapboxAttributionControl>,
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
    ComponentProps<typeof MapboxScaleControl>,
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
    ComponentProps<typeof MapboxGeolocateControl>,
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
    ComponentProps<typeof MapboxFullscreenControl>,
    keyof FullscreenControlProps
  >;
}
/** Fullscreen control with selected web options. */
export const FullscreenControl =
  OneFullscreenControl as ComponentType<WebFullscreenControlProps>;

/** Direct wrapper map and map access for selected canvas/container facilities. */
export {
  MapboxMap as WrapperMap,
  SelectedWebMap as Map,
  useMap as useWrapperMap,
};

/** Complete selected layer families, including custom callbacks, ordering and renderer expressions. */
export const Layer = (props: ComponentProps<typeof MapboxLayer>) => {
  const generatedId = useId();
  const id = props.id ?? `one-map-layer-${generatedId}`;
  const map = useMap().current;
  const slot = "slot" in props ? props.slot : undefined;
  useLayoutEffect(() => {
    if (props.type !== "custom" && map?.getLayer(id)) {
      // react-map-gl 8.1.3 updates paint/layout/order but omits mutable slots.
      map.setSlot(id, slot);
    }
  }, [map, id, props.type, slot]);

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
  return <MapboxLayer {...props} id={id} />;
};

/** Selected source types with media lifetime owned by the application. */
export type WebSourceProps = ComponentProps<typeof MapboxSource>;

/** Source delegated to the wrapper; replace media identity/URLs with a new key. */
export const Source = (props: WebSourceProps) => {
  const creation: Record<string, unknown> = { id: props.id, type: props.type };
  if (props.type === "canvas") {
    creation.canvas = props.canvas;
    creation.animate = props.animate;
  }
  if (props.type === "video") creation.urls = props.urls;
  useStableOptions(`Selected source "${props.id}"`, creation);
  return <MapboxSource {...(props as ComponentProps<typeof MapboxSource>)} />;
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
} from "mapbox-gl";

/** Explicit SDK warmup and text plugin configuration. */
export const {
  prewarm,
  clearPrewarmedResources,
  setRTLTextPlugin,
  getRTLTextPluginStatus,
  IndoorControl,
  LngLat,
  LngLatBounds,
  MercatorCoordinate,
  Point,
} = MapboxRenderer as unknown as (typeof import("mapbox-gl"))["default"];

/** Renderer diagnostic properties, with SDK defaults and units. */
export type WebDebugOptions = Pick<
  ReturnType<MapboxMapRef["getMap"]>,
  | "showCollisionBoxes"
  | "showTileBoundaries"
  | "showOverdrawInspector"
  | "showTerrainWireframe"
  | "showLayers2DWireframe"
  | "showLayers3DWireframe"
  | "showElevationIdDebug"
  | "showPadding"
  | "vertices"
  | "repaint"
  | "showParseStatus"
  | "showTileAABBs"
>;

/** Explicit global SDK settings; assign before constructing maps/workers. */
export const rendererSettings: Pick<
  (typeof import("mapbox-gl"))["default"],
  | "workerCount"
  | "workerUrl"
  | "workerClass"
  | "maxParallelImageRequests"
  | "accessToken"
  | "baseApiUrl"
> = MapboxRenderer as unknown as (typeof import("mapbox-gl"))["default"];

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
    MapboxMapInstance[Name],
    Extract<
      keyof MapboxMapInstance[Name],
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

/** Geographic coordinate instance supplied by the selected SDK constructor. */
export type LngLat = InstanceType<typeof LngLat>;
/** Geographic bounds instance supplied by the selected SDK constructor. */
export type LngLatBounds = InstanceType<typeof LngLatBounds>;
/** Mercator coordinate instance supplied by the selected SDK constructor. */
export type MercatorCoordinate = InstanceType<typeof MercatorCoordinate>;
/** Screen point instance supplied by the selected SDK constructor. */
export type Point = InstanceType<typeof Point>;
/** Indoor control instance supplied by the selected SDK constructor. */
export type IndoorControl = InstanceType<typeof IndoorControl>;
