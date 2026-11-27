import { expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import {
  type ComponentType,
  createRef,
  type RefAttributes,
  useContext,
} from "react";
import { Text } from "react-native";

import {
  emptyStyle,
  initialViewState,
} from "../../example-map/src/scenarios/map-fixture.js";
import { NativeCameraContext } from "../src/adapters/shared/native-map-presentation.js";
import { NativeMarkerOverlay } from "../src/adapters/shared/native-marker-overlay.js";
import type { ViewState } from "../src/contracts/camera-types.js";
import type {
  NativeCameraTarget,
  NativeMapInputs,
  NativeMapRef,
} from "../src/contracts/native-types.js";

type CameraBounds = readonly [number, number, number, number];

type CameraEvents = {
  move(viewState: ViewState, isGesture: boolean, bounds?: CameraBounds): void;
  settle(viewState: ViewState, bounds?: CameraBounds): void;
};

type CameraFixture = {
  readonly captureEvents: () => CameraEvents;
  readonly jump: jest.Mock<() => unknown>;
  readonly centerProp: string;
  readonly zoomProp: string;
  readonly bearingProp: string;
  readonly initialProp: string;
  readonly getZoom: jest.Mock<() => Promise<number>>;
  readonly project: jest.Mock<() => Promise<number[]>>;
};

/**
 * Exercises public camera behavior against the selected SDK's event and bridge mocks.
 *
 * @param NativeMap - Map component from the selected public entry.
 * @param fixture - SDK-specific camera payloads, prop names, and bridge calls.
 */
export const testNativeCamera = <Handle extends NativeMapRef>(
  NativeMap: ComponentType<NativeMapInputs & RefAttributes<Handle>>,
  fixture: CameraFixture
): void => {
  const {
    captureEvents,
    jump,
    centerProp,
    zoomProp,
    bearingProp,
    initialProp,
    getZoom,
    project,
  } = fixture;

  test("the first target seeds camera defaults and observations once", async () => {
    const observe = jest.fn();
    const Probe = () => {
      observe(useContext(NativeCameraContext)?.viewState.zoom);
      return null;
    };
    const scene = (camera: Pick<NativeMapInputs, "zoom" | "viewState">) => (
      <NativeMap mapStyle={emptyStyle} {...camera}>
        <Probe />
      </NativeMap>
    );
    const mounted = await render(scene({ zoom: 3 }));
    const camera = () => mounted.getByTestId("wrapper-camera").props;
    expect(camera()[initialProp][zoomProp]).toBe(3);
    expect(camera()[zoomProp]).toBe(3);
    expect(observe).toHaveBeenLastCalledWith(3);

    await mounted.rerender(scene({ zoom: 4, viewState: { zoom: 5 } }));
    expect(camera()[initialProp][zoomProp]).toBe(3);
    expect(camera()[zoomProp]).toBe(5);
    expect(observe).toHaveBeenLastCalledWith(3);

    await mounted.rerender(scene({}));
    expect(camera()[initialProp][zoomProp]).toBe(3);
    expect(camera()[zoomProp]).toBeUndefined();
    expect(observe).toHaveBeenLastCalledWith(3);
    await mounted.unmount();
  });

  test.each([
    { axis: "longitude", firstCenter: [7, 6], movedCenter: [0, 20] },
    { axis: "latitude", firstCenter: [5, 7], movedCenter: [10, 0] },
  ] as const)(
    "applies a changed $axis target against the observed center",
    async ({ axis, firstCenter, movedCenter }) => {
      const scene = (
        target: Pick<
          NativeMapInputs,
          "viewState" | "longitude" | "latitude" | "zoom"
        > = {}
      ) => (
        <NativeMap
          mapStyle={emptyStyle}
          initialViewState={{ longitude: 5, latitude: 6 }}
          {...target}
        />
      );
      const mounted = await render(scene({ [axis]: 7 }));
      const camera = () => mounted.getByTestId("wrapper-camera").props;
      expect(camera()[centerProp]).toEqual(firstCenter);
      expect(camera()[initialProp][centerProp]).toEqual([5, 6]);

      const { move, settle } = captureEvents();
      const observed = { ...initialViewState, longitude: 10, latitude: 20 };
      await act(async () => move(observed, true));
      const target = { [axis]: 0 };
      await mounted.rerender(scene({ viewState: target }));
      expect(camera()[centerProp]).toEqual(movedCenter);
      expect(camera()[initialProp][centerProp]).toEqual([5, 6]);

      await act(async () =>
        settle({ ...observed, longitude: 30, latitude: 40 })
      );
      expect(camera()[centerProp]).toEqual(movedCenter);
      await mounted.rerender(scene({ viewState: { ...target } }));
      expect(camera()[centerProp]).toEqual(movedCenter);
      await mounted.rerender(scene(target));
      expect(camera()[centerProp]).toEqual(movedCenter);

      const latestCenter = axis === "longitude" ? [0, 40] : [30, 0];
      await mounted.rerender(scene({ viewState: { ...target, zoom: 8 } }));
      expect(camera()[centerProp]).toEqual(latestCenter);
      expect(camera()[zoomProp]).toBe(8);

      await mounted.rerender(scene({ zoom: 9 }));
      expect(camera()[centerProp]).toBeUndefined();
      expect(camera()[zoomProp]).toBe(9);
      await mounted.rerender(scene());
      expect(camera()[centerProp]).toBeUndefined();
      await mounted.rerender(scene({ viewState: target }));
      expect(camera()[centerProp]).toEqual(latestCenter);
      await mounted.unmount();
    }
  );

  test("a partial target waits for the center of the initial fit", async () => {
    const scene = (latitude: number) => (
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={{ bounds: [10, 20, 30, 40] }}
        viewState={{ latitude }}
      />
    );
    const mounted = await render(scene(0));
    const center = () =>
      mounted.getByTestId("wrapper-camera").props[centerProp];
    expect(center()).toBeUndefined();

    await mounted.rerender(scene(6));
    expect(center()).toBeUndefined();
    const { settle } = captureEvents();
    await act(async () => settle({ ...initialViewState, longitude: 23 }));
    expect(center()).toEqual([23, 6]);
    await act(async () => settle({ ...initialViewState, longitude: 24 }));
    expect(center()).toEqual([23, 6]);
    await mounted.unmount();
  });

  test.each([
    { initialViewState: { longitude: NaN }, axis: "longitude" },
    { viewState: { latitude: Infinity }, axis: "latitude" },
  ])("rejects a non-finite declarative $axis", async ({ axis, ...props }) => {
    await expect(
      render(<NativeMap mapStyle={emptyStyle} {...props} />)
    ).rejects.toThrow(`${axis} must be a finite number.`);
  });

  test("rejects a non-finite named coordinate on update", async () => {
    const mounted = await render(<NativeMap mapStyle={emptyStyle} />);
    await expect(
      mounted.rerender(<NativeMap mapStyle={emptyStyle} latitude={-Infinity} />)
    ).rejects.toThrow("latitude must be a finite number.");
  });

  test("native movement does not dispatch an unchanged target, including an equal new object", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const schedule = jest
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
      });
    const cancel = jest
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation((id) => {
        if (id != null) frames.delete(id);
      });
    const ref = createRef<Handle>();
    const target = { ...initialViewState, zoom: 12 };
    const scene = (viewState?: NativeCameraTarget) => (
      <NativeMap
        ref={ref}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        viewState={viewState}
      />
    );
    const flush = async () => {
      const callbacks = [...frames.values()];
      frames.clear();
      await act(async () => {
        for (const callback of callbacks) callback(0);
      });
    };
    const mounted = await render(scene(target));
    try {
      const map = ref.current;
      if (!map) throw new Error("Map ref did not attach.");
      const center = [target.longitude, target.latitude] as const;
      expect(mounted.getByTestId("wrapper-camera").props).toMatchObject({
        [centerProp]: center,
        [zoomProp]: target.zoom,
        [bearingProp]: target.bearing,
        pitch: target.pitch,
      });
      await act(async () =>
        mounted.getByTestId("wrapper-map").props.onDidFinishLoadingMap()
      );
      await flush();
      jump.mockClear();
      const { move } = captureEvents();
      const observed = {
        longitude: 10,
        latitude: 20,
        zoom: 4,
        bearing: 30,
        pitch: 10,
      };
      await act(async () => move(observed, true));
      await flush();
      expect(jump).not.toHaveBeenCalled();

      await mounted.rerender(scene({ ...target }));
      await flush();
      expect(jump).not.toHaveBeenCalled();
      await map.jumpTo({ center, zoom: target.zoom });
      expect(jump).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [centerProp]: center,
          [zoomProp]: target.zoom,
        })
      );
      expect(jump).toHaveBeenCalledTimes(1);

      await map.jumpTo({ center: [40, 50], zoom: 8 });
      await act(async () =>
        move({ ...observed, longitude: 40, latitude: 50, zoom: 8 }, true)
      );
      await flush();
      expect(jump).toHaveBeenCalledTimes(2);
      expect(jump).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [centerProp]: [40, 50],
          [zoomProp]: 8,
        })
      );

      await mounted.rerender(scene({ ...target, zoom: 13 }));
      expect(mounted.getByTestId("wrapper-camera").props[zoomProp]).toBe(13);
      await mounted.rerender(scene());
      expect(
        mounted.getByTestId("wrapper-camera").props[zoomProp]
      ).toBeUndefined();
      expect(jump).toHaveBeenCalledTimes(2);

      const failure = new Error("camera dispatch failed");
      jump.mockImplementationOnce(() => {
        throw failure;
      });
      await expect(map.jumpTo({ zoom: 8 })).rejects.toBe(failure);
      await mounted.unmount();
      await expect(map.jumpTo({ zoom: 8 })).rejects.toThrow(
        "Map camera is not attached."
      );

      const replacement = await render(scene(target));
      try {
        const dispatches = jump.mock.calls.length;
        await act(async () =>
          move({ ...observed, longitude: 70, latitude: 80, zoom: 9 }, true)
        );
        await flush();
        expect(jump).toHaveBeenCalledTimes(dispatches);
        await expect(map.jumpTo({ zoom: 8 })).rejects.toThrow(
          "Map camera is not attached."
        );
      } finally {
        await replacement.unmount();
      }
    } finally {
      await mounted.unmount();
      schedule.mockRestore();
      cancel.mockRestore();
    }
  });

  test.each([
    { viewState: initialViewState, name: "the initial pose" },
    {
      viewState: { ...initialViewState, bearing: 4, pitch: 1 },
      name: "nonzero orientation",
    },
  ])("onMove reports $name and stops after unmount", async ({ viewState }) => {
    const onMove = jest.fn();
    const view = await render(
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        onMove={onMove}
      />
    );
    const { move, settle } = captureEvents();
    await act(async () => move(viewState, true));
    const event = { viewState, origin: "user" };
    expect(onMove).toHaveBeenCalledWith(event);
    await act(async () =>
      settle({ ...initialViewState, longitude: -122.32, latitude: 47.64 })
    );
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenLastCalledWith(event);

    await view.unmount();
    const retired = {
      ...initialViewState,
      longitude: -122.3,
      latitude: 47.6,
      zoom: 12,
    };
    await act(async () => {
      move(retired, true);
      settle(retired);
    });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  test("getZoom forwards renderer values and errors independently of UI, and rejects after detach", async () => {
    const ref = createRef<Handle>();
    const view = await render(
      <NativeMap
        ref={ref}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
      />
    );
    const map = ref.current;
    if (!map) throw new Error("Map ref did not attach.");
    const calls = getZoom.mock.calls.length;
    getZoom.mockResolvedValueOnce(0).mockResolvedValueOnce(12.5);
    await expect(map.getZoom()).resolves.toBe(0);
    await expect(map.getZoom()).resolves.toBe(12.5);
    const failure = new Error("Renderer zoom failed");
    getZoom.mockRejectedValueOnce(failure);
    await expect(map.getZoom()).rejects.toBe(failure);
    getZoom.mockResolvedValueOnce(Number.NaN);
    await expect(map.getZoom()).rejects.toThrow();
    expect(getZoom.mock.calls.length).toBe(calls + 4);
    await view.unmount();
    await expect(map.getZoom()).rejects.toThrow("Map is not attached.");
    expect(getZoom.mock.calls.length).toBe(calls + 4);
  });

  test("settled camera updates live overlays without another public move", async () => {
    const observe = jest.fn();
    const onMove = jest.fn();
    const onMoveEnd = jest.fn();
    const Probe = () => {
      observe(useContext(NativeCameraContext)?.viewState.bearing);
      return null;
    };
    const view = await render(
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        viewState={initialViewState}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
      >
        <Probe />
        <NativeMarkerOverlay lngLat={[1, 2]} anchor="top-left" offset={[0, 0]}>
          <Text>Final position</Text>
        </NativeMarkerOverlay>
      </NativeMap>
    );
    const { move, settle } = captureEvents();
    const observed = {
      longitude: 1,
      latitude: 2,
      zoom: 3,
      pitch: 0,
      bearing: 0,
    };
    await act(async () =>
      view.getByTestId("wrapper-map").props.onDidFinishLoadingMap()
    );
    project.mockResolvedValueOnce([40, 50]);
    await act(async () => move({ ...observed, bearing: 40 }, false));
    expect(observe.mock.calls.at(-1)?.[0]).toBe(40);
    await waitFor(() =>
      expect(view.getByTestId("native-marker-overlay").props.style.left).toBe(
        40
      )
    );

    project.mockResolvedValueOnce([60, 70]);
    await act(async () => settle(observed));
    expect(observe.mock.calls.at(-1)?.[0]).toBe(0);
    await waitFor(() =>
      expect(view.getByTestId("native-marker-overlay").props.style.left).toBe(
        60
      )
    );
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMoveEnd).toHaveBeenCalledTimes(1);

    const settledProjections = project.mock.calls.length;
    await act(async () => settle({ ...observed }));
    expect(onMoveEnd).toHaveBeenCalledTimes(2);
    expect(project).toHaveBeenCalledTimes(settledProjections);

    await act(async () => move({ ...observed }, true));
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(project).toHaveBeenCalledTimes(settledProjections);

    const settledCamera = { ...observed, bearing: 10 };
    project.mockResolvedValueOnce([80, 90]);
    await act(async () => settle(settledCamera, [-10, -20, 30, 40]));
    expect(onMoveEnd).toHaveBeenCalledTimes(3);
    expect(project).toHaveBeenCalledTimes(settledProjections + 1);
    expect(view.getByTestId("native-marker-overlay").props.style.left).toBe(80);

    project.mockResolvedValueOnce([100, 110]);
    await act(async () => move(settledCamera, true, [-15, -20, 25, 40]));
    expect(onMove).toHaveBeenLastCalledWith({
      viewState: settledCamera,
      origin: "user",
    });
    expect(project).toHaveBeenCalledTimes(settledProjections + 2);
    expect(view.getByTestId("native-marker-overlay").props.style.left).toBe(
      100
    );

    project.mockResolvedValueOnce([120, 130]);
    const paddedBounds = [-20, -20, 20, 40] as const;
    await act(async () => settle(settledCamera, paddedBounds));
    expect(onMoveEnd).toHaveBeenLastCalledWith({
      viewState: settledCamera,
      origin: "unknown",
    });
    expect(project).toHaveBeenCalledTimes(settledProjections + 3);
    expect(view.getByTestId("native-marker-overlay").props.style.left).toBe(
      120
    );

    await act(async () => settle({ ...settledCamera }, [...paddedBounds]));
    expect(project).toHaveBeenCalledTimes(settledProjections + 3);

    await view.unmount();
    await act(async () => {
      move({ ...observed, bearing: 80 }, false);
      settle({ ...observed, bearing: 90 });
    });
    expect(onMove).toHaveBeenCalledTimes(3);
    expect(onMoveEnd).toHaveBeenCalledTimes(5);
  });
};
