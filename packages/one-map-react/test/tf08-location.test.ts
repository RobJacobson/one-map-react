import { afterEach, describe, expect, jest, test } from "@jest/globals";

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
  const release = jest.fn();
  const permission = jest
    .fn<LocationUpdates["requestPermission"]>()
    .mockResolvedValue({ status: "granted", accuracy: "unknown" });
  let interrupt: () => void = () => {};
  const service = createLocationService({
    requestPermission: permission,
    subscribe: (position, _error, interrupted) => {
      listeners.add(position);
      interrupt = interrupted;
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
    emit: (position: GeolocationPosition) => {
      for (const listener of [...listeners]) listener(position);
    },
  };
};

afterEach(() => {
  jest.useRealTimers();
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
    jest.useFakeTimers().setSystemTime(10000);
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
    jest.useFakeTimers().setSystemTime(10000);
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition({ maximumAgeMs: 2000 });
    fixture.emit({ lngLat: [1, 2], timestamp: 9000 });
    await expect(result).resolves.toMatchObject({ timestamp: 9000 });
  });
  test("timeout rejects and cannot deliver a late fix", async () => {
    jest.useFakeTimers();
    const fixture = locationFixture();
    const result = fixture.service.getCurrentPosition({ timeoutMs: 20 });
    const failure = expect(result).rejects.toThrow("timed out");
    jest.advanceTimersByTime(20);
    await failure;
    expect(fixture.listeners.size).toBe(0);
  });
  test("individual watch disposal preserves another subscriber and suppresses retained callbacks", () => {
    jest.useFakeTimers();
    const fixture = locationFixture();
    const one = jest.fn();
    const two = jest.fn();
    const releaseOne = fixture.service.watchPosition(one, jest.fn());
    const stale = [...fixture.listeners][0];
    const releaseTwo = fixture.service.watchPosition(two, jest.fn());
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
    const release = jest.fn();
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
        fixture.service.watchPosition(jest.fn(), jest.fn(), { timeoutMs })
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
