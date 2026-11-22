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
import type { ComponentType, ReactElement } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import { useLayerOptions } from "../../facade/layer.js";
import {
  definedStyle,
  useNativeLayerKey,
} from "../shared/native-layer-updates.js";

/**
 * Renders a style-spec layer through RNMapbox.
 *
 * @param props - Layer type, style, and any source passed by its parent.
 * @returns The matching RNMapbox layer.
 * @throws When a creation option changes or a symbol layout key is unsupported.
 */
export const MapboxNativeLayer = (props: LayerProps): ReactElement => {
  useLayerOptions(props, "mapbox-native");

  // Wrapper style unions are narrower than the preserved portable expressions.
  const NativeLayer = nativeLayers[props.type] as ComponentType<
    ReturnType<typeof rnmapboxLayerFields> & { style: Record<string, unknown> }
  >;
  const style = toRnmapboxLayerStyle(props);
  const key = useNativeLayerKey(style, {
    ...props,
    filter: "filter" in props ? props.filter : undefined,
  });
  return (
    <NativeLayer key={key} {...rnmapboxLayerFields(props)} style={style} />
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
    Object.entries(definedStyle({ ...props.paint, ...props.layout }) ?? {}).map(
      ([key, value]) => [
        key.replace(/-([a-z])/g, (_match, letter: string) =>
          letter.toUpperCase()
        ),
        value,
      ]
    )
  );

/** Portable layer fields every RNMapbox layer converter reads. */
interface PortableLayerFields {
  readonly id: string;
  readonly sourceID?: string;
  readonly source?: string;
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
  sourceID: props.sourceID ?? props.source,
  minZoomLevel: props.minzoom,
  maxZoomLevel: props.maxzoom,
  belowLayerID: props.beforeId,
  filter: props.filter,
  sourceLayerID: props["source-layer"],
});
