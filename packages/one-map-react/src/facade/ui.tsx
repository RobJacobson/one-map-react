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

/** Renders live geographic children or an explicitly selected annotation. */
export const Marker = forwardRef<MarkerRef, MarkerProps>((props, ref) => {
  useMapSession();
  const { Marker: Implementation } = useSelectedAdapter();
  return <Implementation {...props} ref={ref} />;
});

/** Mount controls visibility; teardown does not request dismissal. */
export const Popup = (props: PopupProps) => {
  useMapSession();
  const { Popup: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};

/** Renders application host content at a map corner. */
export const Control = (props: ControlProps) => {
  useMapSession();
  const { Control: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};

/** Zoom and bearing controls targeting the enclosing map. */
export const NavigationControl = (props: NavigationControlProps) => {
  useMapSession();
  const { NavigationControl: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};

/** Delegates attribution to the selected renderer. */
export const AttributionControl = (props: AttributionControlProps) => {
  useMapSession();
  const { AttributionControl: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};

/** Displays projected ground distance in the requested units. */
export const ScaleControl = (props: ScaleControlProps) => {
  useMapSession();
  const { ScaleControl: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};

/** Acquires location and centers the enclosing map. */
export const GeolocateControl = (props: GeolocateControlProps) => {
  useMapSession();
  const { GeolocateControl: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};

/** Delegates browser fullscreen behavior. */
export const FullscreenControl = (props: FullscreenControlProps) => {
  useMapSession();
  const { FullscreenControl: Implementation } = useSelectedAdapter();
  return <Implementation {...props} />;
};
