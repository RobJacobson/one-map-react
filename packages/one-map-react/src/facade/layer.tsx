import type { NativeBackend } from "../contracts/backend.js";
import { useStableOptions } from "./use-stable-options.js";

/**
 * Enforces stable creation inputs and native layout support for a portable layer.
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
  rejectNativeUnsupportedLayout(props, backend);
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
export const rejectNativeUnsupportedLayout = (
  props: { readonly type: string; readonly layout?: object },
  backend: NativeBackend
): void => {
  if (props.type !== "symbol" || props.layout === undefined) {
    return;
  }

  const layout = props.layout;

  for (const key of NATIVE_UNSUPPORTED_SYMBOL_LAYOUT) {
    if (key in layout && Reflect.get(layout, key) !== undefined) {
      throw new Error(
        `${key} is not available on ${backend}. The pinned native wrapper ` +
          "style map has no entry for it."
      );
    }
  }
};
