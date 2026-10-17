/**
 * Style-spec expression preserved structurally by the facade.
 *
 * The facade does not validate operator support; each renderer validates the
 * expressions it receives. A common expression is not a promise that every
 * backend implements every operator.
 */
export type Expression = readonly unknown[];

/**
 * Style-spec filter expression selecting the features a layer draws.
 */
export type FilterExpression = readonly unknown[];

/**
 * A paint or layout value: either a constant or an expression.
 */
export type StyleValue<Value> = Value | Expression;

/** Layer visibility shared by every layer type. */
export type Visibility = "visible" | "none";

/** Reference frame for translated or scaled geometry. */
export type AlignmentMap = "map" | "viewport";

/** Reference frame that may also follow the viewport orientation. */
export type AlignmentAuto = "auto" | "map" | "viewport";

/** Overlap behavior for symbol placement. */
export type Overlap = "never" | "always" | "cooperative";

/** Anchor positions for icon and text placement. */
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

/** Paint fields for a `background` layer. */
export interface BackgroundPaint {
  /** Fill color. */
  readonly "background-color"?: StyleValue<string>;
  /** Fill opacity. */
  readonly "background-opacity"?: StyleValue<number>;
  /** Registered image used as the fill pattern. */
  readonly "background-pattern"?: StyleValue<string>;
}

