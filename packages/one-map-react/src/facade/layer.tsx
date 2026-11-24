import type { NativeBackend } from "../contracts/backend.js";
import { useStableOptions } from "./use-stable-options.js";

/**
 * Enforces stable creation inputs and layout support for a native wrapper.
 *
 * @param props - Layer props from this render.
 * @param backend - Backend drawing the layer.
 * @throws When a creation option changes or a layout field is unsupported.
 */
export const useLayerOptions = (
  props: LayerOptions,
  backend: NativeBackend
): void => {
  useStableOptions(
    `Layer "${props.id ?? props.type}"`,
    layerCreationOptions(props)
  );

  if (props.type !== "symbol" || props.layout === undefined) {
    return;
  }
  const { layout } = props;

  for (const key of WRAPPER_UNSUPPORTED_SYMBOL_LAYOUT[backend]) {
    if (key in layout && Reflect.get(layout, key) !== undefined) {
      throw new Error(
        `${key} is not available on ${backend}. The pinned native wrapper ` +
          "style map has no entry for it."
      );
    }
  }
};

interface LayerOptions {
  readonly id?: string;
  readonly type: string;
  readonly source?: string;
  readonly sourceID?: string;
  readonly "source-layer"?: string;
  readonly layout?: object;
}

const layerCreationOptions = (
  props: LayerOptions
): Record<string, unknown> => ({
  id: props.id,
  type: props.type,
  ...("source-layer" in props ? { "source-layer": props["source-layer"] } : {}),
  ...(props.source === undefined ? {} : { source: props.source }),
  ...(props.sourceID === undefined ? {} : { sourceID: props.sourceID }),
});

// The pinned wrapper style maps lack these keys. The MapLibre SDK style
// validator owns overlap checks for both JSX layers and style documents.
const WRAPPER_UNSUPPORTED_SYMBOL_LAYOUT = {
  "mapbox-native": [
    "icon-overlap",
    "text-overlap",
    "text-variable-anchor-offset",
  ],
  "maplibre-native": ["text-variable-anchor-offset"],
} as const satisfies Record<NativeBackend, readonly string[]>;
