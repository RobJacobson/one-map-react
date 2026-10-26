import { forwardRef } from "react";

import { useFrozenValue } from "../adapters/shared/use-frozen-value.js";
import type {
  ControlProps,
  MarkerProps,
  MarkerRef,
} from "../contracts/ui-types.js";
import { useMapSession } from "./map-context.js";
import { useSelectedAdapter } from "./map-setup.js";
import { useStableOptions } from "./use-stable-options.js";

/** Renders live geographic children or an explicitly selected annotation. */
export const Marker = forwardRef<MarkerRef, MarkerProps>((props, ref) => {
  useMapSession();
  const { Marker: Implementation } = useSelectedAdapter();
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
  return <Implementation {...props} ref={ref} />;
});

/** Renders application host content at a map corner. */
export const Control = (props: ControlProps) => {
  useMapSession();
  const { Control: Implementation } = useSelectedAdapter();
  useStableOptions("Control", { position: props.position ?? "top-right" });
  return <Implementation {...props} />;
};
