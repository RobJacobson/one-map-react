import { afterEach, describe, expect, vi, test } from "vite-plus/test";

import {
  createLocationService,
  type LocationUpdates,
} from "../src/adapters/shared/create-location-service.js";
import {
  positionFromWrapper,
  validatePosition,
} from "../src/adapters/shared/location-values.js";
import type { GeolocationPosition } from "../src/contracts/ui-types.js";

const locationFixture = () => {
  const listeners = new Set<(position: GeolocationPosition) => void>();
  const release = vi.fn();
  const permission = vi
    .fn<LocationUpdates["requestPermission"]>()
    .mockResolvedValue({ status: "granted", accuracy: "unknown" });
  let interrupt: () => void = () => {};
  let acquire: () => void = () => {};
  const service = createLocationService({
    requestPermission: permission,
    subscribe: (position, _error, interrupted, acquiring) => {
      listeners.add(position);
      interrupt = interrupted;
      acquire = acquiring;
      return () => {
        listeners.delete(position);
        release();
      };
    },
  });
  return {
    service,
    listeners,
    release,
    permission,
    interrupt: () => interrupt(),
    acquire: () => acquire(),
    emit: (position: GeolocationPosition) => {
      // eslint-disable-next-line unicorn/no-useless-spread -- Snapshot subscriptions before callbacks can add or remove listeners during delivery.
      for (const listener of [...listeners]) listener(position);
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("TF08 foreground location", () => {
  test("constructing a service acquires nothing and requests permission separately", async () => {
    const fixture = locationFixture();
    expect(fixture.listeners.size).toBe(0);
    expect(fixture.permission).not.toHaveBeenCalled();
    expect(await fixture.service.requestPermission()).toEqual({
      status: "granted",
      accuracy: "unknown",
    });
    expect(fixture.listeners.size).toBe(0);
  });
  test("fresh acquisition ignores old and timestamp-less cache and releases its listener", async () => {
    vi.useFakeTimers().setSystemTime(10000);
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition();
    fixture.emit({ lngLat: [1, 2], timestamp: 9000 });
    fixture.emit({ lngLat: [1, 2] });
    expect(fixture.listeners.size).toBe(1);
    fixture.emit({ lngLat: [3, 4], timestamp: 10000 });
    await expect(result).resolves.toMatchObject({ lngLat: [3, 4] });
    expect(fixture.listeners.size).toBe(0);
    expect(fixture.release).toHaveBeenCalledTimes(1);
  });
  test("allows explicitly bounded cache age", async () => {
    vi.useFakeTimers().setSystemTime(10000);
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition({ maximumAgeMs: 2000 });
    fixture.emit({ lngLat: [1, 2], timestamp: 9000 });
    await expect(result).resolves.toMatchObject({ timestamp: 9000 });
  });
  test.each([0, 2000])(
    "a resumed watch checks cached fixes against its %i ms cache limit",
    (maximumAgeMs) => {
      vi.useFakeTimers().setSystemTime(10000);
      const fixture = locationFixture();
      const position = vi.fn();
      const error = vi.fn();
      const dispose = fixture.service.watchPosition(position, error, {
        maximumAgeMs,
      });
      fixture.emit({ lngLat: [1, 2], timestamp: 10000 });
      vi.setSystemTime(60000);
      fixture.acquire();
      fixture.emit({ lngLat: [3, 4], timestamp: 20000 });
      fixture.emit({ lngLat: [3, 4], timestamp: 60000 - maximumAgeMs - 1 });
      vi.setSystemTime(60010);
      fixture.emit({ lngLat: [5, 6], timestamp: 60000 - maximumAgeMs });
      expect(position.mock.calls.map(([value]) => value.lngLat)).toEqual([
        [1, 2],
        [5, 6],
      ]);
      expect(error).not.toHaveBeenCalled();
      dispose();
    }
  );
  test("a fresh one-shot measurement allows asynchronous delivery", async () => {
    vi.useFakeTimers().setSystemTime(10000);
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition();
    vi.setSystemTime(10006);
    fixture.emit({ lngLat: [3, 4], timestamp: 10005 });
    expect(fixture.listeners.size).toBe(0);
    await expect(result).resolves.toMatchObject({ timestamp: 10005 });
    expect(vi.getTimerCount()).toBe(0);
  });
  test("an uninterrupted watch allows delivery delay without accepting fixes predating acquisition", () => {
    vi.useFakeTimers().setSystemTime(10000);
    const fixture = locationFixture();
    const position = vi.fn();
    const error = vi.fn();
    const dispose = fixture.service.watchPosition(position, error);
    vi.setSystemTime(10006);
    fixture.emit({ lngLat: [1, 2], timestamp: 9999 });
    fixture.emit({ lngLat: [3, 4], timestamp: 10005 });
    vi.setSystemTime(60006);
    fixture.emit({ lngLat: [5, 6], timestamp: 60005 });
    expect(position.mock.calls.map(([value]) => value.timestamp)).toEqual([
      10005, 60005,
    ]);
    expect(error).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    dispose();
  });
  test("timeout rejects and cannot deliver a late fix", async () => {
    vi.useFakeTimers();
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition({ timeoutMs: 20 });
    const failure = expect(result).rejects.toThrow("timed out");
    vi.advanceTimersByTime(20);
    await failure;
    expect(fixture.listeners.size).toBe(0);
  });
  test("individual watch disposal preserves another subscriber and suppresses retained callbacks", () => {
    vi.useFakeTimers();
    const fixture = locationFixture();
    const one = vi.fn();
    const two = vi.fn();
    const releaseOne = fixture.service.watchPosition(one, vi.fn());
    const stale = [...fixture.listeners][0];
    const releaseTwo = fixture.service.watchPosition(two, vi.fn());
    releaseOne();
    releaseOne();
    stale({ lngLat: [1, 2], timestamp: Date.now() });
    fixture.emit({ lngLat: [3, 4], timestamp: Date.now() });
    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalledTimes(1);
    expect(fixture.release).toHaveBeenCalledTimes(1);
    releaseTwo();
  });
  test("abort retires only the requested acquisition", async () => {
    const fixture = locationFixture();
    const controller = new AbortController();
    const result = fixture.service.getCurrentPosition({
      signal: controller.signal,
    });
    const failure = expect(result).rejects.toThrow("cancelled");
    controller.abort();
    await failure;
    expect(fixture.listeners.size).toBe(0);
  });
  test("a synchronous cache callback cannot leak a one-shot subscription", async () => {
    const release = vi.fn();
    const service = createLocationService({
      requestPermission: async () => ({
        status: "unknown",
        accuracy: "unknown",
      }),
      subscribe: (position) => {
        position({ lngLat: [1, 2], timestamp: Date.now() });
        return release;
      },
    });
    await expect(service.getCurrentPosition()).resolves.toMatchObject({
      lngLat: [1, 2],
    });
    expect(release).toHaveBeenCalledTimes(1);
  });
  test("foreground interruption rejects a pending one-shot request", async () => {
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition();
    const failure = expect(result).rejects.toThrow("interrupted");
    fixture.interrupt();
    await failure;
    expect(fixture.release).toHaveBeenCalledTimes(1);
  });
  test.each([-1, Infinity, NaN])(
    "rejects invalid timing %s before subscribing",
    (timeoutMs) => {
      const fixture = locationFixture();
      expect(() =>
        fixture.service.watchPosition(vi.fn(), vi.fn(), { timeoutMs })
      ).toThrow("timing");
      expect(fixture.listeners.size).toBe(0);
    }
  );
  test("normalizes MapLibre iOS seconds and course without inventing device heading", () => {
    const raw = {
      coords: {
        longitude: 1,
        latitude: 2,
        heading: 45,
        speed: -1,
        altitude: -20,
        altitudeAccuracy: null,
      },
      timestamp: 1000,
    };
    expect(positionFromWrapper(raw, "maplibre", "ios")).toMatchObject({
      timestamp: 1000000,
      course: 45,
      altitude: -20,
      speed: undefined,
    });
    expect(positionFromWrapper(raw, "maplibre", "android").timestamp).toBe(
      1000
    );
    expect(
      positionFromWrapper(raw, "mapbox", "android").course
    ).toBeUndefined();
  });
  test.each([null, undefined, {}, { coords: { longitude: NaN, latitude: 2 } }])(
    "rejects missing/invalid native position %#",
    (position) => {
      expect(() => positionFromWrapper(position, "maplibre")).toThrow();
    }
  );
  test("validates latitude and measured uncertainty", () => {
    expect(() => validatePosition({ lngLat: [0, 91] })).toThrow("latitude");
    expect(() => validatePosition({ lngLat: [0, 0], accuracy: -1 })).toThrow(
      "accuracy"
    );
  });
});
