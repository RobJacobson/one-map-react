import type { ReactNode } from "react";

import type { LngLat } from "./camera-types.js";

/**
 * GeoJSON geometry accepted by the shared GeoJSON {@link Source}.
 */
export interface GeoJsonGeometry {
  /** Geometry type such as `Point` or `LineString`. */
  readonly type: string;
  /** Position arrays for ordinary geometries. */
  readonly coordinates?: unknown;
  /** Member geometries of a `GeometryCollection`. */
  readonly geometries?: readonly GeoJsonGeometry[];
}

/**
 * GeoJSON feature accepted by the shared GeoJSON {@link Source}.
 */
export interface GeoJsonFeature {
  /** Discriminates GeoJSON features. */
  readonly type: "Feature";
  /** Stable feature id used by filters, feature state, and queries. */
  readonly id?: string | number;
  /** Source identifier included by rendered feature queries when available. */
  readonly source?: string;
  /** Vector source-layer identifier when included by the renderer. */
  readonly sourceLayer?: string;
  /** Feature attributes available to expressions. */
  readonly properties?: Readonly<Record<string, unknown>> | null;
  /** Feature geometry. */
  readonly geometry: GeoJsonGeometry;
}

/**
 * GeoJSON FeatureCollection accepted by the shared GeoJSON {@link Source}.
 */
export interface GeoJsonFeatureCollection {
  /** Discriminates GeoJSON feature collections. */
  readonly type: "FeatureCollection";
  /** Features drawn by child layers. */
  readonly features: readonly GeoJsonFeature[];
}

/**
 * GeoJSON object accepted as source data.
 */
export type GeoJsonData =
  | GeoJsonFeatureCollection
  | GeoJsonFeature
  | GeoJsonGeometry;

/**
 * Geographic corners of a georeferenced image source, ordered top-left,
 * top-right, bottom-right, bottom-left.
 */
export type ImageSourceCorners = readonly [LngLat, LngLat, LngLat, LngLat];

interface SourceBaseProps {
  /**
   * Nonempty stable source id used by child layers. Changing it requires
   * remounting the source, for example with a React `key`.
   */
  readonly id: string;
  /** Nested layers drawing this source. */
  readonly children?: ReactNode;
}

/**
 * GeoJSON source creation options shared by every adapter.
 */
export interface GeoJsonSourceProps extends SourceBaseProps {
  /** Selects the GeoJSON source family. */
  readonly type: "geojson";
  /**
   * GeoJSON object or a URL that returns one. Updating `data` redraws the
   * source without remounting.
   * Renderer source specification options remain creation-only.
   */
  readonly data: GeoJsonData | string;
  /** Maximum zoom level at which to create vector tiles. */
  readonly maxzoom?: number;
  /** Tile buffer size on each side; 512 equals one tile width. */
  readonly buffer?: number;
  /** Douglas-Peucker simplification tolerance. */
  readonly tolerance?: number;
  /** Calculate line distance metrics, required by `line-gradient`. */
  readonly lineMetrics?: boolean;
  /** Enables clustering on point data. */
  readonly cluster?: boolean;
  /** Cluster radius in pixels; 512 equals one tile width. */
  readonly clusterRadius?: number;
  /** Maximum zoom level at which points are clustered. */
  readonly clusterMaxZoom?: number;
  /**
   * Minimum points required to form a cluster.
   *
   * @throws Not available on mapbox-native: the pinned RNMapbox `ShapeSource`
   * has no `clusterMinPoints` prop.
   */
  readonly clusterMinPoints?: number;
  /**
   * Aggregated properties computed on generated clusters. Each value is a
   * `[reduceExpression, mapExpression]` pair kept structurally intact.
   */
  readonly clusterProperties?: Readonly<Record<string, readonly unknown[]>>;
  /**
   * Generate ids for features that lack one.
   *
   * @throws Not available on native maps: the pinned native wrappers do not
   * declare a `generateId` source prop.
   */
  readonly generateId?: boolean;
  /**
   * Property promoted to the feature id.
   *
   * @throws Not available on native maps: the pinned native wrappers do not
   * declare a `promoteId` source prop.
   */
  readonly promoteId?: string;
}

/**
 * Vector tile source creation options shared by every adapter.
 */
