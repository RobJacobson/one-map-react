import {
  BackgroundLayer,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  HillshadeLayer,
  LineLayer,
  RasterLayer,
  SymbolLayer,
} from "@rnmapbox/maps";
import type { ComponentProps } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";

/** Mapbox-native layer that dispatches to the matching RNMapbox layer. */
export const MapboxNativeLayer = (props: LayerProps) => {
  switch (props.type) {
    case "hillshade":
      return (
        <HillshadeLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof HillshadeLayer>["style"]
          >(props)}
        />
      );
    case "background":
      return (
        <BackgroundLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof BackgroundLayer>["style"]
          >(props)}
        />
      );
    case "fill":
      return (
        <FillLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof FillLayer>["style"]
          >(props)}
        />
      );
    case "line":
      return (
        <LineLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof LineLayer>["style"]
          >(props)}
        />
      );
    case "circle":
      return (
        <CircleLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof CircleLayer>["style"]
          >(props)}
        />
      );
    case "symbol":
      return (
        <SymbolLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof SymbolLayer>["style"]
          >(props)}
        />
      );
    case "raster":
      return (
        <RasterLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof RasterLayer>["style"]
          >(props)}
        />
      );
    case "heatmap":
      return (
        <HeatmapLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof HeatmapLayer>["style"]
          >(props)}
        />
      );
    case "fill-extrusion":
      return (
        <FillExtrusionLayer
          {...rnmapboxLayerFields(props)}
          style={toRnmapboxLayerStyle<
            ComponentProps<typeof FillExtrusionLayer>["style"]
          >(props)}
        />
      );
  }
};

// Keep the existing portable field boundary; selected wrapper styles remain separate.
const styleKeys: Record<
  LayerProps["type"],
  { readonly paint: readonly string[]; readonly layout: readonly string[] }
> = {
  hillshade: {
    paint: [
      "hillshade-illumination-direction",
      "hillshade-illumination-anchor",
      "hillshade-exaggeration",
      "hillshade-shadow-color",
      "hillshade-highlight-color",
      "hillshade-accent-color",
      "hillshade-exaggeration-transition",
      "hillshade-shadow-color-transition",
      "hillshade-highlight-color-transition",
      "hillshade-accent-color-transition",
    ],
    layout: ["visibility"],
  },
  background: {
    paint: ["background-color", "background-opacity", "background-pattern"],
    layout: ["visibility"],
  },
  fill: {
    paint: [
      "fill-antialias",
      "fill-color",
      "fill-opacity",
      "fill-outline-color",
      "fill-pattern",
      "fill-translate",
      "fill-translate-anchor",
    ],
    layout: ["fill-sort-key", "visibility"],
  },
  line: {
    paint: [
      "line-blur",
      "line-color",
      "line-dasharray",
      "line-gap-width",
      "line-gradient",
      "line-offset",
      "line-opacity",
      "line-pattern",
      "line-translate",
      "line-translate-anchor",
      "line-width",
    ],
    layout: [
      "line-cap",
      "line-join",
      "line-miter-limit",
      "line-round-limit",
      "line-sort-key",
      "visibility",
    ],
  },
  circle: {
    paint: [
      "circle-blur",
      "circle-color",
      "circle-opacity",
      "circle-pitch-scale",
      "circle-pitch-alignment",
      "circle-radius",
      "circle-stroke-color",
      "circle-stroke-opacity",
      "circle-stroke-width",
      "circle-translate",
      "circle-translate-anchor",
    ],
    layout: ["circle-sort-key", "visibility"],
  },
  symbol: {
    paint: [
      "icon-color",
      "icon-halo-blur",
      "icon-halo-color",
      "icon-halo-width",
      "icon-opacity",
      "icon-translate",
      "icon-translate-anchor",
      "text-color",
      "text-halo-blur",
      "text-halo-color",
      "text-halo-width",
      "text-opacity",
      "text-translate",
      "text-translate-anchor",
    ],
    layout: [
      "symbol-placement",
      "symbol-spacing",
      "symbol-avoid-edges",
      "symbol-sort-key",
      "symbol-z-order",
      "icon-allow-overlap",
      "icon-ignore-placement",
      "icon-optional",
      "icon-rotation-alignment",
      "icon-size",
      "icon-text-fit",
      "icon-text-fit-padding",
      "icon-image",
      "icon-rotate",
      "icon-padding",
      "icon-keep-upright",
      "icon-offset",
      "icon-anchor",
      "icon-pitch-alignment",
      "text-pitch-alignment",
      "text-rotation-alignment",
      "text-field",
      "text-font",
      "text-size",
      "text-max-width",
      "text-line-height",
      "text-letter-spacing",
      "text-justify",
      "text-radial-offset",
      "text-variable-anchor",
      "text-anchor",
      "text-max-angle",
      "text-writing-mode",
      "text-rotate",
      "text-padding",
      "text-keep-upright",
      "text-transform",
      "text-offset",
      "text-allow-overlap",
      "text-ignore-placement",
      "text-optional",
      "visibility",
    ],
  },
  raster: {
    paint: [
      "raster-opacity",
      "raster-hue-rotate",
      "raster-brightness-min",
      "raster-brightness-max",
      "raster-saturation",
      "raster-contrast",
      "raster-resampling",
      "raster-fade-duration",
    ],
    layout: ["visibility"],
  },
  heatmap: {
    paint: [
      "heatmap-radius",
      "heatmap-weight",
      "heatmap-intensity",
      "heatmap-color",
      "heatmap-opacity",
    ],
    layout: ["visibility"],
  },
  "fill-extrusion": {
    paint: [
      "fill-extrusion-opacity",
      "fill-extrusion-color",
      "fill-extrusion-translate",
      "fill-extrusion-translate-anchor",
      "fill-extrusion-pattern",
      "fill-extrusion-height",
      "fill-extrusion-base",
      "fill-extrusion-vertical-gradient",
    ],
    layout: ["visibility"],
  },
};

/** Converts accepted style fields without copying or interpreting expression values. */
const toRnmapboxLayerStyle = <Style extends object>(
  props: LayerProps
): Style => {
  const style: Record<string, unknown> = {};
  for (const family of ["paint", "layout"] as const) {
    // Portable interfaces lack an index signature; only the accepted keys are read.
    const fields = props[family] as
      | Readonly<Record<string, unknown>>
      | undefined;
    for (const key of styleKeys[props.type][family]) {
      const value = fields?.[key];
      if (value !== undefined)
        style[
          key.replace(/-([a-z])/g, (_match, letter: string) =>
            letter.toUpperCase()
          )
        ] = value;
    }
  }
  // The wrapper's mutable expression unions are narrower; values remain renderer-validated.
  return style as Style;
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
