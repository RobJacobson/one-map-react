import type { ComponentType } from "react";
import {
  Layer as MapboxLayer,
  Map as MapboxMap,
  type MapRef as MapboxMapRef,
  Source as MapboxSource,
  useMap,
} from "react-map-gl/mapbox";

import {
  createWebAdapter,
  type WebForwardedProps,
} from "./adapters/web/create-adapter.js";
import type { Adapter } from "./contracts/adapter.js";

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
