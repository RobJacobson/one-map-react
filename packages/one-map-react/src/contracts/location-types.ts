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
   *
   * @param type - Cancellation event name.
   * @param listener - Callback released by the acquisition owner.
   */
  addEventListener(type: "abort", listener: () => void): void;
  /**
   * Removes an owned cancellation listener.
   *
   * @param type - Cancellation event name.
   * @param listener - Previously registered callback.
   */
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Freshness and initial-acquisition deadline for explicit location requests. */
export interface LocationOptions {
  /** Finite nonnegative initial deadline in milliseconds; default 15000. */
  readonly timeoutMs?: number;
  /** Maximum cache age at acquisition or foreground reattachment, in milliseconds; default zero. */
  readonly maximumAgeMs?: number;
  /** Cancels this acquisition/watch; MapSetup supplies one for owned requests. */
  readonly signal?: LocationAbortSignal;
}

/** Explicit foreground acquisition; creating a service never starts sensors. */
export interface LocationService {
  /**
   * Requests foreground permission. Unsupported permission APIs reject.
   *
   * @returns Observed authorization, including unknown precision.
   * @throws When permission acquisition is unavailable or the provider fails.
   * RNMapbox iOS requires an application locationProvider for this operation.
   */
  requestPermission(): Promise<LocationPermission>;
  /**
   * Acquires a position or rejects on failure, interruption, or timeout.
   *
   * @param options - Freshness and deadline.
   * @returns A measured position with normalized units.
   * @throws When timing options are invalid, acquisition is unavailable,
   * permission or provider acquisition fails, a position is malformed, the
   * initial deadline expires, acquisition is interrupted or cancelled, or
   * the owning MapSetup detaches before resolution.
   */
  getCurrentPosition(options?: LocationOptions): Promise<GeolocationPosition>;
  /**
   * Starts explicit foreground updates; no update follows disposal.
   *
   * @remarks
   * Acquisition, malformed-position, initial-timeout, and cancellation failures
   * reach onError and end the built-in watch. Backgrounding releases the native
   * subscription; foreground reattachment resumes acquisition. Disposing the
   * owning MapSetup releases its watches without reporting a new position.
   *
   * @param onPosition - Measured fixes, including the initial fix.
   * @param onError - Observable failures; initial deadline failure ends the watch.
   * @param options - Freshness and initial deadline.
   * @returns Idempotent disposal, safe during asynchronous setup.
   * @throws When timing options are invalid or an application locationProvider
   * throws during setup. Built-in subscription failures use onError.
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
