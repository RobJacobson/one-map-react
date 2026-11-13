import { act, renderHook } from "@testing-library/react";
import type { MapRef } from "one-map-react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { useLifecycleSmoke } from "../src/scenarios/lifecycle-smoke.js";

const north = {
  viewState: {
    longitude: -122.32,
    latitude: 47.64,
    zoom: 11,
    bearing: 0,
    pitch: 0,
  },
  origin: "programmatic" as const,
};
const initialCenter = [-122.34, 47.61] as const;
const failureStyleUrl = "http://fixture/missing.json";
const createMap = (center: readonly [number, number] = [0, 0]) => ({
  getCenter: vi.fn(async () => center),
  flyTo: vi.fn(async () => undefined),
});

const startRemount = () => {
  const first = createMap();
  // The hook only exercises these public camera methods on the test map.
  const mapRef = { current: first as unknown as MapRef | null };
  const mounted = renderHook(() =>
    useLifecycleSmoke({ mapRef, failureStyleUrl })
  );
  act(() => mounted.result.current.onLoad());
  act(() => mounted.result.current.onMove(north));
  const replacement = createMap();
  mapRef.current = replacement as unknown as MapRef;
  act(() => mounted.result.current.onLoad());
  return { ...mounted, mapRef, first, replacement };
};
const tick = async (milliseconds = 100) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("transient movement cannot replace the style before the remounted map reports Seattle", async () => {
  const fixture = startRemount();
  act(() =>
    fixture.result.current.onMove({
      ...north,
      viewState: { ...north.viewState, longitude: 0, latitude: 0 },
    })
  );
  await tick();
  expect(fixture.result.current.mapStyle).toBeUndefined();
  fixture.replacement.getCenter.mockResolvedValue([-122.32, 47.64]);
  await tick();
  expect(fixture.result.current.mapStyle).toBeUndefined();
  fixture.replacement.getCenter.mockResolvedValue(initialCenter);
  await tick();
  expect(fixture.result.current.mapStyle).toBe(failureStyleUrl);
  expect(fixture.result.current.status).toContain("remount=-122.34,47.61");
  expect(fixture.replacement.flyTo).not.toHaveBeenCalled();
  const calls = fixture.replacement.getCenter.mock.calls.length;
  await tick(500);
  expect(fixture.replacement.getCenter).toHaveBeenCalledTimes(calls);
  fixture.unmount();
});

test("a late camera result from a replaced ref cannot complete remount", async () => {
  const fixture = startRemount();
  let resolve: (center: readonly [number, number]) => void = () => {};
  fixture.replacement.getCenter.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await tick();
  const latest = createMap();
  fixture.mapRef.current = latest as unknown as MapRef;
  await act(async () => {
    resolve(initialCenter);
  });
  expect(fixture.result.current.mapStyle).toBeUndefined();
  await tick();
  expect(latest.getCenter).toHaveBeenCalled();
  expect(fixture.result.current.mapStyle).toBeUndefined();
  latest.getCenter.mockResolvedValue(initialCenter);
  await tick();
  expect(fixture.result.current.mapStyle).toBe(failureStyleUrl);
  fixture.unmount();
});

test("remount times out without starting the deliberate bad style and stops camera reads", async () => {
  const fixture = startRemount();
  await tick(30000);
  expect(fixture.result.current.mapStyle).toBeUndefined();
  expect(fixture.result.current.status).toContain("error=remount-timeout");
  expect(fixture.result.current.status).toContain("phase=done");
  const calls = fixture.replacement.getCenter.mock.calls.length;
  await tick(1000);
  expect(fixture.replacement.getCenter).toHaveBeenCalledTimes(calls);
  fixture.unmount();
});

test("unmount ignores an outstanding camera result and schedules no more reads", async () => {
  const fixture = startRemount();
  let resolve: (center: readonly [number, number]) => void = () => {};
  fixture.replacement.getCenter.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await tick();
  const before = fixture.result.current;
  fixture.unmount();
  await act(async () => {
    resolve(initialCenter);
  });
  await tick(30000);
  expect(fixture.replacement.getCenter).toHaveBeenCalledTimes(1);
  expect(before.mapStyle).toBeUndefined();
});

test("a pending camera read remains bounded and cannot complete after timeout", async () => {
  const fixture = startRemount();
  let resolve: (center: readonly [number, number]) => void = () => {};
  fixture.replacement.getCenter.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await tick(30000);
  expect(fixture.result.current.status).toContain("error=remount-timeout");
  await act(async () => {
    resolve(initialCenter);
  });
  await tick(1000);
  expect(fixture.result.current.mapStyle).toBeUndefined();
  expect(fixture.replacement.getCenter).toHaveBeenCalledTimes(1);
  fixture.unmount();
});
