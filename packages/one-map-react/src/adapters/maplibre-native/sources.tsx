import {
  GeoJSONSource,
  ImageSource,
  RasterDEMSource,
  RasterSource,
  VectorSource,
} from "@maplibre/maplibre-react-native";
import type { ComponentProps, ComponentRef } from "react";
import { useLayoutEffect, useRef } from "react";

import type {
  GeoJsonSourceProps,
  SourceProps,
  VectorSourceProps,
} from "../../contracts/source-types.js";
import {
  rejectNativeGeoJsonOptions,
  rejectRasterDemScheme,
} from "../native-source-gates.js";
import { useMaplibreSourceRegistry } from "./source-registry.js";

/** Maplibre-native source that dispatches to the matching MapLibre source. */
export const MaplibreNativeSource = (props: SourceProps) => {
  switch (props.type) {
    case "geojson":
      return <MaplibreNativeGeoJsonSource {...props} />;
    case "vector":
      return <MaplibreNativeVectorSource {...props} />;
    case "raster":
      return (
        <RasterSource
          id={props.id}
          url={props.url}
          tiles={mutableTiles(props.tiles)}
          minzoom={props.minzoom}
          maxzoom={props.maxzoom}
          tileSize={props.tileSize}
          scheme={props.scheme}
          attribution={props.attribution}
        >
          {props.children}
        </RasterSource>
      );
    case "raster-dem":
      rejectRasterDemScheme(props.scheme, "maplibre-native");

      return (
        <RasterDEMSource
          id={props.id}
          url={props.url}
          tiles={mutableTiles(props.tiles)}
          minzoom={props.minzoom}
          maxzoom={props.maxzoom}
          tileSize={props.tileSize}
          encoding={props.encoding}
          attribution={props.attribution}
        >
          {props.children}
        </RasterDEMSource>
      );
    case "image":
      return (
        <ImageSource
          id={props.id}
          url={props.url}
          coordinates={[
            mutableCorner(props.coordinates[0]),
            mutableCorner(props.coordinates[1]),
            mutableCorner(props.coordinates[2]),
            mutableCorner(props.coordinates[3]),
          ]}
        >
          {props.children}
        </ImageSource>
      );
  }
};

/**
 * GeoJSON source that registers its ref for cluster and state queries.
 *
 * The registry only exists inside a maplibre-native Map; a source rendered
 * elsewhere still renders but does not register.
 *
 * @param props - Common GeoJSON source props.
 * @returns The MapLibre `GeoJSONSource` with nested layers.
 */
const MaplibreNativeGeoJsonSource = (props: GeoJsonSourceProps) => {
  const registry = useMaplibreSourceRegistry();
  const sourceRef = useRef<ComponentRef<typeof GeoJSONSource>>(null);

  useLayoutEffect(() => {
    if (!registry) {
      return;
    }

    // The pinned wrapper refreshes its imperative handle on each render.
    // Read it when dispatching instead of retaining an earlier native handle.
    return registry.register(props.id, () =>
      sourceRef.current
        ? { kind: "geojson", ref: sourceRef.current }
        : undefined
    );
  }, [registry, props.id]);

  rejectNativeGeoJsonOptions(props, "maplibre-native");

  return (
    <GeoJSONSource
      ref={sourceRef}
      id={props.id}
      // The facade's readonly GeoJSON contracts cross into the wrapper's
      // mutable @types/geojson shapes here; values are not modified.
      data={props.data as ComponentProps<typeof GeoJSONSource>["data"]}
      cluster={props.cluster}
      clusterRadius={props.clusterRadius}
      clusterMinPoints={props.clusterMinPoints}
      clusterMaxZoom={props.clusterMaxZoom}
      clusterProperties={props.clusterProperties}
      maxzoom={props.maxzoom}
      buffer={props.buffer}
      tolerance={props.tolerance}
      lineMetrics={props.lineMetrics}
    >
      {props.children}
    </GeoJSONSource>
  );
};

/**
 * Vector source that registers its ref for source and state queries.
 *
 * @param props - Common vector source props.
 * @returns The MapLibre `VectorSource` with nested layers.
 */
const MaplibreNativeVectorSource = (props: VectorSourceProps) => {
  const registry = useMaplibreSourceRegistry();
  const sourceRef = useRef<ComponentRef<typeof VectorSource>>(null);

  useLayoutEffect(() => {
    if (!registry) {
      return;
    }

    return registry.register(props.id, () =>
      sourceRef.current ? { kind: "vector", ref: sourceRef.current } : undefined
    );
  }, [registry, props.id]);

  return (
    <VectorSource
      ref={sourceRef}
      id={props.id}
      url={props.url}
      tiles={mutableTiles(props.tiles)}
      minzoom={props.minzoom}
      maxzoom={props.maxzoom}
      scheme={props.scheme}
      attribution={props.attribution}
    >
      {props.children}
    </VectorSource>
  );
};

const mutableTiles = (
  tiles: readonly string[] | undefined
): string[] | undefined => tiles?.map((template) => template);

const mutableCorner = (corner: readonly [number, number]): [number, number] => [
  corner[0],
  corner[1],
];
