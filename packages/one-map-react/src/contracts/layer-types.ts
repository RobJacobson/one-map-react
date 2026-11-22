import type {
  ExpressionSpecification,
  LayerSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/** Style-spec filter expression selecting the features a layer draws. */
export type FilterExpression = readonly unknown[];

/** Layer families supported by both selected native entries. */
export type LayerType =
  | "background"
  | "fill"
  | "line"
  | "circle"
  | "symbol"
  | "raster"
  | "heatmap"
  | "fill-extrusion"
  | "hillshade";

type Specification<Type extends LayerType> = Extract<
  LayerSpecification,
  { type: Type }
>;

// Keep expression operators so unsupported constant values fail type checking.
type ReadonlyValue<Value> = Value extends ExpressionSpecification
  ? readonly [ExpressionSpecification[0], ...unknown[]]
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyValue<Value[Key]> }
    : Value;

type LayerStyle<
  Type extends LayerType,
  Kind extends "paint" | "layout",
> = ReadonlyValue<NonNullable<Specification<Type>[Kind]>>;

export type BackgroundPaint = LayerStyle<"background", "paint">;
export type BackgroundLayout = LayerStyle<"background", "layout">;
export type FillPaint = LayerStyle<"fill", "paint">;
export type FillLayout = LayerStyle<"fill", "layout">;
export type LinePaint = LayerStyle<"line", "paint">;
export type LineLayout = LayerStyle<"line", "layout">;
export type CirclePaint = LayerStyle<"circle", "paint">;
export type CircleLayout = LayerStyle<"circle", "layout">;
export type SymbolPaint = LayerStyle<"symbol", "paint">;
export type SymbolLayout = LayerStyle<"symbol", "layout">;
export type RasterPaint = LayerStyle<"raster", "paint">;
export type RasterLayout = LayerStyle<"raster", "layout">;
export type HeatmapPaint = LayerStyle<"heatmap", "paint">;
export type HeatmapLayout = LayerStyle<"heatmap", "layout">;
export type FillExtrusionPaint = LayerStyle<"fill-extrusion", "paint">;
export type FillExtrusionLayout = LayerStyle<"fill-extrusion", "layout">;
export type HillshadePaint = LayerStyle<"hillshade", "paint">;

interface LayerBaseProps {
  /** Layer ID. Changing it requires a new React key. */
  readonly id: string;
  /** Places this layer directly below the named layer. */
  readonly beforeId?: string;
  readonly minzoom?: number;
  readonly maxzoom?: number;
  /** Explicit source ID or the ID injected by a parent Source. */
  readonly source?: string;
  /** Source ID injected by RNMapbox. */
  readonly sourceID?: string;
}

type LayerFor<Type extends LayerType> = LayerBaseProps & {
  readonly type: Type;
  readonly paint?: LayerStyle<Type, "paint">;
  readonly layout?: LayerStyle<Type, "layout">;
} & (Type extends "background"
    ? object
    : {
        /** Names the layer within a vector tile source. */
        readonly "source-layer"?: string;
        readonly filter?: FilterExpression;
      });

export type BackgroundLayerProps = LayerFor<"background">;
export type FillLayerProps = LayerFor<"fill">;
export type LineLayerProps = LayerFor<"line">;
export type CircleLayerProps = LayerFor<"circle">;
export type SymbolLayerProps = LayerFor<"symbol">;
export type RasterLayerProps = LayerFor<"raster">;
export type HeatmapLayerProps = LayerFor<"heatmap">;
export type FillExtrusionLayerProps = LayerFor<"fill-extrusion">;
export type HillshadeLayerProps = LayerFor<"hillshade">;

/** Family-specific style properties from the pinned style specification. */
export type LayerProps = {
  [Type in LayerType]: LayerFor<Type>;
}[LayerType];
