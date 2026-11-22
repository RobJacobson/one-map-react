import { forwardRef } from "react";

import { useFrozenValue } from "../adapters/shared/use-frozen-value.js";
import type { Backend } from "../contracts/adapter.js";
import type { MarkerProps, MarkerRef } from "../contracts/ui-types.js";
import { useMapSession } from "./map-context.js";
import { useSelectedAdapter } from "./map-setup.js";
import { useStableOptions } from "./use-stable-options.js";

/** Renders live geographic children or an explicitly selected annotation. */
export const Marker = forwardRef<MarkerRef, MarkerProps>((props, ref) => {
  useMarkerOptions(props);
  const { Marker: Implementation } = useSelectedAdapter();
  return <Implementation {...props} ref={ref} />;
});

/**
 * Checks the enclosing map and preserves marker creation inputs.
 *
 * @param props - Marker props from this render.
 * @param backend - Concrete marker backend, when bound by a native entry.
 * @throws Outside a map, on a backend mismatch, or when a creation input changes.
 */
export const useMarkerOptions = (
  props: MarkerProps,
  backend?: Backend
): void => {
  const session = useMapSession();
  if (backend && session.adapter?.backend !== backend) {
    throw new Error(`This Marker must render inside a ${backend} Map.`);
  }
  const defaultAnchor = useFrozenValue(
    props.children === undefined || props.children === null
      ? "bottom"
      : "center"
  );
  useStableOptions("Marker", {
    id: props.id,
    anchor: props.anchor ?? defaultAnchor,
    renderMode: props.renderMode ?? "view",
  });
};
