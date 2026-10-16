import { expect, test, vi } from "vite-plus/test";

import { namedRendering as mapbox } from "../../../examples/web-mapbox/src/app.js";
import { namedRendering as maplibre } from "../../../examples/web-maplibre/src/app.js";
import type { MapRef } from "../src/contracts/camera-types.js";

test.each([mapbox, maplibre])(
  "selected release callback restores gestures and removes only its own listener",
  (named) => {
    let enabled = true;
    const listeners = new Set<() => void>();
    const unrelated = vi.fn();
    listeners.add(unrelated);
    const selected = {
      getGestureHandler: vi.fn(() => ({
        isEnabled: () => enabled,
        disable: () => {
          enabled = false;
        },
        enable: () => {
          enabled = true;
        },
      })),
      on: vi.fn((_type, listener: () => void) => listeners.add(listener)),
      off: vi.fn((_type, listener: () => void) => listeners.delete(listener)),
      fire: vi.fn(() => {
        for (const listener of listeners) listener();
      }),
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn(() => ({})),
      getCanvas: () => ({ tagName: "CANVAS" }),
      getStyle: () => ({ layers: [{ id: "known" }] }),
      setRain: vi.fn(),
      setSnow: vi.fn(),
      setScaleFactor: vi.fn(),
      getRain: () => ({}),
      getSnow: () => ({}),
      getScaleFactor: () => 1.2,
      setGlobalStateProperty: vi.fn(),
      setSky: vi.fn(),
      getGlobalState: () => ({ "rendering-fixture": 9009 }),
      getSky: () => ({}),
    };
    expect(named(selected as unknown as MapRef).tf10).toEqual({
      dragPan: { before: true, disabled: false, restored: true },
      source: true,
      layer: true,
      canvas: true,
      styleLayer: true,
      eventCalls: 1,
    });
    expect(selected.getGestureHandler).toHaveBeenCalledWith("dragPan");
    expect(selected.getSource).toHaveBeenCalledWith("point");
    expect(selected.getLayer).toHaveBeenCalledWith("known");
    expect(listeners).toEqual(new Set([unrelated]));
    expect(unrelated).toHaveBeenCalledTimes(2);
  }
);
