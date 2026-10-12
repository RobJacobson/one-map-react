import {
  BackgroundLayer,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  LineLayer,
  RasterLayer,
  SymbolLayer,
} from "@rnmapbox/maps";
import type { ComponentProps } from "react";

import type {
  BackgroundLayerProps,
  CircleLayerProps,
  FillExtrusionLayerProps,
  FillLayerProps,
  HeatmapLayerProps,
  LayerProps,
  LineLayerProps,
  RasterLayerProps,
  SymbolLayerProps,
} from "../../contracts/layer-types.js";

/** Mapbox-native layer that dispatches to the matching RNMapbox layer. */
export const MapboxNativeLayer = (props: LayerProps) => {
  switch (props.type) {
    case "background":
      return <BackgroundLayer {...toRnmapboxBackgroundLayer(props)} />;
    case "fill":
      return <FillLayer {...toRnmapboxFillLayer(props)} />;
    case "line":
      return <LineLayer {...toRnmapboxLineLayer(props)} />;
    case "circle":
      return <CircleLayer {...toRnmapboxCircleLayer(props)} />;
    case "symbol":
      return <SymbolLayer {...toRnmapboxSymbolLayer(props)} />;
    case "raster":
      return <RasterLayer {...toRnmapboxRasterLayer(props)} />;
    case "heatmap":
      return <HeatmapLayer {...toRnmapboxHeatmapLayer(props)} />;
    case "fill-extrusion":
      return <FillExtrusionLayer {...toRnmapboxFillExtrusionLayer(props)} />;
  }
};

/**
 * Drops unset style fields and crosses into a wrapper layer style type.
 *
 * Values are portable style-spec constants and expressions. The wrapper's
 * `Value` unions carry narrower expression tuples than the facade's
 * `readonly unknown[]`, so the copy into the wrapper type is unchecked here
 * and each renderer validates the values it receives. Unset fields are
 * omitted so the wrapper only sees keys the application provided.
 *
 * @param fields - CamelCase style fields from the portable paint and layout.
 * @returns The set fields as the target layer's style object.
 */
const definedFields = <Style extends object>(
  fields: Readonly<Record<string, unknown>>
): Style => {
  const style: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      style[key] = value;
    }
  }

  return style as unknown as Style;
};

/** Portable layer fields every RNMapbox layer converter reads. */
interface PortableLayerFields {
  readonly id: string;
  readonly sourceID?: string;
  readonly beforeId?: string;
  readonly minzoom?: number;
  readonly maxzoom?: number;
  readonly filter?: readonly unknown[];
  readonly "source-layer"?: string;
}

/**
 * Copies the wrapper-level fields every RNMapbox layer component shares.
 *
 * @param props - Portable layer props from the current render.
 * @returns id, injected source id, zoom range, insertion point, filter, and
 * source-layer in RNMapbox field names.
 */
const rnmapboxLayerFields = (props: PortableLayerFields) => ({
  id: props.id,
  sourceID: props.sourceID,
  minZoomLevel: props.minzoom,
  maxZoomLevel: props.maxzoom,
  belowLayerID: props.beforeId,
  filter: props.filter,
  sourceLayerID: props["source-layer"],
});

/**
 * Converts common background layer props into `BackgroundLayer` props.
 *
 * @param props - Common background layer props.
 * @returns Wrapper-level fields plus a camelCase background style.
 */
