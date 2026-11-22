import { act, render, renderHook } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { expect, test, vi } from "vite-plus/test";

import { useCameraSmoke } from "../../example-map/src/scenarios/camera-smoke.js";
import {
  Tf09Scene,
  type Tf09Probe,
} from "../../example-map/src/scenarios/tf09-scene.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { NativeMapInputs } from "../src/contracts/native-types.js";
import { createNativeSceneFixture } from "./native-scene-fixture.js";

const recordProps = vi.fn<(props: NativeMapInputs) => void>();
const latestProps = () => recordProps.mock.lastCall?.[0];
const jumpTo = vi.fn(async () => undefined);
const Camera = forwardRef<MapRef, NativeMapInputs>((props, ref) => {
  recordProps(props);
  useImperativeHandle(
    ref,
    () =>
      ({
        jumpTo,
        getCenter: async () => [0, 0],
        getZoom: async () => 2,
      }) as unknown as MapRef
  );
  return <div>{props.children}</div>;
});
const components = createNativeSceneFixture(Camera);

test("release camera probe tracks targets, accepts movement, reports commands and releases targets", async () => {
  let probe: Tf09Probe | null = null;
  const mounted = render(
    <Tf09Scene
      components={components}
      backend="mapbox-native"
      style={{ width: 400, height: 300 }}
      attach={(value) => {
        probe = value;
      }}
    />
  );
  const command = async (action: string, value?: Record<string, unknown>) => {
    if (!probe) throw new Error("Probe is not attached.");
    return probe.command(action, value);
  };
  await act(async () => {
    await command("controlled-camera");
  });
  const proposal = {
    viewState: { longitude: 10, latitude: 10, zoom: 3, bearing: 0, pitch: 0 },
    origin: "user" as const,
  };
  act(() => latestProps()?.onMove?.(proposal));
  expect(await command("camera-read")).toMatchObject({
    moves: 1,
    viewState: proposal.viewState,
    origin: "user",
    controlled: { longitude: 0 },
  });
  await command("camera-command", { target: "reapply" });
  expect(jumpTo).toHaveBeenCalledWith({
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
  });
  await act(async () => {
    await command("controlled-camera", { target: "changed" });
  });
  expect(await command("camera-read")).toMatchObject({
    controlled: { longitude: 5, latitude: 5 },
  });
  await act(async () => {
    await command("controlled-camera", { accept: true });
  });
  act(() => latestProps()?.onMove?.(proposal));
  expect(await command("camera-read")).toMatchObject({
    controlled: proposal.viewState,
  });
  await act(async () => {
    await command("controlled-camera", { clamp: true });
  });
  expect(latestProps()?.minZoom).toBe(3);
  expect(await command("camera-read")).toMatchObject({
    clamp: true,
    controlled: { zoom: 2 },
  });
  await act(async () => {
    await command("controlled-camera");
  });
  expect(latestProps()?.minZoom).toBeUndefined();
  expect(await command("camera-read")).toMatchObject({ clamp: false });
  await act(async () => {
    await command("controlled-camera", { clamp: true });
  });
  await command("camera-command");
  expect(jumpTo).toHaveBeenCalledWith({
    center: [10, 10],
    zoom: 3,
    bearing: 0,
    pitch: 0,
  });
  await act(async () => {
    await command("controlled-camera", { enabled: false });
  });
  expect(await command("camera-read")).toMatchObject({
    controlled: undefined,
    clamp: false,
  });
  expect(latestProps()?.minZoom).toBeUndefined();
  mounted.unmount();
  expect(probe).toBeNull();
});

test.each(["web", "native"] as const)(
  "camera smoke observes %s command behavior without inferring movement from its target",
  async (platform) => {
    vi.useFakeTimers();
    let center: readonly [number, number] = [-122.32, 47.64];
    const jumpTo = vi.fn(async () => {
      if (platform === "native") center = [-120, 45];
    });
    const mapRef = {
      current: {
        fitBounds: vi.fn(async () => undefined),
        stop: vi.fn(async () => {
          if (platform === "native") throw new Error("unsupported");
        }),
        flyTo: vi.fn(async () => undefined),
        jumpTo,
        getCenter: vi.fn(async () => center),
      } as unknown as MapRef,
    };
    const hook = renderHook(() =>
      useCameraSmoke({ mapRef, platform, doubleTap: false })
    );
    try {
      act(() => hook.result.current.onLoad());
      const fitted = {
        longitude: -122.32,
        latitude: 47.64,
        zoom: 11,
        bearing: 0,
        pitch: 0,
      };
      act(() => hook.result.current.onMoveEnd({ viewState: fitted }));
      await act(async () =>
        hook.result.current.onClick({ lngLat: center } as never)
      );
      if (platform === "web")
        await act(async () => vi.advanceTimersByTimeAsync(9000));
      expect(hook.result.current.phase).toBe("await-hold");
      await act(async () => vi.advanceTimersByTimeAsync(2500));
      expect(jumpTo).toHaveBeenCalledWith({ center: [-120, 45] });
      expect(hook.result.current.status).toContain(
        platform === "native" ? "held=0 command=applied" : "held=1 command=skip"
      );
      expect(hook.result.current.phase).toBe("done");
    } finally {
      hook.unmount();
      vi.useRealTimers();
    }
  }
);
