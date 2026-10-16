import { forwardRef } from "react";

import { useFrozenValue } from "../adapters/shared/use-frozen-value.js";
import type {
  AttributionControlProps,
  ControlProps,
  FullscreenControlProps,
  GeolocateControlProps,
  MarkerProps,
  MarkerRef,
  NavigationControlProps,
  PopupProps,
  ScaleControlProps,
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

/** Mount controls visibility; teardown does not request dismissal. */
export const Popup = (props: PopupProps) => {
  useMapSession();
  const { Popup: Implementation, backend } = useSelectedAdapter();
  useStableOptions("Popup", {
    closeButton: props.closeButton ?? true,
    closeOnClick: props.closeOnClick ?? true,
    closeOnMove: props.closeOnMove ?? false,
    focusAfterOpen: backend.endsWith("native")
      ? props.focusAfterOpen
      : (props.focusAfterOpen ?? true),
  });
  return <Implementation {...props} />;
};

/** Renders application host content at a map corner. */
export const Control = (props: ControlProps) => {
  useMapSession();
  const { Control: Implementation } = useSelectedAdapter();
  useStableOptions("Control", { position: props.position ?? "top-right" });
  return <Implementation {...props} />;
};

/** Zoom and bearing controls targeting the enclosing map. */
export const NavigationControl = (props: NavigationControlProps) => {
  useMapSession();
  const { NavigationControl: Implementation } = useSelectedAdapter();
  useStableOptions("NavigationControl", {
    position: props.position ?? "top-right",
    showZoom: props.showZoom ?? true,
    showCompass: props.showCompass ?? true,
    visualizePitch: props.visualizePitch ?? false,
  });
  return <Implementation {...props} />;
};

/** Delegates attribution to the selected renderer. */
export const AttributionControl = (props: AttributionControlProps) => {
  useMapSession();
  const { AttributionControl: Implementation, backend } = useSelectedAdapter();
  const native = backend.endsWith("native");
  useStableOptions("AttributionControl", {
    position: props.position ?? (native ? "bottom-right" : "top-right"),
    compact: native ? (props.compact ?? true) : props.compact,
    customAttribution: props.customAttribution,
  });
  return <Implementation {...props} />;
};

/** Displays projected ground distance in the requested units. */
export const ScaleControl = (props: ScaleControlProps) => {
  useMapSession();
  const { ScaleControl: Implementation, backend } = useSelectedAdapter();
  useStableOptions("ScaleControl", {
    position:
      props.position ??
      (backend.endsWith("native") ? "bottom-left" : "top-right"),
    maxWidth: props.maxWidth ?? 100,
  });
  return <Implementation {...props} />;
};

/** Acquires location and centers the enclosing map. */
export const GeolocateControl = (props: GeolocateControlProps) => {
  useMapSession();
  const { GeolocateControl: Implementation } = useSelectedAdapter();
  useStableOptions("GeolocateControl", {
    position: props.position ?? "top-right",
  });
  return <Implementation {...props} />;
};

/** Delegates browser fullscreen behavior. */
export const FullscreenControl = (props: FullscreenControlProps) => {
  useMapSession();
  const { FullscreenControl: Implementation } = useSelectedAdapter();
  useStableOptions("FullscreenControl", {
    position: props.position ?? "top-right",
  });
  return <Implementation {...props} />;
};
