import {
  GeoJSONSource,
  ImageSource,
  RasterDEMSource,
  RasterSource,
  VectorSource,
} from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";

import type { SourceProps } from "../../contracts/source-types.js";
import {
  rejectNativeGeoJsonOptions,
  rejectRasterDemScheme,
} from "../native-source-gates.js";

/** Maplibre-native source that dispatches to the matching MapLibre source. */
export const MaplibreNativeSource = (props: SourceProps) => {
  switch (props.type) {
    case "geojson":
      rejectNativeGeoJsonOptions(props, "maplibre-native");

      return (
        <GeoJSONSource
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
    case "vector":
      return (
        <VectorSource
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

const mutableTiles = (
  tiles: readonly string[] | undefined
): string[] | undefined => tiles?.map((template) => template);

const mutableCorner = (corner: readonly [number, number]): [number, number] => [
  corner[0],
  corner[1],
];
