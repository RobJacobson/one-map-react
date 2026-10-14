import type { GeolocationPosition } from "./ui-types.js";

/** Foreground permission outcome, independent of acquisition success. */
export interface LocationPermission {
  /** Unknown means the selected public API cannot establish authorization. */
  readonly status: "granted" | "denied" | "unknown";
  /** Authorization precision, never inferred from a fix's accuracy radius. */
  readonly accuracy: "precise" | "approximate" | "unknown";
  /** Android permanently denied result when available. */
  readonly blocked?: boolean;
}

/** Portable subset of AbortSignal used only for owned acquisition cleanup. */
export interface LocationAbortSignal {
  /** Whether cancellation has already been requested. */
  readonly aborted: boolean;
  /**
   * Registers cancellation without starting acquisition.
   * @param type - Cancellation event name.
   * @param listener - Callback released by the acquisition owner.
   */
  addEventListener(type: "abort", listener: () => void): void;
  /**
   * Removes an owned cancellation listener.
   * @param type - Cancellation event name.
   * @param listener - Previously registered callback.
   */
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Freshness and initial-acquisition deadline for explicit location requests. */
export interface LocationOptions {
  /** Finite nonnegative initial deadline in milliseconds; default 15000. */
  readonly timeoutMs?: number;
  /** Maximum accepted cache age in milliseconds; default zero. */
  readonly maximumAgeMs?: number;
  /** Cancels this acquisition/watch; MapSetup supplies one for owned requests. */
  readonly signal?: LocationAbortSignal;
}

/** Explicit foreground acquisition; creating a service never starts sensors. */
export interface LocationService {
  /**
   * Requests foreground permission. Unsupported permission APIs reject.
   * @returns Observed authorization, including unknown precision.
   */
  requestPermission(): Promise<LocationPermission>;
  /**
   * Acquires a position or rejects on failure, interruption, or timeout.
   * @param options - Freshness and deadline.
   * @returns A measured position with normalized units.
   */
  getCurrentPosition(options?: LocationOptions): Promise<GeolocationPosition>;
  /**
   * Starts explicit foreground updates; no update follows disposal.
   * @param onPosition - Measured fixes, including the initial fix.
   * @param onError - Observable failures; initial deadline failure ends the watch.
   * @param options - Freshness and initial deadline.
   * @returns Idempotent disposal, safe during asynchronous setup.
   */
  watchPosition(
    onPosition: (position: GeolocationPosition) => void,
    onError: (error: unknown) => void,
    options?: LocationOptions
  ): () => void;
}

/** Displays a supplied position without requesting location permission. */
export interface UserLocationProps {
  /** Application or service position; omission hides the display. */
  readonly position?: GeolocationPosition;
  /** Renderer-drawn uncertainty circle in meters; default false. */
  readonly showAccuracyCircle?: boolean;
  /** Invoked when the location geometry is pressed. */
  readonly onPress?: () => void;
}
