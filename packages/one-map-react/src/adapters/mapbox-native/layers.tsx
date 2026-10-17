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
import type { ComponentType } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";

/** Mapbox-native layer that dispatches to the matching RNMapbox layer. */
export const MapboxNativeLayer = (props: LayerProps) => {
  // Wrapper style unions are narrower than the preserved portable expressions.
  const NativeLayer = nativeLayers[props.type] as ComponentType<
    ReturnType<typeof rnmapboxLayerFields> & { style: Record<string, unknown> }
  >;
  return (
    <NativeLayer
      {...rnmapboxLayerFields(props)}
      style={toRnmapboxLayerStyle(props)}
    />
  );
};

const nativeLayers = {
  hillshade: HillshadeLayer,
  background: BackgroundLayer,
  fill: FillLayer,
  line: LineLayer,
  circle: CircleLayer,
  symbol: SymbolLayer,
  raster: RasterLayer,
  heatmap: HeatmapLayer,
  "fill-extrusion": FillExtrusionLayer,
} satisfies Record<LayerProps["type"], ComponentType<never>>;

/** Renames style fields while leaving values and validation to RNMapbox. */
const toRnmapboxLayerStyle = (props: LayerProps): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries({ ...props.paint, ...props.layout })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key.replace(/-([a-z])/g, (_match, letter: string) =>
          letter.toUpperCase()
        ),
        value,
      ])
  );

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
