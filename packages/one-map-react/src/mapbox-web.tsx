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

/** Map props with DOM presentation forwarded to the map container. */
export interface WebMapProps extends MapProps {
  /** Outer map-host attributes and CSS; facade owns nested children. */
  readonly hostProps?: Omit<
    HTMLAttributes<HTMLDivElement>,
    "children" | "dangerouslySetInnerHTML"
  >;
}
/** Map with selected DOM host attributes. */
const SelectedWebMap = OneMap as ForwardRefExoticComponent<
  WebMapProps & RefAttributes<MapRef>
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
