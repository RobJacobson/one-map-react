import {
  ImageSource,
  RasterDemSource,
  RasterSource,
  ShapeSource,
  VectorSource,
} from "@rnmapbox/maps";
import type { ComponentProps, ComponentRef } from "react";
import { useContext, useRef } from "react";

import type {
  GeoJsonSourceProps,
  RasterDemSourceProps,
  RasterSourceProps,
  SourceProps,
  VectorSourceProps,
} from "../../contracts/source-types.js";
import {
  rejectNativeGeoJsonGenerateId,
  rejectProvided,
  rejectRasterDemScheme,
} from "../native-source-gates.js";
import {
  copyNativeImageCorners,
  copyOptionalNativeTiles,
  useNativeSourceRegistration,
} from "../shared/index.js";
import { GeoJsonSourceContext } from "./geojson-source-registry.js";

/** Mapbox-native source that dispatches to the matching RNMapbox source. */
export const MapboxNativeSource = (props: SourceProps) => {
  switch (props.type) {
    case "geojson":
      return <MapboxNativeGeoJsonSource {...props} />;
    case "vector":
      return (
        <VectorSource {...toRnmapboxVectorOrRasterSource(props)}>
          {props.children}
        </VectorSource>
      );
    case "raster":
      return (
        <RasterSource
          {...toRnmapboxVectorOrRasterSource(props)}
          tileSize={props.tileSize}
        >
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
        <ImageSource
          id={props.id}
          url={props.url}
          coordinates={copyNativeImageCorners(props.coordinates)}
        >
          {props.children}
        </ImageSource>
      );
  }
};

/**
 * GeoJSON source that registers its `ShapeSource` ref for cluster queries.
 *
 * The registry only exists inside a mapbox-native Map; a source rendered
 * elsewhere still renders but does not register.
 *
 * @param props - Common GeoJSON source props.
 * @returns The RNMapbox `ShapeSource` with nested layers.
 * @throws When an option is unavailable on the pinned RNMapbox wrapper.
 */
const MapboxNativeGeoJsonSource = (props: GeoJsonSourceProps) => {
  const registry = useContext(GeoJsonSourceContext);
  const sourceRef = useRef<ComponentRef<typeof ShapeSource>>(null);

  useNativeSourceRegistration({
    registry,
    id: props.id,
    sourceRef,
    toRegistration: toShapeRegistration,
  });

  return (
    <ShapeSource ref={sourceRef} {...toRnmapboxShapeSource(props)}>
      {props.children}
    </ShapeSource>
  );
};

const toShapeRegistration = (ref: ComponentRef<typeof ShapeSource>) => ref;

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
  rejectNativeGeoJsonGenerateId(props.generateId, "mapbox-native");

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
    clusterMinPoints: props.clusterMinPoints,
    clusterMaxZoomLevel: props.clusterMaxZoom,
    clusterProperties: props.clusterProperties,
    promoteId: props.promoteId,
    maxZoomLevel: props.maxzoom,
    buffer: props.buffer,
    tolerance: props.tolerance,
    lineMetrics: props.lineMetrics,
  };
};

/**
 * Converts the fields shared by RNMapbox vector and raster sources.
 *
 * @param props - Common vector or raster source props.
 * @returns Props for the wrapper component, including scheme and attribution.
 */
const toRnmapboxVectorOrRasterSource = (
  props: VectorSourceProps | RasterSourceProps
) => ({
  ...toRnmapboxTileSource(props),
  tms: props.scheme === undefined ? undefined : props.scheme === "tms",
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
    ...toRnmapboxTileSource(props),
    tileSize: props.tileSize,
  };
};

const toRnmapboxTileSource = ({
  id,
  url,
  tiles,
  minzoom,
  maxzoom,
}: VectorSourceProps | RasterSourceProps | RasterDemSourceProps) => ({
  id,
  url,
  tileUrlTemplates: copyOptionalNativeTiles(tiles),
  minZoomLevel: minzoom,
  maxZoomLevel: maxzoom,
});
