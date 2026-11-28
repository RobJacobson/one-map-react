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
import { type ComponentType, type ReactElement, useState } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import { useLayerOptions } from "../../facade/layer.js";
import { omitUndefinedFields, toNativeLayerStyleKey } from "../shared/index.js";

/**
 * Renders a style-spec layer through RNMapbox.
 *
 * @param props - Layer type, style, and any source passed by its parent.
 * @returns The matching RNMapbox layer.
 * @throws When a creation option changes or a symbol layout key is unsupported.
 */
export const MapboxNativeLayer = (props: LayerProps): ReactElement => {
  const { paint, layout: rawLayout, ...layerProps } = props;
  // Keep explicit undefined keys until layout has overridden paint.
  const layout = { ...rawLayout };
  const style = toRnmapboxLayerStyle({ ...paint, ...layout });
  const rawFilter = "filter" in layerProps ? layerProps.filter : undefined;
  // The snapshot preserves the filter array and all of its positions.
  const filter = omitUndefinedFields(rawFilter) as typeof rawFilter;
  const layer = { ...layerProps, layout, filter };
  useLayerOptions(layer, "mapbox-native");

  // Wrapper style unions are narrower than the preserved portable expressions.
  const NativeLayer = nativeLayers[props.type] as ComponentType<
    ReturnType<typeof rnmapboxLayerFields> & { style: Record<string, unknown> }
  >;
  const key = useLayerPlacementKey(layer.beforeId);
  return (
    <NativeLayer key={key} {...rnmapboxLayerFields(layer)} style={style} />
  );
};

/** RNMapbox needs a fresh default insertion when an explicit anchor is removed. */
const useLayerPlacementKey = (beforeId: string | undefined): number => {
  const anchored = beforeId !== undefined;
  const [previous, setPrevious] = useState({ anchored, key: 0 });
  if (previous.anchored === anchored) return previous.key;
  const key = anchored ? previous.key : previous.key + 1;
  setPrevious({ anchored, key });
  return key;
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

/** Snapshots the merged style with the field names RNMapbox expects. */
const toRnmapboxLayerStyle = (style: object): Record<string, unknown> => {
  const entries: [string, unknown][] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue;
    entries.push([toNativeLayerStyleKey(key), omitUndefinedFields(value)]);
  }
  return Object.fromEntries(entries);
};

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
