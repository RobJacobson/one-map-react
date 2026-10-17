import {
  ImageSource,
  RasterDemSource,
  RasterSource,
  ShapeSource,
  VectorSource,
} from "@rnmapbox/maps";
import type { ComponentProps, ComponentRef } from "react";
import { useLayoutEffect, useRef } from "react";

import type {
  GeoJsonSourceProps,
  ImageSourceProps,
  RasterDemSourceProps,
  RasterSourceProps,
  SourceProps,
  VectorSourceProps,
} from "../../contracts/source-types.js";
import { useOptionalMapSession } from "../../facade/map-context.js";
import {
  rejectNativeGeoJsonOptions,
  rejectProvided,
  rejectRasterDemScheme,
} from "../native-source-gates.js";
import { sourceHitFromMapbox } from "../shared/source-hit.js";
import { useGeoJsonSourceRegistry } from "./geojson-source-registry.js";

/** Mapbox-native source that dispatches to the matching RNMapbox source. */
export const MapboxNativeSource = (props: SourceProps) => {
  switch (props.type) {
    case "geojson":
      return <MapboxNativeGeoJsonSource {...props} />;
    case "vector":
      return <MapboxNativeVectorSource {...props} />;
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
 * GeoJSON source that registers its `ShapeSource` ref for cluster queries.
 *
 * @remarks
 * The registry only exists inside a mapbox-native Map; a source rendered
 * elsewhere still renders but does not register.
 *
 * @param props - Common GeoJSON source props.
 * @returns The RNMapbox `ShapeSource` with nested layers.
 * @throws When an option is unavailable on the pinned RNMapbox wrapper.
 */
const MapboxNativeGeoJsonSource = (props: GeoJsonSourceProps) => {
  const session = useOptionalMapSession();
  const press = (
    event: Parameters<
      NonNullable<ComponentProps<typeof ShapeSource>["onPress"]>
    >[0]
  ): void => {
    session?.dispatchSource(props.id, sourceHitFromMapbox(event));
  };
  const registry = useGeoJsonSourceRegistry();
  const sourceRef = useRef<ComponentRef<typeof ShapeSource>>(null);

  useLayoutEffect(() => {
    if (!registry) {
      return;
    }

    return registry.register(props.id, sourceRef.current);
  }, [registry, props.id]);

  return (
    <ShapeSource
      ref={sourceRef}
      {...toRnmapboxShapeSource(props)}
      hitbox={
        (
          props as GeoJsonSourceProps & {
            hitbox?: { width: number; height: number };
          }
        ).hitbox
      }
      onPress={props.onClick ? press : undefined}
    >
      {props.children}
    </ShapeSource>
  );
};

/** Registers the vector source lifetime for native feature-state reset. */
const MapboxNativeVectorSource = (props: VectorSourceProps) => {
  const session = useOptionalMapSession();
  const press = (
    event: Parameters<
      NonNullable<ComponentProps<typeof ShapeSource>["onPress"]>
    >[0]
  ): void => {
    session?.dispatchSource(props.id, sourceHitFromMapbox(event));
  };
  const registry = useGeoJsonSourceRegistry();

  useLayoutEffect(
    () => registry?.featureState.register(props.id, "vector"),
    [registry, props.id]
  );

  return (
    <VectorSource
      {...toRnmapboxVectorSource(props)}
      hitbox={
        (
          props as VectorSourceProps & {
            hitbox?: { width: number; height: number };
          }
        ).hitbox
      }
      onPress={props.onClick ? press : undefined}
    >
      {props.children}
    </VectorSource>
  );
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
    tileSize: props.tileSize,
  };
};

/**
 * Converts common image source props into RNMapbox `ImageSource` props.
 *
 * @remarks
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
