import { useLayoutEffect, useState } from "react";

import type { MapRef } from "../../contracts/camera-types.js";
import type { CaptureOptions } from "../../contracts/capture-types.js";
import {
  imageDeadline,
  normalizeImage,
  validateCapture,
} from "./image-output.js";

/** Map-local readiness and pending capture owner, disposed at logical unmount. */
export class MapCaptureGate {
  private active = false;
  private enabled = false;
  private rendered = false;
  private width = 0;
  private height = 0;
  private generation = 0;
  private listeners = new Set<() => void>();
  private failures = new Set<(error: unknown) => void>();

  /** Activates a logical attachment; never inherits an old rendered frame. */
  activate(enabled: boolean): void {
    this.active = true;
    this.enabled = enabled;
    this.generation += 1;
  }
  /** Rejects pending captures and prevents late results affecting replacements. */
  dispose(): void {
    this.active = false;
    this.rendered = false;
    this.generation += 1;
    this.notify();
  }
  /** Records a wrapper-confirmed rendered frame. */
  frame(): void {
    this.rendered = true;
    this.notify();
  }
  /** Records measured viewport dimensions. */
  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.notify();
  }

  /** Rejects current captures when the selected wrapper reports an error. */
  fail(error: unknown): void {
    for (const reject of this.failures)
      reject(error ?? new Error("Map rendering failed during capture."));
  }

  /** Runs the selected wrapper snapshot under one attachment/deadline. */
  async run(
    options: CaptureOptions,
    snapshot: () => Promise<unknown>
  ): ReturnType<MapRef["capture"]> {
    validateCapture(options);
    if (!this.active || !this.enabled)
      throw new Error("Capture requires an attached Map with captureEnabled.");
    const generation = this.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wake: (() => void) | undefined;
    let fail: ((error: unknown) => void) | undefined;
    const invalid = (): boolean =>
      !this.active || this.generation !== generation;
    const detached = new Error("Map detached during capture.");
    const lifetime = new Promise<never>((_resolve, reject) => {
      fail = reject;
      this.failures.add(reject);
      wake = () => {
        if (invalid()) reject(detached);
      };
      this.listeners.add(wake);
      timer = setTimeout(
        () => reject(new Error("Map capture timed out.")),
        imageDeadline(options.timeoutMs)
      );
    });
    let ready: (() => void) | undefined;
    try {
      await Promise.race([
        lifetime,
        new Promise<void>((resolve) => {
          ready = () => {
            if (this.rendered && this.width > 0 && this.height > 0) resolve();
          };
          this.listeners.add(ready);
          ready();
        }),
      ]);
      if (invalid()) throw detached;
      const result = await Promise.race([snapshot(), lifetime]);
      if (invalid()) throw detached;
      return {
        ...normalizeImage(result, options.output),
        scope: options.scope,
      };
    } finally {
      clearTimeout(timer);
      if (wake) this.listeners.delete(wake);
      if (ready) this.listeners.delete(ready);
      if (fail) this.failures.delete(fail);
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Adds only capture-owned readiness and teardown to a wrapper map. */
export const useMapCapture = (enabled = false): MapCaptureGate => {
  const [gate] = useState(() => new MapCaptureGate());
  useLayoutEffect(() => {
    gate.activate(enabled);
    return () => gate.dispose();
  }, [gate, enabled]);
  return gate;
};
