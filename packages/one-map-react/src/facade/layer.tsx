import type { LayerProps } from "../contracts/layer-types.js";
import { useSelectedAdapter } from "./map-setup.js";
import { useStableOptions } from "./use-stable-options.js";

/**
 * Shared layer that renders the selected adapter's layer component.
 *
 * Remains the direct child of the wrapper source so injected `source` or
 * `sourceID` reaches the wrapper layer. Paint, layout, filter, zoom range,
 * and `beforeId` may change between renders; `id`, `type`,
 * `"source-layer"`, and an injected `source` or `sourceID` are creation
 * inputs.
 *
 * @param props - Layer type, id, style, and any parent-injected source id.
 */
export const Layer = (props: LayerProps) => {
  const { backend, Layer: AdapterLayer } = useSelectedAdapter();

  useStableOptions(`Layer "${props.id}"`, layerCreationOptions(props));
  rejectNativeUnsupportedLayout(props, backend);

  return <AdapterLayer {...props} />;
};

const layerCreationOptions = (props: LayerProps): Record<string, unknown> => ({
  id: props.id,
  type: props.type,
  ...("source-layer" in props ? { "source-layer": props["source-layer"] } : {}),
  ...(props.source === undefined ? {} : { source: props.source }),
  ...(props.sourceID === undefined ? {} : { sourceID: props.sourceID }),
});

// Both pinned native wrapper style maps predate these symbol layout keys.
// The pinned web SDKs support them, so they stay in the portable types and
// fail only on native adapters. Drop this gate when the pinned wrappers add
// the keys to their style maps.
const NATIVE_UNSUPPORTED_SYMBOL_LAYOUT = [
  "icon-overlap",
  "text-overlap",
  "text-variable-anchor-offset",
] as const;

/**
 * Rejects symbol layout keys the pinned native wrappers cannot honor.
 *
 * @param props - Layer props from the current render.
 * @param backend - Adapter the layer will render through.
 * @throws When a gated symbol layout key is set on a native backend.
 */
const rejectNativeUnsupportedLayout = (
  props: LayerProps,
  backend: string
): void => {
  if (backend !== "mapbox-native" && backend !== "maplibre-native") {
    return;
  }

  if (props.type !== "symbol" || props.layout === undefined) {
    return;
  }

  const layout = props.layout;

  for (const key of NATIVE_UNSUPPORTED_SYMBOL_LAYOUT) {
    if (layout[key] !== undefined) {
      throw new Error(
        `${key} is not available on ${backend}. The pinned native wrapper ` +
          "style map has no entry for it."
      );
    }
  }
};
