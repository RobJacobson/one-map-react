import { Layer as MaplibreLayer } from "@maplibre/maplibre-react-native";
import type { ComponentProps, ReactElement } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import { useLayerOptions } from "../../facade/layer.js";
import {
  omitUndefinedFields,
  toNativeLayerStyleKey,
  useNativeLayerKey,
} from "../shared/index.js";
import { assertMaplibreLayerStyle } from "./style-roots.js";

/** Style-spec and SDK-specific options for a MapLibre native Layer. */
export type NativeLayerProps =
  | LayerProps
  | ComponentProps<typeof MaplibreLayer>;

/**
 * Renders a MapLibre layer using both portable and wrapper style fields.
 *
 * @param props - Layer style, placement, and any source injected by its parent.
 * @returns The selected wrapper's layer.
 * @throws When a creation option changes or a layer field or expression is unsupported.
 */
export const MaplibreNativeLayer = (props: NativeLayerProps): ReactElement => {
  // Only RNMapbox consumes sourceID. The remaining portable style values
  // use MapLibre's style format, whose declarations require mutable arrays.
  const {
    sourceID,
    paint: paintProps,
    layout: layoutProps,
    ...wrapperProps
  } = props as NativeLayerProps & {
    readonly sourceID?: string;
  };
  const rawFilter = "filter" in props ? props.filter : undefined;
  const filter = omitUndefinedFields(rawFilter) as typeof rawFilter;
  const paint = nativeStyleFields(paintProps);
  const layout = nativeStyleFields(layoutProps);
  const legacyStyle =
    "style" in props ? nativeStyleFields(props.style) : undefined;
  // Both guards see this snapshot. A later getter read must not reach the wrapper.
  useLayerOptions({ ...props, layout }, "maplibre-native");
  assertMaplibreLayerStyle({ paint, layout, filter, style: legacyStyle });
  const source = "source" in props ? (props.source ?? sourceID) : sourceID;
  const key = useNativeLayerKey(
    {
      ...legacyStyle,
      ...maplibreStyleFields(layout),
      ...maplibreStyleFields(paint),
    },
    {
      ...wrapperProps,
      filter,
    }
  );
  const layer = {
    ...wrapperProps,
    source,
    filter,
    paint,
    layout,
    style: legacyStyle,
  };
  return (
    <MaplibreLayer
      key={key}
      {...(layer as ComponentProps<typeof MaplibreLayer>)}
    />
  );
};

// Match the pinned wrapper's mergeStyleProps for paint and layout keys.
const maplibreStyleFields = (style: Record<string, unknown> | undefined) =>
  Object.fromEntries(Object.entries(style ?? {}).map(toMaplibreStyleEntry));

const toMaplibreStyleEntry = ([key, value]: [string, unknown]) => [
  toNativeLayerStyleKey(key),
  value,
];

/**
 * Copies a style object with undefined fields removed at every depth.
 *
 * @param style - Paint, layout, or legacy style object from the caller.
 * @returns A converter-safe copy, or `undefined` when the caller omitted the object.
 */
const nativeStyleFields = (
  style?: object
): Record<string, unknown> | undefined => {
  if (!style) return undefined;
  return omitUndefinedFields(style) as Record<string, unknown>;
};
