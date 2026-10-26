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
  ControlProps,
  GeolocateControlProps,
  MarkerProps,
  MarkerRef,
} from "./contracts/ui-types.js";
import { Map as OneMap } from "./facade/map.js";
import {
  Control as OneControl,
  GeolocateControl as OneGeolocateControl,
  Marker as OneMarker,
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
    Map: MapboxMap,
    Source: MapboxSource as ComponentType<WebForwardedProps>,
    Layer: MapboxLayer as Adapter["Layer"],
    Marker: MapboxMarker as unknown as ComponentType<WebForwardedProps>,
    GeolocateControl:
      MapboxGeolocateControl as ComponentType<WebForwardedProps>,
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

/** Common map operations and access to the selected wrapper. */
export type WebMapRef = MapRef & {
  /**
   * Borrows the currently attached react-map-gl wrapper ref.
   *
   * @remarks Call again for each operation to look up the current handle
   * without waiting for load. Borrowed handles follow upstream lifetime and
   * ownership; facade detachment does not invalidate them.
   * @returns The attached wrapper ref, without waiting for renderer readiness.
   * @throws Rejects when the map is detached.
   */
  readonly getWrapperMap: () => Promise<MapboxMapRef>;
};

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

/** Custom control props with DOM content attributes. */
export interface WebControlProps extends ControlProps {
  /** Attributes applied to the custom control content host. */
  readonly hostProps?: HTMLAttributes<HTMLDivElement>;
}
/** Custom control with DOM content attributes. */
export const Control = OneControl as ComponentType<WebControlProps>;

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
