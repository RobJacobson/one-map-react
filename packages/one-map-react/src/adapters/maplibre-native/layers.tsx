import { Layer as MaplibreLayer } from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import { rejectNativeUnsupportedLayout } from "../../facade/layer.js";
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
 * @throws When a known layer field or expression is unsupported.
 */
export const MaplibreNativeLayer = (props: NativeLayerProps) => {
  assertMaplibreLayerStyle(props);
  rejectNativeUnsupportedLayout(props, "maplibre-native");

  // Only RNMapbox consumes sourceID. The remaining portable style values
  // use MapLibre's style format, whose declarations require mutable arrays.
  const { sourceID: _sourceID, ...wrapperProps } = props as NativeLayerProps & {
    readonly sourceID?: string;
  };
  const filter = "filter" in props ? props.filter : undefined;
  return (
    <MaplibreLayer
      {...({ ...wrapperProps, filter } as ComponentProps<typeof MaplibreLayer>)}
    />
  );
};
