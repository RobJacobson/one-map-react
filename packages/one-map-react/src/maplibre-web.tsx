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

import {
  createWebAdapter,
  type WebForwardedProps,
} from "./adapters/web/create-adapter.js";
import type { Adapter } from "./contracts/adapter.js";
import type { MapRef } from "./contracts/camera-types.js";
import type { MapProps } from "./contracts/map-types.js";
import type { MarkerProps, MarkerRef } from "./contracts/ui-types.js";
import { Map as OneMap } from "./facade/map.js";
import { Marker as OneMarker } from "./facade/ui.js";
import { useStableOptions } from "./facade/use-stable-options.js";

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
    Layer: MaplibreLayer as Adapter["Layer"],
    Marker: MaplibreMarker as unknown as ComponentType<WebForwardedProps>,
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
  readonly getWrapperMap: () => Promise<MaplibreMapRef>;
};

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
