import type {
  Bounds,
  CameraCommandOptions,
  FitBoundsOptions,
  LngLat,
  MapRef,
  Padding,
  Point,
  ViewState,
} from "./camera-types.js";
import type { MapProps } from "./map-types.js";
import type { QueryRenderedFeaturesOptions } from "./query-types.js";
import type { GeoJsonFeature } from "./source-types.js";

/** Geographic coordinate with the desktop field names and legacy tuple access. */
export type NativeLngLat = LngLat & {
  readonly lng: number;
  readonly lat: number;
};

export type NativeLngLatLike =
  | LngLat
  | { readonly lng: number; readonly lat: number }
  | { readonly lon: number; readonly lat: number };

/** View point with the desktop field names and legacy tuple access. */
export type NativePoint = Point & { readonly x: number; readonly y: number };

export type NativePointLike =
  | Point
  | { readonly x: number; readonly y: number };

/** Visible geographic bounds in southwest/northeast order. */
export type NativeBounds = Bounds & {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
  getSouthWest(): NativeLngLat;
  getNorthEast(): NativeLngLat;
  getNorthWest(): NativeLngLat;
  getSouthEast(): NativeLngLat;
  getCenter(): NativeLngLat;
  toArray(): [[number, number], [number, number]];
};

export type NativeBoundsLike =
  | readonly [NativeLngLatLike, NativeLngLatLike]
  | readonly [number, number, number, number]
  | Pick<NativeBounds, "getWest" | "getSouth" | "getEast" | "getNorth">;

export interface NativeClickEvent {
  readonly lngLat: NativeLngLat;
  readonly point: NativePoint;
  readonly features?: readonly GeoJsonFeature[];
}

export interface NativeMarkerEvent {
  readonly lngLat: NativeLngLat;
  readonly point?: NativePoint;
}

export interface NativeCameraTarget extends Partial<ViewState> {
  readonly padding?: Padding;
}

export type NativeFitBoundsOptions = Omit<FitBoundsOptions, "padding"> & {
  readonly padding?: Padding | number;
};

export interface NativeInitialViewState extends NativeCameraTarget {
  readonly bounds?: NativeBoundsLike;
  readonly fitBoundsOptions?: Pick<
    NativeFitBoundsOptions,
    "padding" | "maxZoom"
  > & {
    readonly minZoom?: number;
    readonly offset?: NativePointLike;
  };
}

export interface NativeMapInputs
  extends
    Omit<
      MapProps,
      "initialViewState" | "viewState" | "maxBounds" | "onClick" | "onLongPress"
    >,
    NativeCameraTarget {
  /** Enables pinch zoom and rotation together. Per-gesture native flags take precedence. */
  readonly touchZoomRotate?: boolean;
  readonly initialViewState?: NativeInitialViewState;
  readonly viewState?: NativeCameraTarget;
  readonly maxBounds?: NativeBoundsLike;
  readonly onClick?: (event: NativeClickEvent) => void;
  readonly onLongPress?: (event: NativeClickEvent) => void;
  readonly onStyleData?: () => void;
}

export type NativeCameraCommand = Omit<
  CameraCommandOptions,
  "center" | "padding"
> & {
  readonly padding?: number | Padding;
  readonly center?: NativeLngLatLike;
};

type ClusterCallback<Result> = (error: Error | null, result?: Result) => void;
type ClusterFeatures = readonly GeoJsonFeature[];

/**
 * Cluster operations on a mounted declarative GeoJSON source.
 *
 * @remarks Read cluster IDs from queried features. They can change when
 * source data changes. New calls fail after the source registration is
 * removed or replaced. Query failures reject the promise or reach the
 * callback as an error. Callback calls return this handle for chaining.
 */
export interface NativeGeoJsonSource {
  readonly type: "geojson";
  /**
   * Reads the zoom level at which a cluster expands.
   * @param clusterId - Cluster ID from a queried feature.
   * @returns A promise for the expansion zoom.
   */
  getClusterExpansionZoom(clusterId: number): Promise<number>;
  getClusterExpansionZoom(
    clusterId: number,
    callback: ClusterCallback<number>
  ): NativeGeoJsonSource;
  /**
   * Reads the cluster's children at the next zoom level.
   * @param clusterId - Cluster ID from a queried feature.
   * @returns A promise for the child features in backend order.
   */
  getClusterChildren(clusterId: number): Promise<ClusterFeatures>;
  getClusterChildren(
    clusterId: number,
    callback: ClusterCallback<ClusterFeatures>
  ): NativeGeoJsonSource;
  /**
   * Reads a page of the point features in a cluster.
   * @param clusterId - Cluster ID from a queried feature.
   * @param limit - Maximum number of leaves to return.
   * @param offset - Number of leaves to skip.
   * @returns A promise for the leaf features in backend order.
   */
  getClusterLeaves(
    clusterId: number,
    limit: number,
    offset: number
  ): Promise<ClusterFeatures>;
  getClusterLeaves(
    clusterId: number,
    limit: number,
    offset: number,
    callback: ClusterCallback<ClusterFeatures>
  ): NativeGeoJsonSource;
}

/** Arguments shared by the native selected map handles. */
export interface NativeMapRef extends MapRef {
  /**
   * Looks up the mounted GeoJSON source handle for this map.
   * @param id - ID of the declarative source.
   * @returns The source handle, or undefined when no GeoJSON source is attached under that ID.
   */
  getSource(id: string): NativeGeoJsonSource | undefined;
  getCenter(): Promise<NativeLngLat>;
  getBounds(): Promise<NativeBounds>;
  project(lngLat: NativeLngLatLike): Promise<NativePoint>;
  unproject(point: NativePointLike): Promise<NativeLngLat>;
  jumpTo(options: NativeCameraCommand): Promise<void>;
  easeTo(options: NativeCameraCommand): Promise<void>;
  flyTo(options: NativeCameraCommand): Promise<void>;
  fitBounds(
    bounds: NativeBoundsLike,
    options?: NativeFitBoundsOptions
  ): Promise<void>;
  queryRenderedFeatures(
    pointOrBounds?:
      | NativePointLike
      | readonly [NativePointLike, NativePointLike]
      | QueryRenderedFeaturesOptions,
    options?: QueryRenderedFeaturesOptions
  ): Promise<ClusterFeatures>;
  queryTerrainElevation(
    coordinate: NativeLngLatLike,
    options?: { readonly exaggerated?: boolean }
  ): Promise<number | null>;
}
