import { expect, test } from "vite-plus/test";

import { validatePosition } from "../src/adapters/shared/location-values.js";

test("display validation preserves measured units and rejects invalid measurements", () => {
  const position = {
    lngLat: [1, 2] as const,
    timestamp: 1000,
    accuracy: 25,
    altitude: -20,
    altitudeAccuracy: 3,
    speed: 4,
    course: 45,
  };
  expect(validatePosition(position)).toEqual(position);
  expect(() => validatePosition({ lngLat: [0, 91] })).toThrow("latitude");
  for (const name of [
    "accuracy",
    "timestamp",
    "altitudeAccuracy",
    "speed",
  ] as const) {
    for (const value of [-1, Infinity, NaN])
      expect(() => validatePosition({ lngLat: [0, 0], [name]: value })).toThrow(
        name
      );
  }
  for (const name of ["altitude", "course"] as const)
    expect(() => validatePosition({ lngLat: [0, 0], [name]: NaN })).toThrow(
      name
    );
});

import { afterEach, vi } from "vite-plus/test";

import {
  acquireLocation,
  locationPosition,
} from "../../../examples/shared/location-acquisition.js";
afterEach(() => vi.useRealTimers());
test("one-shot synchronous success releases exactly once and ignores late failures", async () => {
  const release = vi.fn();
  const request = acquireLocation((success, failure) => {
    success({ lngLat: [1, 2] });
    void Promise.resolve().then(() => failure(new Error("late")));
    return release;
  });
  await expect(request).resolves.toMatchObject({ lngLat: [1, 2] });
  expect(release).toHaveBeenCalledTimes(1);
});
test("one-shot setup rejection and pre-abort acquire no leaked work", async () => {
  await expect(
    acquireLocation(() => {
      throw new Error("setup");
    })
  ).rejects.toThrow("setup");
  const subscribe = vi.fn();
  const controller = new AbortController();
  controller.abort();
  await expect(acquireLocation(subscribe, controller.signal)).rejects.toThrow(
    "cancelled"
  );
  expect(subscribe).not.toHaveBeenCalled();
});
test("deadline and abort retire only their own work, suppressing stale callbacks", async () => {
  vi.useFakeTimers();
  const release = vi.fn();
  let deliver = (_position: { lngLat: readonly [number, number] }) => {};
  const request = acquireLocation(
    (success) => {
      deliver = success;
      return release;
    },
    undefined,
    20
  );
  const rejected = expect(request).rejects.toThrow("timed out");
  vi.advanceTimersByTime(20);
  await rejected;
  deliver({ lngLat: [1, 2] });
  expect(release).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
test("conversion retains measured units, MapLibre iOS epoch seconds, and rejects invalid fixes", () => {
  const raw = {
    coords: {
      longitude: 1,
      latitude: 2,
      heading: 45,
      altitude: -20,
      speed: -1,
    },
    timestamp: 1000,
  };
  expect(locationPosition(raw, "maplibre", "ios")).toMatchObject({
    lngLat: [1, 2],
    timestamp: 1000000,
    course: 45,
    altitude: -20,
    speed: undefined,
  });
  expect(locationPosition(raw, "maplibre", "android").timestamp).toBe(1000);
  expect(locationPosition(raw, "mapbox", "ios").course).toBeUndefined();
  for (const invalid of [
    null,
    {},
    { coords: { longitude: NaN, latitude: 2 } },
    { coords: { longitude: 0, latitude: 91 } },
  ])
    expect(() => locationPosition(invalid, "browser")).toThrow();
});

test.each(["setup", "cleanup"])(
  "synchronous delivery exposes %s failure",
  async (failure) => {
    await expect(
      acquireLocation((success) => {
        success({ lngLat: [1, 2] });
        if (failure === "setup") throw new Error("setup");
        return () => {
          throw new Error("cleanup");
        };
      })
    ).rejects.toThrow(failure);
  }
);

test("converted timestamp overflow remains invalid", () => {
  expect(() =>
    locationPosition(
      { coords: { longitude: 1, latitude: 2 }, timestamp: Number.MAX_VALUE },
      "maplibre",
      "ios"
    )
  ).toThrow("timestamp");
});

test("first synchronous delivery wins over later fix and failure", async () => {
  await expect(
    acquireLocation((success, failure) => {
      success({ lngLat: [1, 2] });
      success({ lngLat: [3, 4] });
      failure(new Error("later"));
      return () => {};
    })
  ).resolves.toMatchObject({ lngLat: [1, 2] });
});
