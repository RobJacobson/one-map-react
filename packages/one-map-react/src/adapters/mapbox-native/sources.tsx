import {
  ImageSource,
  RasterDemSource,
  RasterSource,
  ShapeSource,
  VectorSource,
} from "@rnmapbox/maps";
import type { ComponentProps } from "react";

import type {
  GeoJsonSourceProps,
  ImageSourceProps,
  RasterDemSourceProps,
  RasterSourceProps,
  SourceProps,
  VectorSourceProps,
} from "../../contracts/source-types.js";
import {
  rejectNativeGeoJsonOptions,
  rejectProvided,
  rejectRasterDemScheme,
} from "../native-source-gates.js";

/** Mapbox-native source that dispatches to the matching RNMapbox source. */
export const MapboxNativeSource = (props: SourceProps) => {
  switch (props.type) {
    case "geojson":
      return (
        <ShapeSource {...toRnmapboxShapeSource(props)}>
          {props.children}
        </ShapeSource>
      );
    case "vector":
      return (
        <VectorSource {...toRnmapboxVectorSource(props)}>
          {props.children}
        </VectorSource>
      );
    case "raster":
      return (
        <RasterSource {...toRnmapboxRasterSource(props)}>
          {props.children}
        </RasterSource>
      );
    case "raster-dem":
      return (
        <RasterDemSource {...toRnmapboxRasterDemSource(props)}>
          {props.children}
        </RasterDemSource>
      );
    case "image":
      return (
        <ImageSource {...toRnmapboxImageSource(props)}>
          {props.children}
        </ImageSource>
      );
  }
};

/**
 * Converts common GeoJSON source props into RNMapbox `ShapeSource` props.
 *
 * @param props - Common GeoJSON source props.
 * @returns ShapeSource field names for the wrapper component.
 * @throws When an option is unavailable on the pinned RNMapbox wrapper.
 */
const toRnmapboxShapeSource = (
  props: GeoJsonSourceProps
): ComponentProps<typeof ShapeSource> => {
  rejectNativeGeoJsonOptions(props, "mapbox-native");
  rejectProvided(
    props.clusterMinPoints,
    "clusterMinPoints",
    "mapbox-native",
    "The pinned RNMapbox ShapeSource has no clusterMinPoints prop."
  );

  return {
    id: props.id,
    ...(typeof props.data === "string"
      ? { url: props.data }
      : {
          // The facade's readonly GeoJSON contracts cross into the wrapper's
          // mutable @types/geojson shapes here; values are not modified.
          shape: props.data as ComponentProps<typeof ShapeSource>["shape"],
        }),
    cluster: props.cluster,
    clusterRadius: props.clusterRadius,
    clusterMaxZoomLevel: props.clusterMaxZoom,
    clusterProperties: props.clusterProperties,
    maxZoomLevel: props.maxzoom,
    buffer: props.buffer,
    tolerance: props.tolerance,
    lineMetrics: props.lineMetrics,
  };
};

/**
 * Converts common vector source props into RNMapbox `VectorSource` props.
 *
 * @param props - Common vector source props.
 * @returns VectorSource field names for the wrapper component.
 */
const toRnmapboxVectorSource = (
  props: VectorSourceProps
): ComponentProps<typeof VectorSource> => ({
  id: props.id,
  url: props.url,
  tileUrlTemplates: props.tiles?.map((template) => template),
  minZoomLevel: props.minzoom,
  maxZoomLevel: props.maxzoom,
  tms: props.scheme === undefined ? undefined : props.scheme === "tms",
  attribution: props.attribution,
});

/**
 * Converts common raster source props into RNMapbox `RasterSource` props.
 *
 * @param props - Common raster source props.
 * @returns RasterSource field names for the wrapper component.
 */
const toRnmapboxRasterSource = (
  props: RasterSourceProps
): ComponentProps<typeof RasterSource> => ({
  id: props.id,
  url: props.url,
  tileUrlTemplates: props.tiles?.map((template) => template),
  minZoomLevel: props.minzoom,
  maxZoomLevel: props.maxzoom,
  tms: props.scheme === undefined ? undefined : props.scheme === "tms",
  tileSize: props.tileSize,
  attribution: props.attribution,
});

/**
 * Converts common raster-dem source props into RNMapbox `RasterDemSource`
 * props.
 *
 * @param props - Common raster-dem source props.
 * @returns RasterDemSource field names for the wrapper component.
 * @throws When an option is unavailable on the pinned RNMapbox wrapper.
 */
const toRnmapboxRasterDemSource = (
  props: RasterDemSourceProps
): ComponentProps<typeof RasterDemSource> => {
  rejectProvided(
    props.encoding,
    "encoding",
    "mapbox-native",
    "The pinned RNMapbox RasterDemSource declares no encoding prop."
  );
  rejectProvided(
    props.attribution,
    "attribution",
    "mapbox-native",
    "The pinned RNMapbox RasterDemSource declares no attribution prop."
  );
  rejectRasterDemScheme(props.scheme, "mapbox-native");

  return {
    id: props.id,
    url: props.url,
    tileUrlTemplates: props.tiles?.map((template) => template),
    minZoomLevel: props.minzoom,
    maxZoomLevel: props.maxzoom,
  };
};

/**
 * Converts common image source props into RNMapbox `ImageSource` props.
 *
 * The readonly corner pairs are copied into the mutable tuple the wrapper
 * declares.
 *
 * @param props - Common image source props.
 * @returns ImageSource field names for the wrapper component.
 */
const toRnmapboxImageSource = (
  props: ImageSourceProps
): ComponentProps<typeof ImageSource> => ({
  id: props.id,
  url: props.url,
  coordinates: [
    [props.coordinates[0][0], props.coordinates[0][1]],
    [props.coordinates[1][0], props.coordinates[1][1]],
    [props.coordinates[2][0], props.coordinates[2][1]],
    [props.coordinates[3][0], props.coordinates[3][1]],
  ],
});
