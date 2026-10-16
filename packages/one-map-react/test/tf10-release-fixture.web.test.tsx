import { act, render } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import type { MoveEvent } from "../src/contracts/event-types.js";

const fixture = vi.hoisted(() => ({
  props: {} as { onMove?: (event: MoveEvent) => void; minZoom?: number },
  jumpTo: vi.fn(async () => undefined),
}));
vi.mock("one-map-react", async () => {
  const react = await import("react");
  return {
    Map: react.forwardRef(
      (
        props: {
          children?: import("react").ReactNode;
          onMove?: (event: MoveEvent) => void;
          minZoom?: number;
        },
        ref
      ) => {
        fixture.props = props;
        react.useImperativeHandle(ref, () => ({
          jumpTo: fixture.jumpTo,
          getCenter: async () => [0, 0],
          getZoom: async () => 2,
        }));
        return react.createElement("div", {}, props.children);
      }
    ),
    Source: ({ children }: { children?: import("react").ReactNode }) =>
      children,
    Layer: () => null,
  };
});
import {
  Tf09Scene,
  type Tf09Probe,
} from "../../../examples/shared/tf09-scene.js";

test("release camera probe arms rejection, accepts committed proposals, reports commands and releases control", async () => {
  let probe: Tf09Probe | null = null;
  const mounted = render(
    <Tf09Scene
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
  act(() => fixture.props.onMove?.(proposal));
  expect(await command("camera-read")).toMatchObject({
    moves: 1,
    viewState: proposal.viewState,
    origin: "user",
    controlled: { longitude: 0 },
  });
  await act(async () => {
    await command("controlled-camera", { accept: true });
  });
  act(() => fixture.props.onMove?.(proposal));
  expect(await command("camera-read")).toMatchObject({
    controlled: proposal.viewState,
  });
  await act(async () => {
    await command("controlled-camera", { clamp: true });
  });
  expect(fixture.props.minZoom).toBe(3);
  expect(await command("camera-read")).toMatchObject({
    clamp: true,
    controlled: { zoom: 2 },
  });
  await act(async () => {
    await command("controlled-camera");
  });
  expect(fixture.props.minZoom).toBeUndefined();
  expect(await command("camera-read")).toMatchObject({ clamp: false });
  await act(async () => {
    await command("controlled-camera", { clamp: true });
  });
  await command("camera-command");
  expect(fixture.jumpTo).toHaveBeenCalledWith({
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
  expect(fixture.props.minZoom).toBeUndefined();
  mounted.unmount();
  expect(probe).toBeNull();
});
