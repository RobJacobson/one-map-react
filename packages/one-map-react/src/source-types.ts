import type { ReactNode } from "react";

/**
 * GeoJSON FeatureCollection accepted by the example `Source`.
 */
export interface GeoJsonFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly object[];
}

/**
 * Line paint fields implemented in TF02.
 */
export interface LinePaint {
  /** Stroke color. */
  readonly "line-color": string;
  /** Stroke width. */
  readonly "line-width": number;
}

/**
 * Line layout fields implemented in TF02.
 */
export interface LineLayout {
  /** End-cap style. */
  readonly "line-cap"?: "round" | "butt" | "square";
}

/**
 * Props for the shared GeoJSON {@link Source}.
 */
export interface SourceProps {
  /** Stable source id used by child layers. */
  readonly id: string;
  /** Only GeoJSON object data is implemented in TF02. */
  readonly type: "geojson";
  /** Feature collection drawn by child layers. */
  readonly data: GeoJsonFeatureCollection;
  /** Nested line layers. */
  readonly children?: ReactNode;
}

/**
 * Props for the shared line {@link Layer}.
 *
 * `source` and `sourceID` are injected by the parent wrapper source. Callers
 * omit them; the layer forwards whichever the selected wrapper provides.
 */
export interface LayerProps {
  /** Stable layer id. */
  readonly id: string;
  /** Only line layers are implemented in TF02. */
  readonly type: "line";
  /** Style-spec paint properties. */
  readonly paint: LinePaint;
  /** Style-spec layout properties. */
  readonly layout?: LineLayout;
  /**
   * Source id injected by react-map-gl and MapLibre Native parent sources.
   */
  readonly source?: string;
  /**
   * Source id injected by an RNMapbox parent `ShapeSource`.
   */
  readonly sourceID?: string;
}
