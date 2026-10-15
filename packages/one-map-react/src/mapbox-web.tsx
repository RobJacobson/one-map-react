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
    createAdvancedMethods: (getHandle) => ({
      getVersion: (): string =>
        (getHandle() as unknown as MapboxMapRef).getMap().version,
      queryRasterValue: (
        ...args: Parameters<MapboxMapRef["queryRasterValue"]>
      ) => (getHandle() as unknown as MapboxMapRef).queryRasterValue(...args),
      getVerticalFieldOfView: (
        ...args: Parameters<MapboxMapRef["getVerticalFieldOfView"]>
      ) =>
        (getHandle() as unknown as MapboxMapRef).getVerticalFieldOfView(
          ...args
        ),
      setVerticalFieldOfView: (
        ...args: Parameters<MapboxMapRef["setVerticalFieldOfView"]>
      ) =>
        (getHandle() as unknown as MapboxMapRef).setVerticalFieldOfView(
          ...args
        ),
      getHorizontalFieldOfView: (
        ...args: Parameters<MapboxMapRef["getHorizontalFieldOfView"]>
      ) =>
        (getHandle() as unknown as MapboxMapRef).getHorizontalFieldOfView(
          ...args
        ),
      getFeaturesetDescriptors: (
        ...args: Parameters<MapboxMapRef["getFeaturesetDescriptors"]>
      ) =>
        (getHandle() as unknown as MapboxMapRef).getFeaturesetDescriptors(
          ...args
        ),
      getIndoorTileOptions: (
        ...args: Parameters<MapboxMapRef["getIndoorTileOptions"]>
      ) =>
        (getHandle() as unknown as MapboxMapRef).getIndoorTileOptions(...args),
      getLanguage: (...args: Parameters<MapboxMapRef["getLanguage"]>) =>
        (getHandle() as unknown as MapboxMapRef).getLanguage(...args),
      setLanguage: (...args: Parameters<MapboxMapRef["setLanguage"]>) =>
        (getHandle() as unknown as MapboxMapRef).setLanguage(...args),
      getWorldview: (...args: Parameters<MapboxMapRef["getWorldview"]>) =>
        (getHandle() as unknown as MapboxMapRef).getWorldview(...args),
      setWorldview: (...args: Parameters<MapboxMapRef["setWorldview"]>) =>
        (getHandle() as unknown as MapboxMapRef).setWorldview(...args),
      getScaleFactor: (...args: Parameters<MapboxMapRef["getScaleFactor"]>) =>
        (getHandle() as unknown as MapboxMapRef).getScaleFactor(...args),
      setScaleFactor: (...args: Parameters<MapboxMapRef["setScaleFactor"]>) =>
        (getHandle() as unknown as MapboxMapRef).setScaleFactor(...args),
      getCanvasSource: (id: string): import("mapbox-gl").CanvasSource => {
        const source = (getHandle() as unknown as MapboxMapRef).getSource(id);
        if (!source || source.type !== "canvas")
          throw new Error(`Source "${id}" is not an attached CanvasSource.`);
        return source as import("mapbox-gl").CanvasSource;
      },
      getVideoSource: (id: string): import("mapbox-gl").VideoSource => {
        const source = (getHandle() as unknown as MapboxMapRef).getSource(id);
        if (!source || source.type !== "video")
          throw new Error(`Source "${id}" is not an attached VideoSource.`);
        return source as import("mapbox-gl").VideoSource;
      },
      getModelSource: (id: string): import("mapbox-gl").ModelSource => {
        const source = (getHandle() as unknown as MapboxMapRef).getSource(id);
        if (!source || source.type !== "model")
          throw new Error(`Source "${id}" is not an attached ModelSource.`);
        return source as import("mapbox-gl").ModelSource;
      },
      setDebugOptions: (options: Partial<WebDebugOptions>) => {
        const map = (getHandle() as unknown as MapboxMapRef).getMap();
        Object.assign(map, options);
      },
      getDebugOptions: (): WebDebugOptions => {
        const map = (getHandle() as unknown as MapboxMapRef).getMap();
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
        (getHandle() as unknown as MapboxMapRef).getGlyphsUrl(...args),
      getNearClipOffset: (
        ...args: Parameters<MapboxMapRef["getNearClipOffset"]>
      ) => (getHandle() as unknown as MapboxMapRef).getNearClipOffset(...args),
      getSchema: (...args: Parameters<MapboxMapRef["getSchema"]>) =>
        (getHandle() as unknown as MapboxMapRef).getSchema(...args),
      getSlot: (...args: Parameters<MapboxMapRef["getSlot"]>) =>
        (getHandle() as unknown as MapboxMapRef).getSlot(...args),
      getSlots: (...args: Parameters<MapboxMapRef["getSlots"]>) =>
        (getHandle() as unknown as MapboxMapRef).getSlots(...args),
      listModels: (...args: Parameters<MapboxMapRef["listModels"]>) =>
        (getHandle() as unknown as MapboxMapRef).listModels(...args),
      setGlyphsUrl: (...args: Parameters<MapboxMapRef["setGlyphsUrl"]>) =>
        (getHandle() as unknown as MapboxMapRef).setGlyphsUrl(...args),
      setNearClipOffset: (
        ...args: Parameters<MapboxMapRef["setNearClipOffset"]>
      ) => (getHandle() as unknown as MapboxMapRef).setNearClipOffset(...args),
      setSchema: (...args: Parameters<MapboxMapRef["setSchema"]>) =>
        (getHandle() as unknown as MapboxMapRef).setSchema(...args),
      setSlot: (...args: Parameters<MapboxMapRef["setSlot"]>) =>
        (getHandle() as unknown as MapboxMapRef).setSlot(...args),
      setRain: (...args: Parameters<MapboxMapRef["setRain"]>) =>
        (getHandle() as unknown as MapboxMapRef).setRain(...args),
      getRain: (...args: Parameters<MapboxMapRef["getRain"]>) =>
        (getHandle() as unknown as MapboxMapRef).getRain(...args),
      setSnow: (...args: Parameters<MapboxMapRef["setSnow"]>) =>
        (getHandle() as unknown as MapboxMapRef).setSnow(...args),
      getSnow: (...args: Parameters<MapboxMapRef["getSnow"]>) =>
        (getHandle() as unknown as MapboxMapRef).getSnow(...args),
      setLights: (...args: Parameters<MapboxMapRef["setLights"]>) =>
        (getHandle() as unknown as MapboxMapRef).setLights(...args),
      getLights: (...args: Parameters<MapboxMapRef["getLights"]>) =>
        (getHandle() as unknown as MapboxMapRef).getLights(...args),
      getFog: (...args: Parameters<MapboxMapRef["getFog"]>) =>
        (getHandle() as unknown as MapboxMapRef).getFog(...args),
      getTerrain: (...args: Parameters<MapboxMapRef["getTerrain"]>) =>
        (getHandle() as unknown as MapboxMapRef).getTerrain(...args),
      getProjection: (...args: Parameters<MapboxMapRef["getProjection"]>) =>
        (getHandle() as unknown as MapboxMapRef).getProjection(...args),
      getLight: (...args: Parameters<MapboxMapRef["getLight"]>) =>
        (getHandle() as unknown as MapboxMapRef).getLight(...args),
      addImport: (...args: Parameters<MapboxMapRef["addImport"]>) =>
        (getHandle() as unknown as MapboxMapRef).addImport(...args),
      updateImport: (...args: Parameters<MapboxMapRef["updateImport"]>) =>
        (getHandle() as unknown as MapboxMapRef).updateImport(...args),
      removeImport: (...args: Parameters<MapboxMapRef["removeImport"]>) =>
        (getHandle() as unknown as MapboxMapRef).removeImport(...args),
      moveImport: (...args: Parameters<MapboxMapRef["moveImport"]>) =>
        (getHandle() as unknown as MapboxMapRef).moveImport(...args),
      setImportColorTheme: (
        ...args: Parameters<MapboxMapRef["setImportColorTheme"]>
      ) =>
        (getHandle() as unknown as MapboxMapRef).setImportColorTheme(...args),
      setColorTheme: (...args: Parameters<MapboxMapRef["setColorTheme"]>) =>
        (getHandle() as unknown as MapboxMapRef).setColorTheme(...args),
      setConfig: (...args: Parameters<MapboxMapRef["setConfig"]>) =>
        (getHandle() as unknown as MapboxMapRef).setConfig(...args),
      getConfig: (...args: Parameters<MapboxMapRef["getConfig"]>) =>
        (getHandle() as unknown as MapboxMapRef).getConfig(...args),
      setConfigProperty: (
        ...args: Parameters<MapboxMapRef["setConfigProperty"]>
      ) => (getHandle() as unknown as MapboxMapRef).setConfigProperty(...args),
      getConfigProperty: (
        ...args: Parameters<MapboxMapRef["getConfigProperty"]>
      ) => (getHandle() as unknown as MapboxMapRef).getConfigProperty(...args),
      addInteraction: (...args: Parameters<MapboxMapRef["addInteraction"]>) =>
        (getHandle() as unknown as MapboxMapRef).addInteraction(...args),
      removeInteraction: (
        ...args: Parameters<MapboxMapRef["removeInteraction"]>
      ) => (getHandle() as unknown as MapboxMapRef).removeInteraction(...args),
      addModel: (...args: Parameters<MapboxMapRef["addModel"]>) =>
        (getHandle() as unknown as MapboxMapRef).addModel(...args),
      removeModel: (...args: Parameters<MapboxMapRef["removeModel"]>) =>
        (getHandle() as unknown as MapboxMapRef).removeModel(...args),
      hasModel: (...args: Parameters<MapboxMapRef["hasModel"]>) =>
        (getHandle() as unknown as MapboxMapRef).hasModel(...args),
    }),
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