const toRnmapboxBackgroundLayer = (
  props: BackgroundLayerProps
): ComponentProps<typeof BackgroundLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof BackgroundLayer>["style"]>({
    backgroundColor: props.paint?.["background-color"],
    backgroundOpacity: props.paint?.["background-opacity"],
    backgroundPattern: props.paint?.["background-pattern"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common fill layer props into `FillLayer` props.
 *
 * @param props - Common fill layer props.
 * @returns Wrapper-level fields plus a camelCase fill style.
 */
const toRnmapboxFillLayer = (
  props: FillLayerProps
): ComponentProps<typeof FillLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof FillLayer>["style"]>({
    fillAntialias: props.paint?.["fill-antialias"],
    fillColor: props.paint?.["fill-color"],
    fillOpacity: props.paint?.["fill-opacity"],
    fillOutlineColor: props.paint?.["fill-outline-color"],
    fillPattern: props.paint?.["fill-pattern"],
    fillTranslate: props.paint?.["fill-translate"],
    fillTranslateAnchor: props.paint?.["fill-translate-anchor"],
    fillSortKey: props.layout?.["fill-sort-key"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common line layer props into `LineLayer` props.
 *
 * @param props - Common line layer props.
 * @returns Wrapper-level fields plus a camelCase line style.
 */
const toRnmapboxLineLayer = (
  props: LineLayerProps
): ComponentProps<typeof LineLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof LineLayer>["style"]>({
    lineBlur: props.paint?.["line-blur"],
    lineColor: props.paint?.["line-color"],
    lineDasharray: props.paint?.["line-dasharray"],
    lineGapWidth: props.paint?.["line-gap-width"],
    lineGradient: props.paint?.["line-gradient"],
    lineOffset: props.paint?.["line-offset"],
    lineOpacity: props.paint?.["line-opacity"],
    linePattern: props.paint?.["line-pattern"],
    lineTranslate: props.paint?.["line-translate"],
    lineTranslateAnchor: props.paint?.["line-translate-anchor"],
    lineWidth: props.paint?.["line-width"],
    lineCap: props.layout?.["line-cap"],
    lineJoin: props.layout?.["line-join"],
    lineMiterLimit: props.layout?.["line-miter-limit"],
    lineRoundLimit: props.layout?.["line-round-limit"],
    lineSortKey: props.layout?.["line-sort-key"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common circle layer props into `CircleLayer` props.
 *
 * @param props - Common circle layer props.
 * @returns Wrapper-level fields plus a camelCase circle style.
 */
const toRnmapboxCircleLayer = (
  props: CircleLayerProps
): ComponentProps<typeof CircleLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof CircleLayer>["style"]>({
    circleBlur: props.paint?.["circle-blur"],
    circleColor: props.paint?.["circle-color"],
    circleOpacity: props.paint?.["circle-opacity"],
    circlePitchScale: props.paint?.["circle-pitch-scale"],
    circlePitchAlignment: props.paint?.["circle-pitch-alignment"],
    circleRadius: props.paint?.["circle-radius"],
    circleStrokeColor: props.paint?.["circle-stroke-color"],
    circleStrokeOpacity: props.paint?.["circle-stroke-opacity"],
    circleStrokeWidth: props.paint?.["circle-stroke-width"],
    circleTranslate: props.paint?.["circle-translate"],
    circleTranslateAnchor: props.paint?.["circle-translate-anchor"],
    circleSortKey: props.layout?.["circle-sort-key"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common symbol layer props into `SymbolLayer` props.
 *
 * The gated `icon-overlap`, `text-overlap`, and
 * `text-variable-anchor-offset` layout keys are rejected by the shared
 * `Layer` before this converter runs; they have no camelCase entry here.
 *
 * @param props - Common symbol layer props.
 * @returns Wrapper-level fields plus a camelCase symbol style.
 */
const toRnmapboxSymbolLayer = (
  props: SymbolLayerProps
): ComponentProps<typeof SymbolLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof SymbolLayer>["style"]>({
    iconColor: props.paint?.["icon-color"],
    iconHaloBlur: props.paint?.["icon-halo-blur"],
    iconHaloColor: props.paint?.["icon-halo-color"],
    iconHaloWidth: props.paint?.["icon-halo-width"],
    iconOpacity: props.paint?.["icon-opacity"],
    iconTranslate: props.paint?.["icon-translate"],
    iconTranslateAnchor: props.paint?.["icon-translate-anchor"],
    textColor: props.paint?.["text-color"],
    textHaloBlur: props.paint?.["text-halo-blur"],
    textHaloColor: props.paint?.["text-halo-color"],
    textHaloWidth: props.paint?.["text-halo-width"],
    textOpacity: props.paint?.["text-opacity"],
    textTranslate: props.paint?.["text-translate"],
    textTranslateAnchor: props.paint?.["text-translate-anchor"],
    symbolPlacement: props.layout?.["symbol-placement"],
    symbolSpacing: props.layout?.["symbol-spacing"],
    symbolAvoidEdges: props.layout?.["symbol-avoid-edges"],
    symbolSortKey: props.layout?.["symbol-sort-key"],
    symbolZOrder: props.layout?.["symbol-z-order"],
    iconAllowOverlap: props.layout?.["icon-allow-overlap"],
    iconIgnorePlacement: props.layout?.["icon-ignore-placement"],
    iconOptional: props.layout?.["icon-optional"],
    iconRotationAlignment: props.layout?.["icon-rotation-alignment"],
    iconSize: props.layout?.["icon-size"],
    iconTextFit: props.layout?.["icon-text-fit"],
    iconTextFitPadding: props.layout?.["icon-text-fit-padding"],
    iconImage: props.layout?.["icon-image"],
    iconRotate: props.layout?.["icon-rotate"],
    iconPadding: props.layout?.["icon-padding"],
    iconKeepUpright: props.layout?.["icon-keep-upright"],
    iconOffset: props.layout?.["icon-offset"],
    iconAnchor: props.layout?.["icon-anchor"],
    iconPitchAlignment: props.layout?.["icon-pitch-alignment"],
    textPitchAlignment: props.layout?.["text-pitch-alignment"],
    textRotationAlignment: props.layout?.["text-rotation-alignment"],
    textField: props.layout?.["text-field"],
    textFont: props.layout?.["text-font"],
    textSize: props.layout?.["text-size"],
    textMaxWidth: props.layout?.["text-max-width"],
    textLineHeight: props.layout?.["text-line-height"],
    textLetterSpacing: props.layout?.["text-letter-spacing"],
    textJustify: props.layout?.["text-justify"],
    textRadialOffset: props.layout?.["text-radial-offset"],
    textVariableAnchor: props.layout?.["text-variable-anchor"],
    textAnchor: props.layout?.["text-anchor"],
    textMaxAngle: props.layout?.["text-max-angle"],
    textWritingMode: props.layout?.["text-writing-mode"],
    textRotate: props.layout?.["text-rotate"],
    textPadding: props.layout?.["text-padding"],
    textKeepUpright: props.layout?.["text-keep-upright"],
    textTransform: props.layout?.["text-transform"],
    textOffset: props.layout?.["text-offset"],
    textAllowOverlap: props.layout?.["text-allow-overlap"],
    textIgnorePlacement: props.layout?.["text-ignore-placement"],
    textOptional: props.layout?.["text-optional"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common raster layer props into `RasterLayer` props.
 *
 * @param props - Common raster layer props.
 * @returns Wrapper-level fields plus a camelCase raster style.
 */
const toRnmapboxRasterLayer = (
  props: RasterLayerProps
): ComponentProps<typeof RasterLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof RasterLayer>["style"]>({
    rasterOpacity: props.paint?.["raster-opacity"],
    rasterHueRotate: props.paint?.["raster-hue-rotate"],
    rasterBrightnessMin: props.paint?.["raster-brightness-min"],
    rasterBrightnessMax: props.paint?.["raster-brightness-max"],
    rasterSaturation: props.paint?.["raster-saturation"],
    rasterContrast: props.paint?.["raster-contrast"],
    rasterResampling: props.paint?.["raster-resampling"],
    rasterFadeDuration: props.paint?.["raster-fade-duration"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common heatmap layer props into `HeatmapLayer` props.
 *
 * @param props - Common heatmap layer props.
 * @returns Wrapper-level fields plus a camelCase heatmap style.
 */
const toRnmapboxHeatmapLayer = (
  props: HeatmapLayerProps
): ComponentProps<typeof HeatmapLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof HeatmapLayer>["style"]>({
    heatmapRadius: props.paint?.["heatmap-radius"],
    heatmapWeight: props.paint?.["heatmap-weight"],
    heatmapIntensity: props.paint?.["heatmap-intensity"],
    heatmapColor: props.paint?.["heatmap-color"],
    heatmapOpacity: props.paint?.["heatmap-opacity"],
    visibility: props.layout?.visibility,
  }),
});

/**
 * Converts common fill-extrusion layer props into `FillExtrusionLayer`
 * props.
 *
 * @param props - Common fill-extrusion layer props.
 * @returns Wrapper-level fields plus a camelCase fill-extrusion style.
 */
const toRnmapboxFillExtrusionLayer = (
  props: FillExtrusionLayerProps
): ComponentProps<typeof FillExtrusionLayer> => ({
  ...rnmapboxLayerFields(props),
  style: definedFields<ComponentProps<typeof FillExtrusionLayer>["style"]>({
    fillExtrusionOpacity: props.paint?.["fill-extrusion-opacity"],
    fillExtrusionColor: props.paint?.["fill-extrusion-color"],
    fillExtrusionTranslate: props.paint?.["fill-extrusion-translate"],
    fillExtrusionTranslateAnchor:
      props.paint?.["fill-extrusion-translate-anchor"],
    fillExtrusionPattern: props.paint?.["fill-extrusion-pattern"],
    fillExtrusionHeight: props.paint?.["fill-extrusion-height"],
    fillExtrusionBase: props.paint?.["fill-extrusion-base"],
    fillExtrusionVerticalGradient:
      props.paint?.["fill-extrusion-vertical-gradient"],
    visibility: props.layout?.visibility,
  }),
});
