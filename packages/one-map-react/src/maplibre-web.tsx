import type { ComponentType } from "react";
import {
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  type MapRef as MaplibreMapRef,
  Source as MaplibreSource,
  useMap,
} from "react-map-gl/maplibre";

import {
  createWebAdapter,
  type WebForwardedProps,
} from "./adapters/web/create-adapter.js";
import type { Adapter } from "./contracts/adapter.js";

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
