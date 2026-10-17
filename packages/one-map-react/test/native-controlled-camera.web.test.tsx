import { act, renderHook } from "@testing-library/react";
import { StrictMode, useLayoutEffect, type ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { useNativeControlledCamera } from "../src/adapters/shared/use-native-controlled-camera.js";
import type { ViewState } from "../src/contracts/camera-types.js";
import type { MoveEvent } from "../src/contracts/event-types.js";

const target = { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 };
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const flush = async () => {
  const pending = [...frames.values()];
  frames.clear();
  await act(async () => {
    for (const callback of pending) callback(0);
  });
};
const event = (viewState: ViewState, isGesture = true): MoveEvent => ({
  viewState,
  origin: isGesture ? "user" : "unknown",
});

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => {
  frames.clear();
  vi.unstubAllGlobals();
});

test("rejected gestures restore the current committed target after callbacks; accepted proposals stay accepted", async () => {
  const jumpTo = vi.fn(async () => undefined);
  const onError = vi.fn();
  const mounted = renderHook(
    ({ viewState }: { viewState?: ViewState }) =>
      useNativeControlledCamera(viewState, jumpTo, () => true, onError),
    { initialProps: { viewState: target as ViewState | undefined } }
  );
  act(() => mounted.result.current.onMove(event({ ...target, longitude: 10 })));
  await flush();
  expect(jumpTo).toHaveBeenLastCalledWith({
    center: [0, 0],
    zoom: 1,
    bearing: 0,
    pitch: 0,
    duration: 0,
  });
  const accepted = { ...target, longitude: 20 };
  act(() => mounted.result.current.onMove(event(accepted)));
  mounted.rerender({ viewState: accepted });
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  act(() =>
    mounted.result.current.onMove(event({ ...accepted, longitude: 30 }))
  );
  mounted.rerender({ viewState: undefined });
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  mounted.unmount();
});

test("clamped command feedback cannot create a correction loop; each new gesture remains a proposal", async () => {
  const jumpTo = vi.fn(async () => undefined);
  const mounted = renderHook(() =>
    useNativeControlledCamera(target, jumpTo, () => true, vi.fn())
  );
  act(() =>
    mounted.result.current.onMove(event({ ...target, zoom: 2 }, false))
  );
  await flush();
  for (const zoom of [3, 4, 5]) {
    act(() => mounted.result.current.onMove(event({ ...target, zoom }, false)));
    await flush();
  }
  expect(jumpTo).toHaveBeenCalledTimes(1);
  act(() => {
    mounted.result.current.onMove(event({ ...target, zoom: 6 }, true));
    mounted.result.current.onMove(event({ ...target, zoom: 7 }, false));
  });
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(2);
  mounted.unmount();
});

test("a latched user proposal skips later origins until the scheduled frame consumes it", async () => {
  const jumpTo = vi.fn(async () => undefined);
  const mounted = renderHook(() =>
    useNativeControlledCamera(target, jumpTo, () => true, vi.fn())
  );
  const origin = vi.fn(() => "unknown");
  const feedback = Object.defineProperty(
    event({ ...target, zoom: 3 }, false),
    "origin",
    {
      get: origin,
    }
  );

  act(() => {
    mounted.result.current.onMove(event({ ...target, zoom: 2 }));
    mounted.result.current.onMove(feedback);
    mounted.result.current.onMove(feedback);
  });
  expect(origin).not.toHaveBeenCalled();
  expect(frames.size).toBe(1);
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);

  act(() => mounted.result.current.onMove(feedback));
  expect(origin).toHaveBeenCalledTimes(1);
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  act(() => mounted.result.current.onMove(event({ ...target, zoom: 4 })));
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(2);
});

test("wrapped coordinates and native precision are equivalent; late callbacks and errors are attachment-scoped", async () => {
  const failure = new Error("native camera failure");
  const jumpTo = vi.fn(async () => {
    throw failure;
  });
  const onError = vi.fn();
  let ready = false;
  const mounted = renderHook(() =>
    useNativeControlledCamera(target, jumpTo, () => ready, onError)
  );
  act(() =>
    mounted.result.current.onMove(
      event({ ...target, longitude: 360, bearing: -360, zoom: 1.00000001 })
    )
  );
  ready = true;
  act(() => mounted.result.current.onLoad());
  await flush();
  expect(jumpTo).not.toHaveBeenCalled();
  act(() => mounted.result.current.onMove(event({ ...target, latitude: 1 })));
  await flush();
  expect(onError).toHaveBeenCalledWith(failure);
  const retained = mounted.result.current;
  act(() => retained.onMove(event({ ...target, latitude: 2 })));
  mounted.unmount();
  await flush();
  act(() => retained.onMove(event({ ...target, latitude: 3 })));
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
});

