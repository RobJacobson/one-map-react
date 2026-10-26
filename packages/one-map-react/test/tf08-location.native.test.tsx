import { afterEach, expect, jest, test } from "@jest/globals";
import { PermissionsAndroid, Platform } from "react-native";

import {
  acquireNativeLocation,
  requestNativeLocationPermission,
} from "../../../examples/shared/native-location.js";

const initialPlatform = Object.getOwnPropertyDescriptor(Platform, "OS");

afterEach(() => {
  if (initialPlatform) Object.defineProperty(Platform, "OS", initialPlatform);
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const fixture = () => {
  const listeners = new Set<(position: unknown) => void>();
  const manager = {
    addListener: jest.fn((listener: (position: unknown) => void) => {
      listeners.add(listener);
    }),
    removeListener: jest.fn((listener: (position: unknown) => void) => {
      listeners.delete(listener);
    }),
  };
  return { manager, listeners };
};
test("native one-shot requests isolate abort, retained callbacks and overlapping listeners", async () => {
  const selected = fixture();
  const controller = new AbortController();
  const first = acquireNativeLocation(
    selected.manager,
    "mapbox",
    controller.signal
  );
  const aborted = expect(first).rejects.toThrow("cancelled");
  const stale = [...selected.listeners][0];
  const second = acquireNativeLocation(selected.manager, "mapbox");
  controller.abort();
  await aborted;
  stale({ coords: { longitude: 9, latitude: 10 } });
  expect(selected.listeners.size).toBe(1);
  const remaining = [...selected.listeners][0];
  remaining({ coords: { longitude: 1, latitude: 2 } });
  await expect(second).resolves.toMatchObject({ lngLat: [1, 2] });
  expect(selected.manager.removeListener.mock.calls).toEqual([
    [stale],
    [remaining],
  ]);
});
test("RNMapbox iOS waits through heading-only events, rejects malformed fixes and times out", async () => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  jest.useFakeTimers();
  const selected = fixture();
  const request = acquireNativeLocation(
    selected.manager,
    "mapbox",
    undefined,
    20
  );
  const timed = expect(request).rejects.toThrow("timed out");
  const listener = [...selected.listeners][0];
  listener({ coords: { heading: 45 } });
  expect(selected.manager.removeListener).not.toHaveBeenCalled();
  jest.advanceTimersByTime(20);
  await timed;
  const malformed = acquireNativeLocation(selected.manager, "mapbox");
  const rejected = expect(malformed).rejects.toThrow("coordinates");
  [...selected.listeners][0]({ coords: { latitude: 91, longitude: 0 } });
  await rejected;
});
test("RNMapbox iOS unsupported permission request does not prevent acquisition", async () => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  await expect(requestNativeLocationPermission()).rejects.toThrow(
    "no public permission"
  );
  const selected = fixture();
  const request = acquireNativeLocation(selected.manager, "mapbox");
  [...selected.listeners][0]({ coords: { longitude: 1, latitude: 2 } });
  await expect(request).resolves.toMatchObject({ lngLat: [1, 2] });
  await expect(
    requestNativeLocationPermission(async () => true)
  ).resolves.toMatchObject({ status: "granted" });
});
test("Android permission preserves approximate and blocked outcomes", async () => {
  Object.defineProperty(Platform, "OS", {
    value: "android",
    configurable: true,
  });
  const permissions = PermissionsAndroid.PERMISSIONS;
  jest
    .spyOn(PermissionsAndroid, "requestMultiple")
    .mockResolvedValue(
      Object.fromEntries(
        Object.values(permissions).map((permission) => [
          permission,
          permission === permissions.ACCESS_COARSE_LOCATION
            ? "granted"
            : "denied",
        ])
      ) as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>
    );
  await expect(requestNativeLocationPermission()).resolves.toMatchObject({
    status: "granted",
    accuracy: "approximate",
    blocked: false,
  });
  jest
    .mocked(PermissionsAndroid.requestMultiple)
    .mockResolvedValue(
      Object.fromEntries(
        Object.values(permissions).map((permission) => [
          permission,
          "never_ask_again",
        ])
      ) as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>
    );
  await expect(requestNativeLocationPermission()).resolves.toMatchObject({
    status: "denied",
    accuracy: "unknown",
    blocked: true,
  });
});

test("native subscription setup failure removes its exact listener", async () => {
  const selected = fixture();
  selected.manager.addListener.mockImplementation((listener) => {
    selected.listeners.add(listener);
    throw new Error("setup");
  });
  await expect(
    acquireNativeLocation(selected.manager, "maplibre")
  ).rejects.toThrow("setup");
  expect(selected.listeners.size).toBe(0);
  expect(selected.manager.removeListener).toHaveBeenCalledWith(
    selected.manager.addListener.mock.calls[0][0]
  );
});
