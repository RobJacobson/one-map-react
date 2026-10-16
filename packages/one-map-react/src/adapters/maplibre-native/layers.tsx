import { Layer as MaplibreLayer } from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import { assertMaplibreLayerStyle } from "./style-roots.js";

/** Maplibre-native layer that forwards portable fields to the wrapper layer. */
export const MaplibreNativeLayer = (props: LayerProps) => {
  assertMaplibreLayerStyle(props);

  const wrapperProps = {
    id: props.id,
    type: props.type,
    source: props.source,
    beforeId: props.beforeId,
    minzoom: props.minzoom,
    maxzoom: props.maxzoom,
    paint: props.paint,
    layout: props.layout,
    ...("source-layer" in props
      ? { "source-layer": props["source-layer"] }
      : {}),
    filter: "filter" in props ? props.filter : undefined,
  };

  // The wrapper accepts style-spec paint, layout, and filter values; the
  // facade's readonly contracts cross into its mutable spec types here.
  return (
    <MaplibreLayer
      {...(wrapperProps as ComponentProps<typeof MaplibreLayer>)}
    />
  );
};
