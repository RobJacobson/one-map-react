import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  AppState,
  type AppStateStatus,
  PermissionsAndroid,
  Platform,
} from "react-native";

import { createNativeLocation } from "../src/adapters/shared/native-location.js";

/** Native payload injection includes legitimate partial and malformed updates. */
type NativePayloadListener = (value: unknown) => void;

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("TF08 native public location boundaries", () => {
  test.each(["watch", "once"] as const)(
    "RNMapbox iOS %s waits through heading-only updates for a measured fix",
    async (mode) => {
      jest.useFakeTimers().setSystemTime(10000);
      const previousPlatform = Platform.OS;
      const previousState = AppState.currentState;
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        configurable: true,
      });
      Object.defineProperty(AppState, "currentState", {
        value: "active",
        configurable: true,
      });
      const manager = { addListener: jest.fn(), removeListener: jest.fn() };
      const service = createNativeLocation(() => manager, "mapbox");
      const position = jest.fn();
      const error = jest.fn();
      const acquired =
        mode === "once" ? service.getCurrentPosition() : undefined;
      const release =
        mode === "watch" ? service.watchPosition(position, error) : () => {};
      const emit = manager.addListener.mock
        .calls[0][0] as NativePayloadListener;

      try {
        emit({ coords: { heading: 45 }, timestamp: 10000 });
        expect(position).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(manager.removeListener).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(1);

        emit({
          coords: { longitude: 7, latitude: 8, heading: 45 },
          timestamp: 10000,
        });
        if (acquired) {
          await expect(acquired).resolves.toMatchObject({ lngLat: [7, 8] });
          expect(manager.removeListener).toHaveBeenCalledWith(emit);
        } else {
          expect(position).toHaveBeenCalledWith(
            expect.objectContaining({ lngLat: [7, 8] })
          );
        }
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        release();
        Object.defineProperty(Platform, "OS", {
          value: previousPlatform,
          configurable: true,
        });
        Object.defineProperty(AppState, "currentState", {
          value: previousState,
          configurable: true,
        });
      }
    }
  );

  test("RNMapbox iOS heading-only updates do not extend the initial deadline or mask malformed fixes", async () => {
    jest.useFakeTimers().setSystemTime(10000);
    const previousPlatform = Platform.OS;
    const previousState = AppState.currentState;
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });
    Object.defineProperty(AppState, "currentState", {
      value: "active",
      configurable: true,
    });
    const manager = { addListener: jest.fn(), removeListener: jest.fn() };
    const service = createNativeLocation(() => manager, "mapbox");

    try {
      const acquired = service.getCurrentPosition({ timeoutMs: 20 });
      const timedOut = expect(acquired).rejects.toThrow("timed out");
      const headingUpdate = manager.addListener.mock
        .calls[0][0] as NativePayloadListener;
      headingUpdate({
        coords: { heading: 45 },
        timestamp: 10000,
      });
      jest.advanceTimersByTime(20);
      await timedOut;

      const malformed = service.getCurrentPosition();
      const rejected = expect(malformed).rejects.toThrow("coordinate");
      const malformedUpdate = manager.addListener.mock
        .calls[1][0] as NativePayloadListener;
      malformedUpdate({
        coords: { longitude: 7, heading: 45 },
        timestamp: 10020,
      });
      await rejected;
      expect(manager.removeListener).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: previousPlatform,
        configurable: true,
      });
      Object.defineProperty(AppState, "currentState", {
        value: previousState,
        configurable: true,
      });
    }
  });

  test("Android coarse-only permission is usable approximate authorization", async () => {
    const previous = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    jest.spyOn(PermissionsAndroid, "requestMultiple").mockResolvedValue({
      ...(Object.fromEntries(
        Object.values(PermissionsAndroid.PERMISSIONS).map((permission) => [
          permission,
          "denied",
        ])
      ) as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>),
      "android.permission.ACCESS_FINE_LOCATION": "denied",
      "android.permission.ACCESS_COARSE_LOCATION": "granted",
    });
    const service = createNativeLocation(
      () => ({ addListener: () => {}, removeListener: () => {} }),
      "maplibre"
    );
    await expect(service.requestPermission()).resolves.toEqual({
      status: "granted",
      accuracy: "approximate",
      blocked: false,
    });
    Object.defineProperty(Platform, "OS", {
      value: previous,
      configurable: true,
    });
  });
  test("RNMapbox iOS permission request fails without starting sensors", async () => {
    const previous = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    const manager = { addListener: jest.fn(), removeListener: jest.fn() };
    const service = createNativeLocation(() => manager, "mapbox");
    await expect(service.requestPermission()).rejects.toThrow(
      "application permission integration"
    );
    expect(manager.addListener).not.toHaveBeenCalled();
    Object.defineProperty(Platform, "OS", {
      value: previous,
      configurable: true,
    });
  });
  test.each(["mapbox", "maplibre"] as const)(
    "%s foreground reattachment rejects stale cache and allows delayed fresh fixes",
    (backend) => {
      jest.useFakeTimers().setSystemTime(10000);
      const previousState = AppState.currentState;
      const previousPlatform = Platform.OS;
      Object.defineProperty(AppState, "currentState", {
        value: "active",
        configurable: true,
      });
      Object.defineProperty(Platform, "OS", {
        value: "android",
        configurable: true,
      });
      let change: (value: AppStateStatus) => void = () => {};
      const removeAppState = jest.fn();
      jest
        .spyOn(AppState, "addEventListener")
        .mockImplementation((_type, listener) => {
          change = listener;
          return { remove: removeAppState };
        });
      let timestamp = 10000;
      const payload = () => ({
        coords: { longitude: 7, latitude: 8 },
        timestamp,
      });
      const manager = {
        addListener: jest.fn((listener: NativePayloadListener) =>
          listener(payload())
        ),
        removeListener: jest.fn(),
      };
      const service = createNativeLocation(() => manager, backend);
      const position = jest.fn();
      const error = jest.fn();
      const release = service.watchPosition(position, error);
      const listener = manager.addListener.mock.calls[0][0];
      try {
        change("background");
        expect(manager.removeListener).toHaveBeenCalledWith(listener);
        jest.setSystemTime(60000);
        timestamp = 20000;
        change("active");
        expect(manager.addListener).toHaveBeenCalledTimes(2);
        expect(position).toHaveBeenCalledTimes(1);
        jest.setSystemTime(60006);
        timestamp = 60005;
        listener(payload());
        expect(position).toHaveBeenCalledTimes(2);
        expect(position).toHaveBeenLastCalledWith(
          expect.objectContaining({ timestamp: 60005 })
        );
        expect(error).not.toHaveBeenCalled();
      } finally {
        release();
        Object.defineProperty(AppState, "currentState", {
          value: previousState,
          configurable: true,
        });
        Object.defineProperty(Platform, "OS", {
          value: previousPlatform,
          configurable: true,
        });
      }
      expect(removeAppState).toHaveBeenCalledTimes(1);
      expect(manager.removeListener).toHaveBeenCalledTimes(2);
    }
  );
});
