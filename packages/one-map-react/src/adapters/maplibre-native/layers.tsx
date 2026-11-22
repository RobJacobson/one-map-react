import { Layer as MaplibreLayer } from "@maplibre/maplibre-react-native";
import type { ComponentProps, ReactElement } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import { useLayerOptions } from "../../facade/layer.js";
import {
  definedStyle,
  useNativeLayerKey,
} from "../shared/native-layer-updates.js";
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
  useLayerOptions(props, "maplibre-native");
  assertMaplibreLayerStyle(props);

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
  const filter = "filter" in props ? props.filter : undefined;
  const paint = definedStyle(paintProps);
  const layout = definedStyle(layoutProps);
  const legacyStyle = "style" in props ? definedStyle(props.style) : undefined;
  const source = "source" in props ? (props.source ?? sourceID) : sourceID;
  const key = useNativeLayerKey(
    { ...legacyStyle, ...layout, ...paint },
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
