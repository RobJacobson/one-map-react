import type {
  ExpressionSpecification,
  LayerSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/** Style expression accepted by the legacy facade filter API. */
export type Expression = readonly unknown[];

/** Style-spec filter expression selecting the features a layer draws. */
export type FilterExpression = readonly unknown[];

/** A paint or layout value that may be supplied as an expression. */
export type StyleValue<Value> = Value | Expression;

export type Visibility = "visible" | "none";
export type AlignmentMap = "map" | "viewport";
export type AlignmentAuto = "auto" | AlignmentMap;
export type Overlap = "never" | "always" | "cooperative";
export type SymbolAnchor =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type LayerType =
  | "background"
  | "fill"
  | "line"
  | "circle"
  | "symbol"
  | "raster"
  | "heatmap"
  | "fill-extrusion";

type RetainedLayer = LayerType | "hillshade";
type Specification<Type extends RetainedLayer> = Extract<
  LayerSpecification,
  { type: Type }
>;

// Existing callers can keep readonly expression tuples. Retain the expression
// discriminants so a typo in an enum or a tuple of constants still fails.
type ReadonlyValue<
  Value,
  Legacy extends boolean,
> = Value extends ExpressionSpecification
  ? Legacy extends true
    ? Expression
    : readonly [Value[0], ...unknown[]]
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyValue<Value[Key], Legacy> }
    : Value;

type LayerStyle<
  Type extends RetainedLayer,
  Kind extends "paint" | "layout",
  Legacy extends boolean = true,
> = ReadonlyValue<NonNullable<Specification<Type>[Kind]>, Legacy>;

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

type LayerFor<
  Type extends RetainedLayer,
  Legacy extends boolean = true,
> = LayerBaseProps & {
  readonly type: Type;
  readonly paint?: LayerStyle<Type, "paint", Legacy>;
  readonly layout?: LayerStyle<Type, "layout", Legacy>;
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
  [Type in RetainedLayer]: LayerFor<Type>;
}[RetainedLayer];

/** Desktop-style native layer props keep recognized expression operators. */
export type NativePortableLayerProps = {
  [Type in RetainedLayer]: LayerFor<Type, false>;
}[RetainedLayer];
