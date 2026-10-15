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

// The react-map-gl components accept the full style-spec surface; the facade
// converts props before they reach this boundary.
/** Selects maplibre-web and supplies react-map-gl MapLibre components. */
export const adapter: Adapter & { readonly backend: "maplibre-web" } =
  createWebAdapter({
    backend: "maplibre-web",
    Map: MaplibreMap,
    Source: MaplibreSource as ComponentType<WebForwardedProps>,
    Layer: MaplibreLayer as ComponentType<WebForwardedProps>,
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
