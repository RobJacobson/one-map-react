import { useFrozenValue } from "../adapters/shared/use-frozen-value.js";
import type { NativeBackend } from "../contracts/backend.js";
import type { Anchor, MarkerProps } from "../contracts/ui-types.js";
import { useMapSession } from "./map-context.js";
import { useStableOptions } from "./use-stable-options.js";

/**
 * Checks the enclosing map, preserves marker creation inputs, and returns the
 * resolved anchor.
 *
 * @param props - Marker props from this render.
 * @param backend - Renderer bound by the marker’s native entry.
 * @returns The stable resolved anchor for this marker.
 * @throws Outside a map, on a backend mismatch, or when a creation input changes.
 */
export const useMarkerOptions = (
  props: MarkerProps,
  backend: NativeBackend
): Anchor => {
  const session = useMapSession();
  if (session.components.backend !== backend) {
    throw new Error(`This Marker must render inside a ${backend} Map.`);
  }
  const defaultAnchor = useFrozenValue(
    props.children === undefined || props.children === null
      ? "bottom"
      : "center"
  );
  const anchor = props.anchor ?? defaultAnchor;
  useStableOptions("Marker", {
    id: props.id,
    anchor,
    renderMode: props.renderMode ?? "view",
  });
  return anchor;
};