test("Strict Mode effect replay can schedule again after cancelling the first attachment frame", async () => {
  const jumpTo = vi.fn(async () => undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>{children}</StrictMode>
  );
  const mounted = renderHook(
    () => {
      const controlled = useNativeControlledCamera(
        target,
        jumpTo,
        () => true,
        vi.fn()
      );
      const onMove = controlled.onMove;
      useLayoutEffect(
        () => onMove(event({ ...target, longitude: 1 })),
        [onMove]
      );
      return controlled;
    },
    { wrapper }
  );
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  mounted.unmount();
  expect(frames.size).toBe(0);
});

test("load readiness defers correction and a pending operational failure cannot reach an unmounted owner", async () => {
  let ready = false;
  let reject: (error: Error) => void = () => undefined;
  const jumpTo = vi.fn(
    () =>
      new Promise<void>((_resolve, rejectPromise) => {
        reject = rejectPromise;
      })
  );
  const onError = vi.fn();
  const mounted = renderHook(() =>
    useNativeControlledCamera(target, jumpTo, () => ready, onError)
  );
  act(() => mounted.result.current.onMove(event({ ...target, latitude: 2 })));
  await flush();
  expect(jumpTo).not.toHaveBeenCalled();
  ready = true;
  act(() => mounted.result.current.onLoad());
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  mounted.unmount();
  await act(async () => {
    reject(new Error("late camera failure"));
  });
  expect(onError).not.toHaveBeenCalled();
});

test("a synchronous correction failure releases dispatch ownership for the next public command", async () => {
  const failure = new Error("Synchronous camera failure");
  let notifyCommand = () => {};
  const jumpTo = vi
    .fn(async () => undefined)
    .mockImplementationOnce(() => {
      notifyCommand();
      throw failure;
    });
  const onError = vi.fn();
  const mounted = renderHook(() =>
    useNativeControlledCamera(target, jumpTo, () => true, onError)
  );
  notifyCommand = mounted.result.current.onCommand;
  act(() =>
    mounted.result.current.onMove(event({ ...target, zoom: 2 }, false))
  );
  await expect(flush()).rejects.toBe(failure);
  expect(onError).not.toHaveBeenCalled();

  act(() => {
    mounted.result.current.onCommand();
    mounted.result.current.onMove(event({ ...target, zoom: 2 }, false));
  });
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(2);
  mounted.unmount();
});

test("fresh public commands restore other axes after SDK clamping, including while a correction acknowledgment is pending", async () => {
  const acknowledgments: (() => void)[] = [];
  let notifyCommand: () => void = () => undefined;
  const jumpTo = vi.fn(() => {
    notifyCommand();
    return new Promise<void>((resolve) => acknowledgments.push(resolve));
  });
  const mounted = renderHook(() =>
    useNativeControlledCamera(target, jumpTo, () => true, vi.fn())
  );
  notifyCommand = mounted.result.current.onCommand;
  act(() =>
    mounted.result.current.onMove(event({ ...target, zoom: 2 }, false))
  );
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  act(() =>
    mounted.result.current.onMove(event({ ...target, zoom: 2 }, false))
  );
  await flush();
  expect(jumpTo).toHaveBeenCalledTimes(1);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    act(() => {
      mounted.result.current.onCommand();
      mounted.result.current.onMove(
        event({ ...target, latitude: 10, zoom: 2 }, false)
      );
    });
    await flush();
    expect(jumpTo).toHaveBeenLastCalledWith({
      center: [0, 0],
      zoom: 1,
      bearing: 0,
      pitch: 0,
      duration: 0,
    });
    expect(jumpTo).toHaveBeenCalledTimes(attempt + 2);
  }
  await act(async () => {
    for (const resolve of acknowledgments) resolve();
  });
  mounted.unmount();
});