/** Layout fields for a `background` layer. */
export interface BackgroundLayout {
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `fill` layer. */
export interface FillPaint {
  /** Whether the fill is antialiased. */
  readonly "fill-antialias"?: StyleValue<boolean>;
  /** Fill color. */
  readonly "fill-color"?: StyleValue<string>;
  /** Fill opacity. */
  readonly "fill-opacity"?: StyleValue<number>;
  /** Outline color; requires `fill-antialias` and no pattern. */
  readonly "fill-outline-color"?: StyleValue<string>;
  /** Registered image used as the fill pattern. */
  readonly "fill-pattern"?: StyleValue<string>;
  /** Fill translation in pixels. */
  readonly "fill-translate"?: StyleValue<readonly [number, number]>;
  /** Reference frame for `fill-translate`. */
  readonly "fill-translate-anchor"?: StyleValue<AlignmentMap>;
}

/** Layout fields for a `fill` layer. */
export interface FillLayout {
  /** Sort key ordering this layer relative to peers in one source. */
  readonly "fill-sort-key"?: StyleValue<number>;
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `line` layer. */
export interface LinePaint {
  /** Stroke blur in pixels. */
  readonly "line-blur"?: StyleValue<number>;
  /** Stroke color. */
  readonly "line-color"?: StyleValue<string>;
  /** Dash pattern alternating line and gap lengths. */
  readonly "line-dasharray"?: StyleValue<readonly number[]>;
  /** Stroke width drawn beyond the geometry. */
  readonly "line-gap-width"?: StyleValue<number>;
  /** Color gradient along the line; requires source `lineMetrics`. */
  readonly "line-gradient"?: Expression;
  /** Stroke offset in pixels. */
  readonly "line-offset"?: StyleValue<number>;
  /** Stroke opacity. */
  readonly "line-opacity"?: StyleValue<number>;
  /** Registered image used as the stroke pattern. */
  readonly "line-pattern"?: StyleValue<string>;
  /** Stroke translation in pixels. */
  readonly "line-translate"?: StyleValue<readonly [number, number]>;
  /** Reference frame for `line-translate`. */
  readonly "line-translate-anchor"?: StyleValue<AlignmentMap>;
  /** Stroke width in pixels. */
  readonly "line-width"?: StyleValue<number>;
}

/** Layout fields for a `line` layer. */
export interface LineLayout {
  /** End-cap style. */
  readonly "line-cap"?: StyleValue<"butt" | "round" | "square">;
  /** Join style at intermediate vertices. */
  readonly "line-join"?: StyleValue<"bevel" | "round" | "miter">;
  /** Maximum miter length for `line-join: "miter"`. */
  readonly "line-miter-limit"?: StyleValue<number>;
  /** Maximum inner angle for `line-join: "round"`. */
  readonly "line-round-limit"?: StyleValue<number>;
  /** Sort key ordering this layer relative to peers in one source. */
  readonly "line-sort-key"?: StyleValue<number>;
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `circle` layer. */
export interface CirclePaint {
  /** Circle blur as a fraction of the radius. */
  readonly "circle-blur"?: StyleValue<number>;
  /** Circle fill color. */
  readonly "circle-color"?: StyleValue<string>;
  /** Circle fill opacity. */
  readonly "circle-opacity"?: StyleValue<number>;
  /** Whether the circle scales when the map is pitched. */
  readonly "circle-pitch-scale"?: StyleValue<AlignmentMap>;
  /** Circle orientation when the map is pitched. */
  readonly "circle-pitch-alignment"?: StyleValue<AlignmentMap>;
  /** Circle radius in pixels. */
  readonly "circle-radius"?: StyleValue<number>;
  /** Stroke color around the circle. */
  readonly "circle-stroke-color"?: StyleValue<string>;
  /** Stroke opacity around the circle. */
  readonly "circle-stroke-opacity"?: StyleValue<number>;
  /** Stroke width around the circle in pixels. */
  readonly "circle-stroke-width"?: StyleValue<number>;
  /** Circle translation in pixels. */
  readonly "circle-translate"?: StyleValue<readonly [number, number]>;
  /** Reference frame for `circle-translate`. */
  readonly "circle-translate-anchor"?: StyleValue<AlignmentMap>;
}

/** Layout fields for a `circle` layer. */
export interface CircleLayout {
  /** Sort key ordering this layer relative to peers in one source. */
  readonly "circle-sort-key"?: StyleValue<number>;
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `symbol` layer. */
export interface SymbolPaint {
  /** Icon tint color. */
  readonly "icon-color"?: StyleValue<string>;
  /** Icon halo blur in pixels. */
  readonly "icon-halo-blur"?: StyleValue<number>;
  /** Icon halo color. */
  readonly "icon-halo-color"?: StyleValue<string>;
  /** Icon halo width in pixels. */
  readonly "icon-halo-width"?: StyleValue<number>;
  /** Icon opacity. */
  readonly "icon-opacity"?: StyleValue<number>;
  /** Icon translation in pixels. */
  readonly "icon-translate"?: StyleValue<readonly [number, number]>;
  /** Reference frame for `icon-translate`. */
  readonly "icon-translate-anchor"?: StyleValue<AlignmentMap>;
  /** Text color. */
  readonly "text-color"?: StyleValue<string>;
  /** Text halo blur in pixels. */
  readonly "text-halo-blur"?: StyleValue<number>;
  /** Text halo color. */
  readonly "text-halo-color"?: StyleValue<string>;
  /** Text halo width in pixels. */
  readonly "text-halo-width"?: StyleValue<number>;
  /** Text opacity. */
  readonly "text-opacity"?: StyleValue<number>;
  /** Text translation in pixels. */
  readonly "text-translate"?: StyleValue<readonly [number, number]>;
  /** Reference frame for `text-translate`. */
  readonly "text-translate-anchor"?: StyleValue<AlignmentMap>;
}

/** Layout fields for a `symbol` layer. */
export interface SymbolLayout {
  /** Label placement relative to the geometry. */
  readonly "symbol-placement"?: StyleValue<"point" | "line" | "line-center">;
  /** Distance between symbol anchors in pixels. */
  readonly "symbol-spacing"?: StyleValue<number>;
  /** Whether symbols may cross tile edges. */
  readonly "symbol-avoid-edges"?: StyleValue<boolean>;
  /** Sort key ordering this layer relative to peers in one source. */
  readonly "symbol-sort-key"?: StyleValue<number>;
  /** Draw order for overlapping symbols. */
  readonly "symbol-z-order"?: StyleValue<"auto" | "viewport-y" | "source">;
  /** Whether the icon draws over colliding symbols. */
  readonly "icon-allow-overlap"?: StyleValue<boolean>;
  /**
   * Whether the icon draws when it collides with other symbols.
   *
   * @throws Not available on native maps: the pinned native wrapper style
   * maps predate this property.
   */
  readonly "icon-overlap"?: StyleValue<Overlap>;
  /** Whether the icon is dropped when it collides with the text. */
  readonly "icon-ignore-placement"?: StyleValue<boolean>;
  /** Whether a missing icon image still draws the text. */
  readonly "icon-optional"?: StyleValue<boolean>;
  /** Icon rotation relative to map or viewport. */
  readonly "icon-rotation-alignment"?: StyleValue<AlignmentAuto>;
  /** Icon scale relative to its original size. */
  readonly "icon-size"?: StyleValue<number>;
  /** How the icon scales to fit the paired text. */
  readonly "icon-text-fit"?: StyleValue<"none" | "width" | "height" | "both">;
  /** Padding added by `icon-text-fit`, top/right/bottom/left pixels. */
  readonly "icon-text-fit-padding"?: StyleValue<
    readonly [number, number, number, number]
  >;
  /** Registered image drawn as the icon. */
  readonly "icon-image"?: StyleValue<string>;
  /** Icon rotation in degrees clockwise. */
  readonly "icon-rotate"?: StyleValue<number>;
  /** Icon collision padding in pixels. */
  readonly "icon-padding"?: StyleValue<number>;
  /** Whether the icon flips to stay upright with `symbol-placement: "line"`. */
  readonly "icon-keep-upright"?: StyleValue<boolean>;
  /** Icon offset from its anchor in ems. */
  readonly "icon-offset"?: StyleValue<readonly [number, number]>;
  /** Icon anchor relative to its position. */
  readonly "icon-anchor"?: StyleValue<SymbolAnchor>;
  /** Icon orientation when the map is pitched. */
  readonly "icon-pitch-alignment"?: StyleValue<AlignmentAuto>;
  /** Text orientation when the map is pitched. */
  readonly "text-pitch-alignment"?: StyleValue<AlignmentAuto>;
  /** Text rotation relative to map or viewport. */
  readonly "text-rotation-alignment"?: StyleValue<AlignmentAuto>;
  /** Text content; `["get", "name"]` reads a feature property. */
  readonly "text-field"?: StyleValue<string>;
  /** Font stack from the style's glyphs. */
  readonly "text-font"?: StyleValue<readonly string[]>;
  /** Font size in pixels. */
  readonly "text-size"?: StyleValue<number>;
  /** Maximum line width before wrapping in ems. */
  readonly "text-max-width"?: StyleValue<number>;
  /** Line height for multiline text in ems. */
  readonly "text-line-height"?: StyleValue<number>;
  /** Letter spacing in ems. */
  readonly "text-letter-spacing"?: StyleValue<number>;
  /** Text justification. */
  readonly "text-justify"?: StyleValue<"auto" | "left" | "center" | "right">;
  /** Radial text offset in ems, overriding the anchor pair. */
  readonly "text-radial-offset"?: StyleValue<number>;
  /** Candidate anchors tried in priority order. */
  readonly "text-variable-anchor"?: readonly SymbolAnchor[];
  /**
   * Candidate anchor/offset pairs tried in priority order.
   *
   * @throws Not available on native maps: the pinned native wrapper style
   * maps predate this property.
   */
  readonly "text-variable-anchor-offset"?: readonly (readonly [
    SymbolAnchor,
    readonly [number, number],
  ])[];
  /** Text anchor relative to its position. */
  readonly "text-anchor"?: StyleValue<SymbolAnchor>;
  /** Maximum angle between adjacent characters for line placement. */
  readonly "text-max-angle"?: StyleValue<number>;
  /** Allowed glyph orientations. */
  readonly "text-writing-mode"?: readonly ("horizontal" | "vertical")[];
  /** Text rotation in degrees clockwise. */
  readonly "text-rotate"?: StyleValue<number>;
  /** Text collision padding in pixels. */
  readonly "text-padding"?: StyleValue<number>;
  /** Whether the text flips to stay upright with line placement. */
  readonly "text-keep-upright"?: StyleValue<boolean>;
  /** Case transform applied to the text. */
  readonly "text-transform"?: StyleValue<"none" | "uppercase" | "lowercase">;
  /** Text offset from its anchor in ems. */
  readonly "text-offset"?: StyleValue<readonly [number, number]>;
  /** Whether the text draws over colliding symbols. */
  readonly "text-allow-overlap"?: StyleValue<boolean>;
  /**
   * Whether the text draws when it collides with other symbols.
   *
   * @throws Not available on native maps: the pinned native wrapper style
   * maps predate this property.
   */
  readonly "text-overlap"?: StyleValue<Overlap>;
  /** Whether the text is dropped when it collides with the icon. */
  readonly "text-ignore-placement"?: StyleValue<boolean>;
  /** Whether a missing text value still draws the icon. */
  readonly "text-optional"?: StyleValue<boolean>;
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `raster` layer. */
export interface RasterPaint {
  /** Raster opacity. */
  readonly "raster-opacity"?: StyleValue<number>;
  /** Hue rotation in degrees. */
  readonly "raster-hue-rotate"?: StyleValue<number>;
  /** Minimum output brightness, 0–1. */
  readonly "raster-brightness-min"?: StyleValue<number>;
  /** Maximum output brightness, 0–1. */
  readonly "raster-brightness-max"?: StyleValue<number>;
  /** Saturation adjustment, -1–1. */
  readonly "raster-saturation"?: StyleValue<number>;
  /** Contrast adjustment, -1–1. */
  readonly "raster-contrast"?: StyleValue<number>;
  /** Sampling filter for scaled tiles. */
  readonly "raster-resampling"?: StyleValue<"linear" | "nearest">;
  /** Time in milliseconds for a new tile to fade in. */
  readonly "raster-fade-duration"?: StyleValue<number>;
}

/** Layout fields for a `raster` layer. */
export interface RasterLayout {
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `heatmap` layer. */
export interface HeatmapPaint {
  /** Heatmap kernel radius in pixels. */
  readonly "heatmap-radius"?: StyleValue<number>;
  /** Per-point weight. */
  readonly "heatmap-weight"?: StyleValue<number>;
  /** Global intensity multiplier. */
  readonly "heatmap-intensity"?: StyleValue<number>;
  /**
   * Density color ramp as an `interpolate` expression over
   * `heatmap-density`.
   */
  readonly "heatmap-color"?: Expression;
  /** Heatmap opacity. */
  readonly "heatmap-opacity"?: StyleValue<number>;
}

/** Layout fields for a `heatmap` layer. */
export interface HeatmapLayout {
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Paint fields for a `fill-extrusion` layer. */
export interface FillExtrusionPaint {
  /** Extrusion opacity. */
  readonly "fill-extrusion-opacity"?: StyleValue<number>;
  /** Extrusion color. */
  readonly "fill-extrusion-color"?: StyleValue<string>;
  /** Extrusion translation in pixels. */
  readonly "fill-extrusion-translate"?: StyleValue<readonly [number, number]>;
  /** Reference frame for `fill-extrusion-translate`. */
  readonly "fill-extrusion-translate-anchor"?: StyleValue<AlignmentMap>;
  /** Registered image used as the extrusion pattern. */
  readonly "fill-extrusion-pattern"?: StyleValue<string>;
  /** Extrusion height in meters. */
  readonly "fill-extrusion-height"?: StyleValue<number>;
  /** Extrusion base height in meters. */
  readonly "fill-extrusion-base"?: StyleValue<number>;
  /** Whether the sides fade to transparent toward the top. */
  readonly "fill-extrusion-vertical-gradient"?: StyleValue<boolean>;
}

/** Layout fields for a `fill-extrusion` layer. */
export interface FillExtrusionLayout {
  /** Whether the layer is drawn. */
  readonly visibility?: Visibility;
}

/** Layer types in the portable set. */
export type LayerType =
  | "hillshade"
  | "background"
  | "fill"
  | "line"
  | "circle"
  | "symbol"
  | "raster"
  | "heatmap"
  | "fill-extrusion";

interface LayerBaseProps {
  /**
   * Nonempty stable layer id. Changing it requires remounting the layer, for
   * example with a React `key`.
   */
  readonly id: string;
  /**
   * Insert this layer directly under the layer with this id. Changing the
   * value moves the layer where the wrapper supports reordering.
   */
  readonly beforeId?: string;
  /** Minimum zoom level at which the layer is parsed and drawn, 0–24. */
  readonly minzoom?: number;
  /** Maximum zoom level at which the layer is parsed and drawn, 0–24. */
  readonly maxzoom?: number;
  /**
   * Source id injected by react-map-gl and MapLibre Native parent sources.
   * Callers omit it; the layer forwards whichever id the wrapper provides.
   * Changing it requires remounting the layer.
   */
  readonly source?: string;
  /**
   * Source id injected by an RNMapbox parent source. Changing it requires
   * remounting the layer.
   */
  readonly sourceID?: string;
}

interface SourcedLayerProps extends LayerBaseProps {
  /**
   * Name of the layer inside a vector tile source. Required for layers
   * drawing from a vector source; changing it requires remounting the layer.
   */
  readonly "source-layer"?: string;
  /** Filter selecting which features this layer draws. */
  readonly filter?: FilterExpression;
}

/** Props for a shared `background` {@link Layer}. */
export interface BackgroundLayerProps extends LayerBaseProps {
  /** Selects the background layer type. */
  readonly type: "background";
  /** Style-spec paint properties. */
  readonly paint?: BackgroundPaint;
  /** Style-spec layout properties. */
  readonly layout?: BackgroundLayout;
}

/** Props for a shared `fill` {@link Layer}. */
export interface FillLayerProps extends SourcedLayerProps {
  /** Selects the fill layer type. */
  readonly type: "fill";
  /** Style-spec paint properties. */
  readonly paint?: FillPaint;
  /** Style-spec layout properties. */
  readonly layout?: FillLayout;
}

/** Props for a shared `line` {@link Layer}. */
export interface LineLayerProps extends SourcedLayerProps {
  /** Selects the line layer type. */
  readonly type: "line";
  /** Style-spec paint properties. */
  readonly paint?: LinePaint;
  /** Style-spec layout properties. */
  readonly layout?: LineLayout;
}

/** Props for a shared `circle` {@link Layer}. */
export interface CircleLayerProps extends SourcedLayerProps {
  /** Selects the circle layer type. */
  readonly type: "circle";
  /** Style-spec paint properties. */
  readonly paint?: CirclePaint;
  /** Style-spec layout properties. */
  readonly layout?: CircleLayout;
}

/** Props for a shared `symbol` {@link Layer}. */
export interface SymbolLayerProps extends SourcedLayerProps {
  /** Selects the symbol layer type. */
  readonly type: "symbol";
  /** Style-spec paint properties. */
  readonly paint?: SymbolPaint;
  /** Style-spec layout properties. */
  readonly layout?: SymbolLayout;
}

/** Props for a shared `raster` {@link Layer}. */
export interface RasterLayerProps extends SourcedLayerProps {
  /** Selects the raster layer type. */
  readonly type: "raster";
  /** Style-spec paint properties. */
  readonly paint?: RasterPaint;
  /** Style-spec layout properties. */
  readonly layout?: RasterLayout;
}

/** Props for a shared `heatmap` {@link Layer}. */
export interface HeatmapLayerProps extends SourcedLayerProps {
  /** Selects the heatmap layer type. */
  readonly type: "heatmap";
  /** Style-spec paint properties. */
  readonly paint?: HeatmapPaint;
  /** Style-spec layout properties. */
  readonly layout?: HeatmapLayout;
}

/** Props for a shared `fill-extrusion` {@link Layer}. */
export interface FillExtrusionLayerProps extends SourcedLayerProps {
  /** Selects the fill-extrusion layer type. */
  readonly type: "fill-extrusion";
  /** Style-spec paint properties. */
  readonly paint?: FillExtrusionPaint;
  /** Style-spec layout properties. */
  readonly layout?: FillExtrusionLayout;
}

/**
 * Props for the shared {@link Layer}, discriminated by `type`.
 *
 * Paint, layout, filter, zoom range, and `beforeId` may change between
 * renders. A removed paint or layout key resets to the style default. `id`,
 * `type`, `"source-layer"`, and an injected `source` or `sourceID` are
 * creation inputs: changing them throws and requires remounting the layer
 * with a new React `key`.
 */
export type LayerProps =
  | HillshadeLayerProps
  | BackgroundLayerProps
  | FillLayerProps
  | LineLayerProps
  | CircleLayerProps
  | SymbolLayerProps
  | RasterLayerProps
  | HeatmapLayerProps
  | FillExtrusionLayerProps;

/** Portable hillshade paint properties. */
export interface HillshadePaint {
  /** Illumination direction in degrees clockwise. */
  readonly "hillshade-illumination-direction"?: StyleValue<number>;
  /** Coordinate frame of the illumination. */
  readonly "hillshade-illumination-anchor"?: StyleValue<AlignmentMap>;
  /** Shading intensity from zero to one. */
  readonly "hillshade-exaggeration"?: StyleValue<number>;
  /** Color of shaded slopes. */
  readonly "hillshade-shadow-color"?: StyleValue<string>;
  /** Color of illuminated slopes. */
  readonly "hillshade-highlight-color"?: StyleValue<string>;
  /** Color of steep slope accents. */
  readonly "hillshade-accent-color"?: StyleValue<string>;
  /** Intensity transition. */
  readonly "hillshade-exaggeration-transition"?: import("./map-types.js").StyleTransition;
  /** Shadow transition. */
  readonly "hillshade-shadow-color-transition"?: import("./map-types.js").StyleTransition;
  /** Highlight transition. */
  readonly "hillshade-highlight-color-transition"?: import("./map-types.js").StyleTransition;
  /** Accent transition. */
  readonly "hillshade-accent-color-transition"?: import("./map-types.js").StyleTransition;
}

/** Portable hillshade layer drawing a raster DEM source. */
export interface HillshadeLayerProps extends SourcedLayerProps {
  /** Selects hillshade rendering. */
  readonly type: "hillshade";
  /** Hillshade paint. */
  readonly paint?: HillshadePaint;
  /** Layer visibility. */
  readonly layout?: BackgroundLayout;
}
