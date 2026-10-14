import { forwardRef } from "react";

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
  useStableOptions("Marker", {
    id: props.id,
    anchor: props.anchor,
    renderMode: props.renderMode,
  });
  return <Implementation {...props} ref={ref} />;
});

/** Mount controls visibility; teardown does not request dismissal. */
export const Popup = (props: PopupProps) => {
  useMapSession();
  const { Popup: Implementation } = useSelectedAdapter();
  useStableOptions("Popup", {
    closeButton: props.closeButton,
    closeOnClick: props.closeOnClick,
    closeOnMove: props.closeOnMove,
    focusAfterOpen: props.focusAfterOpen,
  });
  return <Implementation {...props} />;
};

/** Renders application host content at a map corner. */
export const Control = (props: ControlProps) => {
  useMapSession();
  const { Control: Implementation } = useSelectedAdapter();
  useStableOptions("Control", { position: props.position });
  return <Implementation {...props} />;
};

/** Zoom and bearing controls targeting the enclosing map. */
export const NavigationControl = (props: NavigationControlProps) => {
  useMapSession();
  const { NavigationControl: Implementation } = useSelectedAdapter();
  useStableOptions("NavigationControl", {
    position: props.position,
    showZoom: props.showZoom,
    showCompass: props.showCompass,
    visualizePitch: props.visualizePitch,
  });
  return <Implementation {...props} />;
};

/** Delegates attribution to the selected renderer. */
export const AttributionControl = (props: AttributionControlProps) => {
  useMapSession();
  const { AttributionControl: Implementation } = useSelectedAdapter();
  useStableOptions("AttributionControl", {
    position: props.position,
    compact: props.compact,
    customAttribution: props.customAttribution,
  });
  return <Implementation {...props} />;
};

/** Displays projected ground distance in the requested units. */
export const ScaleControl = (props: ScaleControlProps) => {
  useMapSession();
  const { ScaleControl: Implementation } = useSelectedAdapter();
  useStableOptions("ScaleControl", {
    position: props.position,
    maxWidth: props.maxWidth,
  });
  return <Implementation {...props} />;
};

/** Acquires location and centers the enclosing map. */
export const GeolocateControl = (props: GeolocateControlProps) => {
  useMapSession();
  const { GeolocateControl: Implementation } = useSelectedAdapter();
  useStableOptions("GeolocateControl", {
    position: props.position,
  });
  return <Implementation {...props} />;
};

/** Delegates browser fullscreen behavior. */
export const FullscreenControl = (props: FullscreenControlProps) => {
  useMapSession();
  const { FullscreenControl: Implementation } = useSelectedAdapter();
  useStableOptions("FullscreenControl", { position: props.position });
  return <Implementation {...props} />;
};