export interface VectorSourceProps extends SourceBaseProps {
  /** Selects the vector tile source family. */
  readonly type: "vector";
  /** URL of a TileJSON document. Supply `url` or `tiles`, not both. */
  readonly url?: string;
  /** Tile URL templates such as `https://…/{z}/{x}/{y}.pbf`. */
  readonly tiles?: readonly string[];
  /** Minimum zoom level at which tiles are displayed, 0–22. */
  readonly minzoom?: number;
  /** Maximum zoom level at which tiles are displayed, 0–22. */
  readonly maxzoom?: number;
  /** Tile coordinate scheme; `tms` inverts the y axis. */
  readonly scheme?: "xyz" | "tms";
  /** Attribution text shown with the map's attribution control. */
  readonly attribution?: string;
}

/**
 * Raster tile source creation options shared by every adapter.
 */
export interface RasterSourceProps extends SourceBaseProps {
  /** Selects the raster tile source family. */
  readonly type: "raster";
  /** URL of a TileJSON document. Supply `url` or `tiles`, not both. */
  readonly url?: string;
  /** Tile URL templates such as `https://…/{z}/{x}/{y}.png`. */
  readonly tiles?: readonly string[];
  /** Minimum zoom level at which tiles are displayed, 0–22. */
  readonly minzoom?: number;
  /** Maximum zoom level at which tiles are displayed, 0–22. */
  readonly maxzoom?: number;
  /** Tile coordinate scheme; `tms` inverts the y axis. */
  readonly scheme?: "xyz" | "tms";
  /** Tile edge length in pixels; 512 by default. */
  readonly tileSize?: number;
  /** Attribution text shown with the map's attribution control. */
  readonly attribution?: string;
}

/**
 * Raster digital elevation model source creation options shared by every
 * adapter. Terrain rendering itself is TF09 work; this source can back
 * hillshade-style elevation data.
 */
export interface RasterDemSourceProps extends SourceBaseProps {
  /** Selects the raster DEM source family. */
  readonly type: "raster-dem";
  /** URL of a TileJSON document. Supply `url` or `tiles`, not both. */
  readonly url?: string;
  /** Tile URL templates such as `https://…/{z}/{x}/{y}.png`. */
  readonly tiles?: readonly string[];
  /** Minimum zoom level at which tiles are displayed, 0–22. */
  readonly minzoom?: number;
  /** Maximum zoom level at which tiles are displayed, 0–22. */
  readonly maxzoom?: number;
  /** Tile edge length in pixels; 512 by default. */
  readonly tileSize?: number;
  /**
   * Attribution text shown with the map's attribution control.
   *
   * @throws Not available on mapbox-native: the pinned RNMapbox
   * `RasterDemSource` declares no `attribution` prop.
   */
  readonly attribution?: string;
  /**
   * Tile coordinate scheme; `tms` inverts the y axis.
   *
   * @throws Not available on native maps: the pinned native DEM wrappers
   * declare no `scheme` or `tms` prop.
   */
  readonly scheme?: "xyz" | "tms";
  /**
   * Elevation encoding formula of the tileset.
   *
   * @throws Not available on mapbox-native: the pinned RNMapbox
   * `RasterDemSource` declares no `encoding` prop.
   */
  readonly encoding?: "mapbox" | "terrarium";
}

/**
 * Georeferenced image source options shared by every adapter.
 *
 * `url` and `coordinates` may be updated without remounting. Bundled native
 * asset handles are host-specific and remain named native extension work.
 */
export interface ImageSourceProps extends SourceBaseProps {
  /** Selects the georeferenced image source family. */
  readonly type: "image";
  /** HTTP(S) URL of the source image. Animated GIFs are not supported. */
  readonly url: string;
  /** Top-left, top-right, bottom-right, bottom-left corners. */
  readonly coordinates: ImageSourceCorners;
}

/**
 * Props for the shared {@link Source}, discriminated by `type`.
 *
 * `id`, `type`, and every option except GeoJSON `data` and image
 * `url`/`coordinates` are creation inputs: changing them throws and requires
 * remounting the source with a new React `key`.
 */
export type SourceProps =
  | GeoJsonSourceProps
  | VectorSourceProps
  | RasterSourceProps
  | RasterDemSourceProps
  | ImageSourceProps;
