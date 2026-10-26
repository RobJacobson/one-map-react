import type { GeolocationPosition } from "./ui-types.js";

/** Displays a supplied position without requesting location permission. */
export interface UserLocationProps {
  /** Application position; omission hides the display. */
  readonly position?: GeolocationPosition;
  /** Renderer-drawn uncertainty circle in meters; default false. */
  readonly showAccuracyCircle?: boolean;
  /** Invoked when the location geometry is pressed. */
  readonly onPress?: () => void;
}
