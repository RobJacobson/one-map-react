import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  type ComponentProps,
  createContext,
  createRef,
  startTransition,
  Suspense,
  forwardRef,
  type ReactNode,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { mapboxNativeUI } from "../src/adapters/mapbox-native/ui.js";
import { maplibreNativeUI } from "../src/adapters/maplibre-native/ui.js";
import {
  NativeCameraContext,
  NativeMapPresentationContext,
  NativeOverlayContext,
  type NativeMapPresentation,
  type NativeOverlay,
  withNativeMapPresentation,
} from "../src/adapters/shared/native-map-presentation.js";
import { NativeMarkerOverlay } from "../src/adapters/shared/native-marker-overlay.js";
import {
  createNativeUI,
  type NativeMarkerHostProps,
} from "../src/adapters/shared/native-ui.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type {
  MapRef,
  Point,
  ViewState,
} from "../src/contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type { ControlPosition, MarkerRef } from "../src/contracts/ui-types.js";
import {
  type MapSession,
  MapSessionContext,
} from "../src/facade/map-context.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Marker as SharedMarker } from "../src/facade/ui.js";

type FixtureSession = MapSession &
  NativeMapPresentation & { readonly viewState: ViewState | null };

const FixtureSessionProvider = ({
  value,
  children,
}: {
  readonly value: FixtureSession;
  readonly children: ReactNode;
}) => (
  <MapSessionContext.Provider value={value}>
    <NativeMapPresentationContext.Provider value={value}>
      <NativeCameraContext.Provider
        value={
          value.viewState
            ? { viewState: value.viewState, observedViewState: value.viewState }
            : null
        }
      >
        {children}
      </NativeCameraContext.Provider>
    </NativeMapPresentationContext.Provider>
  </MapSessionContext.Provider>
);

const refresh = jest.fn(async () => undefined);

type MapboxAnnotationProps = ComponentProps<
  typeof import("@rnmapbox/maps").PointAnnotation
>;

jest.mock("@rnmapbox/maps", () => {
  const React = require("react");
  const Native = require("react-native");
  return {
    PointAnnotation: React.forwardRef(
      (props: MapboxAnnotationProps, ref: unknown) => {
        const selected = React.useRef(false);
        React.useImperativeHandle(ref, () => ({ refresh: () => undefined }));
        return React.createElement(
          Native.View,
          {
            ...props,
            testID: "mapbox-annotation",
            onPress: () => {
              // RNMapbox 10.3.7 toggles selection on repeated taps on both OSes.
              // eslint-disable-next-line react/immutability -- This mock useRef tracks SDK selection toggled by a press; the untyped require hides the ref from analysis.
              selected.current = !selected.current;
              const event = {
                type: "Feature" as const,
                geometry: {
                  type: "Point" as const,
                  coordinates: props.coordinate,
                },
                properties: { screenPointX: 100, screenPointY: 200 },
              };
              if (selected.current) props.onSelected?.(event);
              else props.onDeselected?.(event);
            },
          },
          props.children
        );
      }
    ),
    MarkerView: () => null,
    Callout: () => null,
    Annotation: () => null,
  };
});

jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const Native = require("react-native");
  return {
    Marker: (props: { readonly children: ReactNode }) =>
      React.createElement(
        Native.View,
        { ...props, testID: "native-marker-overlay" },
        props.children
      ),
    ViewAnnotation: React.forwardRef(
      (props: { readonly children: ReactNode }, ref: unknown) => {
        React.useImperativeHandle(ref, () => ({ refresh: () => undefined }));
        return React.createElement(
          Native.View,
          { ...props, testID: "maplibre-annotation" },
          props.children
        );
      }
    ),
    Callout: () => null,
    LayerAnnotation: () => null,
  };
});
const Host = forwardRef<MarkerRef, NativeMarkerHostProps>((props, ref) => {
  const nativeID = useId();
  useImperativeHandle(ref, () => ({ refresh }));
  return (
    <View testID="native-marker" nativeID={nativeID}>
      {props.children}
    </View>
  );
});
const ui = createNativeUI({
  Marker: Host,
  Annotation: Host,
  backend: "mapbox-native",
});

const sessionFixture = () => {
  const project = jest.fn(async (): Promise<Point> => [100, 200]);
  const unproject = jest.fn(
    async (point: Point) => [point[0] / 10, point[1] / 10] as const
  );
  const easeTo = jest.fn(async () => undefined);
  const lock = jest.fn((_locked: boolean) => undefined);
  const listeners = {
    click: new Set<(event: ClickEvent | MoveEvent) => void>(),
    move: new Set<(event: ClickEvent | MoveEvent) => void>(),
  };
  // The fixture exercises UI operations only; absent MapRef methods deliberately fail.
  const map = { project, unproject, easeTo } as unknown as MapRef;
  const session: FixtureSession & { readonly requestGestureLock: typeof lock } =
    {
      nativeLocationFollowing: false,
      // A removed gesture-lock request would expose accidental drag ownership.
      requestGestureLock: lock,
      ref: { current: map },
      map,
      ready: true,
      viewState: { longitude: 10, latitude: 20, zoom: 4, bearing: 0, pitch: 0 },
      overlayHostName: "fixture-control-host",
      setNativeLayout: jest.fn(),
      setOverlay: jest.fn(),
      subscribe: (event, callback) => {
        listeners[event].add(callback);
        return () => {
          listeners[event].delete(callback);
        };
      },
      registerSource: () => () => undefined,
      dispatchSource: () => undefined,
    };
  const emit = (
    event: "click" | "move",
    payload: ClickEvent | MoveEvent
  ): void => {
    for (const callback of listeners[event]) callback(payload);
  };
  return { session, project, unproject, easeTo, lock, emit };
};

const scaleCamera: ViewState = {
  longitude: 10,
  latitude: 20,
  zoom: 4,
  bearing: 0,
  pitch: 0,
};
const scaleMapProps = jest.fn<(props: MapProps) => void>();
const ScaleMap = withNativeMapPresentation(
  forwardRef<MapRef, MapProps>((props, _ref) => {
    scaleMapProps(props);
    return <View>{props.children}</View>;
  })
);
const moveScale = (event: MoveEvent): void =>
  scaleMapProps.mock.calls.at(-1)?.[0].onMove?.(event);

const touch = (x: number, y: number, count = 1) => ({
  nativeEvent: {
    pageX: x,
    pageY: y,
    touches: Array.from({ length: count }, () => ({ pageX: x, pageY: y })),
  },
});

// Model responder negotiation explicitly: fireEvent probes it without an event.
const beginTouch = async (
  target: ReturnType<Awaited<ReturnType<typeof render>>["getByTestId"]>,
  event: ReturnType<typeof touch>
) => {
  let node: typeof target | null = target;
  while (node && !node.props.onStartShouldSetResponder) node = node.parent;
  await act(async () => {
    expect(
      node?.props.onStartShouldSetResponder({ ...event, currentTarget: null })
    ).toBe(false);
    node?.props.onTouchStart(event);
  });
};

// Passive touch listeners do not require responder ownership in React Native.
const nativeTouch = async (
  target: ReturnType<Awaited<ReturnType<typeof render>>["getByTestId"]>,
  phase: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
  event: ReturnType<typeof touch>
) => {
  const name = `on${phase[0].toUpperCase()}${phase.slice(1)}`;
  let node: typeof target | null = target;
  while (node && !node.props[name]) node = node.parent;
  await act(async () => node?.props[name](event));
};

const NativeOverlayHost = (props: {
  readonly session: FixtureSession;
  readonly children: ReactNode;
}) => {
  const [overlays, setOverlays] = useState<ReadonlyMap<string, NativeOverlay>>(
    new globalThis.Map()
  );
  const session = useMemo(
    () => ({
      ...props.session,
      setOverlay: (
        id: string,
        position: ControlPosition | null,
        height?: number
      ) => {
        setOverlays((previous) => {
          const current = previous.get(id);
          const nextHeight = height ?? current?.height ?? 0;
          if (current?.position === position && current.height === nextHeight)
            return previous;
          const next = new globalThis.Map(previous);
          if (position === null) next.delete(id);
          else next.set(id, { id, position, height: nextHeight });
          return next;
        });
      },
    }),
    [props.session]
  );
  return (
    <FixtureSessionProvider value={session}>
      <NativeOverlayContext.Provider value={[...overlays.values()]}>
        {props.children}
      </NativeOverlayContext.Provider>
    </FixtureSessionProvider>
  );
};

const initialAppState = AppState.currentState;
const initialAppStateSubscription = jest
  .mocked(AppState.addEventListener)
  .getMockImplementation();

beforeEach(() => {
  // The RN preset models currentState as a function rather than a foreground state.
  AppState.currentState = "active";
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  AppState.currentState = initialAppState;
  const subscribe = jest.mocked(AppState.addEventListener).mockReset();
  if (initialAppStateSubscription)
    subscribe.mockImplementation(initialAppStateSubscription);
  jest.useRealTimers();
  refresh.mockClear();
});

describe("TF07 native UI composition", () => {
  test("live overlay follows measured anchors, offsets, camera movement, and viewport layout", async () => {
    const fixture = sessionFixture();
    const scene = (
      offset: Point,
      layout?: { width: number; height: number },
      observed = scaleCamera
    ) => (
      <FixtureSessionProvider
        value={{
          ...fixture.session,
          nativeLayout: layout,
          viewState: observed,
        }}
      >
        <NativeMarkerOverlay
          id="live"
          lngLat={[10, 20]}
          anchor="bottom-right"
          offset={offset}
        >
          <Text>Content</Text>
        </NativeMarkerOverlay>
      </FixtureSessionProvider>
    );
    const view = await render(scene([24, -12]));
    const host = () => view.getByTestId("native-marker-overlay");
    await fireEvent(host(), "layout", {
      nativeEvent: { layout: { width: 40, height: 20, x: 0, y: 0 } },
    });
    await waitFor(() =>
      expect(StyleSheet.flatten(host().props.style)).toMatchObject({
        left: 84,
        top: 168,
        opacity: 1,
      })
    );
    await view.rerender(scene([0, 0]));
    expect(StyleSheet.flatten(host().props.style)).toMatchObject({
      left: 60,
      top: 180,
    });
    fixture.project.mockResolvedValue([150, 260]);
    await view.rerender(scene([0, 0], undefined, { ...scaleCamera, zoom: 10 }));
    await waitFor(() =>
      expect(StyleSheet.flatten(host().props.style)).toMatchObject({
        left: 110,
        top: 240,
      })
    );
    fixture.project.mockResolvedValue([170, 280]);
    await view.rerender(scene([0, 0], { width: 300, height: 400 }));
    await waitFor(() =>
      expect(StyleSheet.flatten(host().props.style)).toMatchObject({
        left: 130,
        top: 260,
      })
    );
  });

  test("live overlay discards projection results from earlier coordinates and after unmount", async () => {
    const fixture = sessionFixture();
    let resolveOld: (point: Point) => void = () => {};
    fixture.project.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    const error = jest.fn();
    const scene = (longitude: number) => (
      <FixtureSessionProvider value={fixture.session}>
        <NativeMarkerOverlay
          id="stale"
          lngLat={[longitude, 20]}
          anchor="center"
          offset={[0, 0]}
          onProjectionError={error}
        >
          <Text>Content</Text>
        </NativeMarkerOverlay>
      </FixtureSessionProvider>
    );
    const view = await render(scene(10));
    await view.rerender(scene(11));
    await waitFor(() =>
      expect(
        StyleSheet.flatten(
          view.getByTestId("native-marker-overlay").props.style
        )
      ).toMatchObject({ left: 100, top: 200 })
    );
    await act(async () => resolveOld([999, 999]));
    expect(
      StyleSheet.flatten(view.getByTestId("native-marker-overlay").props.style)
    ).toMatchObject({ left: 100, top: 200 });
    let rejectLate: (reason: unknown) => void = () => {};
    fixture.project.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectLate = reject;
        })
    );
    await view.rerender(scene(12));
    await view.unmount();
    await act(async () => rejectLate(new Error("Detached")));
    expect(error).not.toHaveBeenCalled();
  });

  test("live overlay follows observed cameras under an unchanged controlled target", async () => {
    const fixture = sessionFixture();
    const error = jest.fn();
    let resolveOld: (point: Point) => void = () => {};
    fixture.project.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    const view = await render(
      <MapSessionContext.Provider value={fixture.session}>
        <ScaleMap
          mapStyle={{ version: 8, sources: {}, layers: [] }}
          initialViewState={scaleCamera}
          viewState={scaleCamera}
        >
          <NativeMarkerOverlay
            id="controlled"
            lngLat={[10, 20]}
            anchor="top-left"
            offset={[0, 0]}
            onProjectionError={error}
          >
            <Text>Observed position</Text>
          </NativeMarkerOverlay>
        </ScaleMap>
      </MapSessionContext.Provider>
    );
    await act(async () =>
      moveScale({ viewState: { ...scaleCamera, zoom: 5 }, origin: "user" })
    );
    const host = () => view.getByTestId("native-marker-overlay");
    expect(StyleSheet.flatten(host().props.style)).toMatchObject({
      left: 100,
      top: 200,
    });
    fixture.project.mockResolvedValueOnce([150, 250]);
    await act(async () =>
      scaleMapProps.mock.calls.at(-1)?.[0].onMoveEnd?.({
        viewState: { ...scaleCamera, zoom: 6 },
        origin: "unknown",
      })
    );
    await act(async () => resolveOld([999, 999]));
    expect(StyleSheet.flatten(host().props.style)).toMatchObject({
      left: 150,
      top: 250,
    });
    expect(error).not.toHaveBeenCalled();
    await view.unmount();
  });

  test("native controls preserve nested providers, child state, and lifetime", async () => {
    const fixture = sessionFixture();
    const theme = createContext("outside");
    const mounted = jest.fn<() => void>();
    const released = jest.fn<() => void>();
    const Consumer = () => {
      const value = useContext(theme);
      const [count, setCount] = useState(0);
      useLayoutEffect(() => {
        mounted();
        return released;
      }, []);
      return (
        <Pressable testID="context-child" onPress={() => setCount(count + 1)}>
          <Text>{`${value}:${count}`}</Text>
        </Pressable>
      );
    };
    const tree = (value: string) => (
      <NativeOverlayHost session={fixture.session}>
        <theme.Provider value={value}>
          <ui.Control>
            <Consumer />
          </ui.Control>
        </theme.Provider>
      </NativeOverlayHost>
    );
    const view = await render(tree("inside"));
    expect(view.getByText("inside:0")).toBeTruthy();
    await fireEvent.press(view.getByTestId("context-child"));
    await view.rerender(tree("updated"));
    expect(view.getByText("updated:1")).toBeTruthy();
    expect(mounted).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(released).toHaveBeenCalledTimes(1);
  });

  test.each(["top-right", "top-left", "bottom-left", "bottom-right"] as const)(
    "native controls retain measured stacking and cleanup at %s",
    async (position) => {
      const fixture = sessionFixture();
      const layout = jest.fn();
      const tree = (first: boolean) => (
        <NativeOverlayHost session={fixture.session}>
          {first && (
            <ui.Control
              position={position}
              {...{ hostProps: { testID: "first-control", onLayout: layout } }}
            >
              <Text>First</Text>
            </ui.Control>
          )}
          <ui.Control
            position={position}
            {...{ hostProps: { testID: "second-control" } }}
          >
            <Text>Second</Text>
          </ui.Control>
        </NativeOverlayHost>
      );
      const view = await render(tree(true));
      await fireEvent(view.getByTestId("first-control"), "layout", {
        nativeEvent: { layout: { width: 40, height: 48, x: 0, y: 0 } },
      });
      await fireEvent(view.getByTestId("second-control"), "layout", {
        nativeEvent: { layout: { width: 40, height: 24, x: 0, y: 0 } },
      });
      const first = StyleSheet.flatten(
        view.getByTestId("first-control").props.style
      );
      const second = StyleSheet.flatten(
        view.getByTestId("second-control").props.style
      );
      if (position.startsWith("top")) {
        expect(first.top).toBe(8);
        expect(second.top).toBe(64);
      } else {
        expect(first.bottom).toBe(40);
        expect(second.bottom).toBe(8);
      }
      expect(layout).toHaveBeenCalledTimes(1);
      await view.rerender(tree(false));
      const remaining = StyleSheet.flatten(
        view.getByTestId("second-control").props.style
      );
      expect(
        position.startsWith("top") ? remaining.top : remaining.bottom
      ).toBe(8);
    }
  );
  test.each(["android", "ios"] as const)(
    "native control portal keeps platform sizing and child state on %s",
    async (os) => {
      const platform = jest.replaceProperty(Platform, "OS", os);
      try {
        const fixture = sessionFixture();
        const mounted = jest.fn();
        const Child = () => {
          const [count, setCount] = useState(0);
          useLayoutEffect(() => {
            mounted();
          }, []);
          return (
            <Pressable
              testID="resize-child"
              onPress={() => setCount(count + 1)}
            >
              <Text>{`Count ${count}`}</Text>
            </Pressable>
          );
        };
        const tree = (width: number, height: number) => (
          <NativeOverlayHost
            session={{ ...fixture.session, nativeLayout: { width, height } }}
          >
            <ui.Control position="bottom-right">
              <Child />
            </ui.Control>
          </NativeOverlayHost>
        );
        const view = await render(tree(400, 300));
        const portalStyle = () => {
          let node = view.getByTestId("resize-child").parent;
          while (
            node &&
            node.props.hostName !== fixture.session.overlayHostName
          )
            node = node.parent;
          expect(node).not.toBeNull();
          return StyleSheet.flatten(node?.props.style);
        };
        if (os === "android") {
          expect(portalStyle()).toMatchObject({ width: 400, height: 300 });
        } else {
          expect(portalStyle().width).toBeUndefined();
          expect(portalStyle().height).toBeUndefined();
        }
        await fireEvent.press(view.getByTestId("resize-child"));
        await view.rerender(tree(600, 200));
        if (os === "android") {
          expect(portalStyle()).toMatchObject({ width: 600, height: 200 });
        } else {
          expect(portalStyle().width).toBeUndefined();
          expect(portalStyle().height).toBeUndefined();
        }
        expect(view.getByText("Count 1")).toBeTruthy();
        expect(mounted).toHaveBeenCalledTimes(1);
      } finally {
        platform.restore();
      }
    }
  );
  test.each(["view", "annotation"] as const)(
    "native %s markers reject dragging and every supplied drag callback",
    async (renderMode) => {
      for (const request of [
        { draggable: true },
        { onDragStart: jest.fn() },
        { draggable: false, onDrag: jest.fn() },
        { onDragEnd: jest.fn() },
      ]) {
        const fixture = sessionFixture();
        await expect(
          render(
            <FixtureSessionProvider value={fixture.session}>
              <ui.Marker
                longitude={10}
                latitude={20}
                renderMode={renderMode}
                {...request}
              />
            </FixtureSessionProvider>
          )
        ).rejects.toThrow("Native Marker does not support dragging");
      }
    }
  );

  test("native markers reject nonfinite coordinates and offsets before wrapper dispatch", async () => {
    const fixture = sessionFixture();
    await expect(
      render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker longitude={Number.NaN} latitude={20} />
        </FixtureSessionProvider>
      )
    ).rejects.toThrow("coordinate");
    await expect(
      render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            offset={[Number.POSITIVE_INFINITY, 0]}
          />
        </FixtureSessionProvider>
      )
    ).rejects.toThrow("map point");
  });

  test("native custom controls forward their owned host presentation", async () => {
    const fixture = sessionFixture();
    const control = await render(
      <NativeOverlayHost session={fixture.session}>
        <ui.Control
          {...{
            hostProps: {
              testID: "custom-control",
              style: { opacity: 0.8 },
              accessibilityLabel: "My control",
            },
          }}
        >
          <View />
        </ui.Control>
      </NativeOverlayHost>
    );
    expect(control.getByLabelText("My control").props.testID).toBe(
      "custom-control"
    );
    expect(
      StyleSheet.flatten(control.getByTestId("custom-control").props.style)
        .opacity
    ).toBe(0.8);
  });

  test("child scroll handoff keeps SDK gestures unchanged", async () => {
    const fixture = sessionFixture();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker longitude={10} latitude={20}>
          <View testID="child-scroll" />
        </ui.Marker>
      </FixtureSessionProvider>
    );
    const child = view.getByTestId("child-scroll");
    await nativeTouch(child, "touchStart", touch(5, 8));
    expect(fixture.lock).not.toHaveBeenCalled();
    await beginTouch(child, touch(5, 8));
    await fireEvent(child, "responderTerminate", touch(5, 8));
    expect(fixture.lock).not.toHaveBeenCalledWith(false);
    await nativeTouch(child, "touchEnd", touch(5, 18, 0));
    expect(fixture.lock).not.toHaveBeenCalled();
  });

  test("null negotiation target does not treat overflowing page layout as marker child content", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const clicked = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          onClick={clicked}
          {...{ hostProps: { testID: "label-marker" } }}
        >
          <Text>Label</Text>
        </ui.Marker>
      </FixtureSessionProvider>
    );
    const page = {
      clientHeight: 874,
      scrollHeight: 908,
      clientWidth: 402,
      scrollWidth: 402,
      parentElement: null,
    };
    const host = {
      clientHeight: 82,
      scrollHeight: 82,
      clientWidth: 137,
      scrollWidth: 137,
      parentElement: page,
    };
    const event = {
      ...touch(5, 8),
      currentTarget: host,
      target: {
        clientHeight: 17,
        scrollHeight: 17,
        clientWidth: 121,
        scrollWidth: 121,
        parentElement: host,
      },
    };
    await beginTouch(view.getByTestId("label-marker"), event);
    await act(async () => jest.advanceTimersByTime(500));
    await nativeTouch(
      view.getByTestId("label-marker"),
      "touchEnd",
      touch(5, 8, 0)
    );
    expect(fixture.lock).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(fixture.lock).not.toHaveBeenCalled();
  });

  test.each(["vertical", "horizontal"])(
    "%s scrollable descendants keep stationary long touches without marker activation",
    async (direction) => {
      jest.useFakeTimers();
      const fixture = sessionFixture();
      const clicked = jest.fn();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            onClick={clicked}
            {...{ hostProps: { testID: "scroll-marker" } }}
          >
            <Text>Child rows</Text>
          </ui.Marker>
        </FixtureSessionProvider>
      );
      const host = {
        clientHeight: 82,
        scrollHeight: 82,
        clientWidth: 120,
        scrollWidth: 120,
        parentElement: null,
      };
      const scroll = {
        clientHeight: 32,
        scrollHeight: direction === "vertical" ? 68 : 32,
        clientWidth: 120,
        scrollWidth: direction === "horizontal" ? 240 : 120,
        parentElement: host,
      };
      const event = {
        ...touch(5, 8),
        currentTarget: host,
        target: {
          clientHeight: 17,
          scrollHeight: 17,
          clientWidth: 50,
          scrollWidth: 50,
          parentElement: scroll,
        },
      };
      const marker = view.getByTestId("scroll-marker");
      await beginTouch(marker, event);
      await act(async () => jest.advanceTimersByTime(700));
      await nativeTouch(marker, "touchEnd", touch(5, 8, 0));
      expect(fixture.lock).not.toHaveBeenCalled();
      expect(clicked).not.toHaveBeenCalled();
    }
  );

  test("Android child buttons and ordinary marker touches keep SDK gesture ownership", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    jest.useFakeTimers();
    try {
      const fixture = sessionFixture();
      const pressed = jest.fn();
      const clicked = jest.fn();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            onClick={clicked}
            {...{ hostProps: { testID: "android-marker" } }}
          >
            <Pressable testID="android-child" onPress={pressed}>
              <Text>Child</Text>
            </Pressable>
          </ui.Marker>
        </FixtureSessionProvider>
      );
      const child = view.getByTestId("android-child");
      await nativeTouch(child, "touchStart", touch(5, 8));
      expect(fixture.lock).not.toHaveBeenCalled();
      await fireEvent.press(child);
      expect(pressed).toHaveBeenCalledTimes(1);
      await nativeTouch(child, "touchEnd", touch(5, 8, 0));
      expect(clicked).not.toHaveBeenCalled();
      await beginTouch(view.getByTestId("android-marker"), touch(5, 8));
      await act(async () => jest.advanceTimersByTime(500));
      expect(fixture.lock).not.toHaveBeenCalled();
      await nativeTouch(
        view.getByTestId("android-marker"),
        "touchEnd",
        touch(5, 8, 0)
      );
      expect(clicked).toHaveBeenCalledTimes(1);
      await view.unmount();
      expect(fixture.lock).not.toHaveBeenCalled();
    } finally {
      platform.restore();
    }
  });

  test.each(["touchCancel", "multiple-touch", "unmount"])(
    "%s leaves map gestures unchanged after child interaction",
    async (ending) => {
      const fixture = sessionFixture();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker longitude={10} latitude={20}>
            <View testID="child" />
          </ui.Marker>
        </FixtureSessionProvider>
      );
      const child = view.getByTestId("child");
      await nativeTouch(child, "touchStart", touch(1, 2));
      if (ending === "unmount") await view.unmount();
      else if (ending === "multiple-touch") {
        await nativeTouch(child, "touchStart", touch(1, 2, 2));
      } else await nativeTouch(child, "touchCancel", touch(1, 2));
      expect(fixture.lock).not.toHaveBeenCalled();
    }
  );

  test.each(["ios", "android"] as const)(
    "Mapbox %s annotation reports consecutive taps and retains refresh",
    async (os) => {
      const platform = jest.replaceProperty(Platform, "OS", os);
      try {
        const fixture = sessionFixture();
        const clicked = jest.fn();
        const ref = createRef<MarkerRef>();
        const view = await render(
          <FixtureSessionProvider value={fixture.session}>
            <mapboxNativeUI.Marker
              ref={ref}
              longitude={10}
              latitude={20}
              renderMode="annotation"
              onClick={clicked}
            />
          </FixtureSessionProvider>
        );
        await fireEvent.press(view.getByTestId("mapbox-annotation"));
        await fireEvent.press(view.getByTestId("mapbox-annotation"));
        expect(clicked).toHaveBeenCalledTimes(2);
        expect(clicked).toHaveBeenLastCalledWith({
          lngLat: [10, 20],
          ...(os === "android" ? { point: [100, 200] } : {}),
        });

        expect(
          view.getByTestId("mapbox-annotation").props.draggable
        ).toBeUndefined();
        expect(
          view.getByTestId("mapbox-annotation").props.onDragEnd
        ).toBeUndefined();
        await expect(ref.current?.refresh()).resolves.toBeUndefined();
        await fireEvent.press(view.getByTestId("mapbox-annotation"));
        expect(clicked).toHaveBeenCalledTimes(3);
        await view.unmount();
      } finally {
        platform.restore();
      }
    }
  );

  test("MapLibre live and annotation activation each notify once", async () => {
    const fixture = sessionFixture();
    const clicked = jest.fn();
    const stopPropagation = jest.fn();
    const event = {
      nativeEvent: { lngLat: [10, 20], point: [100, 200] },
      stopPropagation,
    };
    const marker = await render(
      <FixtureSessionProvider value={fixture.session}>
        <maplibreNativeUI.Marker
          longitude={10}
          latitude={20}
          onClick={clicked}
          {...{ hostProps: { testID: "live-content" } }}
        />
      </FixtureSessionProvider>
    );
    const content = marker.getByTestId("live-content");
    await beginTouch(content, touch(5, 8));
    await nativeTouch(content, "touchEnd", touch(5, 8, 0));
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledTimes(1);
    await marker.unmount();
    const annotation = await render(
      <FixtureSessionProvider value={fixture.session}>
        <maplibreNativeUI.Marker
          longitude={10}
          latitude={20}
          renderMode="annotation"
          onClick={clicked}
        />
      </FixtureSessionProvider>
    );
    await fireEvent(
      annotation.getByTestId("maplibre-annotation"),
      "press",
      event
    );
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(clicked).toHaveBeenCalledWith({
      lngLat: [10, 20],
      point: [100, 200],
    });
    await annotation.unmount();
  });

  test.each(["view", "annotation"] as const)(
    "%s activation keeps committed callbacks during a suspended update",
    async (renderMode) => {
      const fixture = sessionFixture();
      const committed = jest.fn();
      const abandoned = jest.fn();
      const pending = new Promise<never>(() => {});
      let suspend = () => {};
      const Pending = ({ enabled }: { readonly enabled: boolean }) => {
        if (enabled) throw pending;
        return null;
      };
      const Screen = () => {
        const [enabled, setEnabled] = useState(false);
        useLayoutEffect(() => {
          suspend = () => startTransition(() => setEnabled(true));
        }, []);
        return (
          <Suspense fallback={<Text>Pending</Text>}>
            <mapboxNativeUI.Marker
              longitude={10}
              latitude={20}
              renderMode={renderMode}
              onClick={enabled ? abandoned : committed}
              {...{ hostProps: { testID: "committed-marker" } }}
            />
            <Pending enabled={enabled} />
          </Suspense>
        );
      };
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <Screen />
        </FixtureSessionProvider>
      );
      await act(async () => suspend());
      if (renderMode === "annotation")
        await fireEvent.press(view.getByTestId("mapbox-annotation"));
      else {
        const marker = view.getByTestId("committed-marker");
        await beginTouch(marker, touch(0, 0));
        await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
      }
      expect(committed).toHaveBeenCalledTimes(1);
      expect(abandoned).not.toHaveBeenCalled();
      await view.unmount();
    }
  );

  test("marker activation composes host callbacks after its own touch handling", async () => {
    const fixture = sessionFixture();
    const order: string[] = [];
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          onClick={() => order.push("click")}
          {...{
            hostProps: {
              testID: "composed-marker",
              onStartShouldSetResponder: () => {
                order.push("negotiate");
                return false;
              },
              onTouchStart: () => order.push("start"),
              onTouchMove: () => order.push("move"),
              onTouchEnd: () => order.push("end"),
              onResponderTerminate: () => order.push("terminate"),
              onTouchCancel: () => order.push("cancel"),
            },
          }}
        />
      </FixtureSessionProvider>
    );
    const marker = view.getByTestId("composed-marker");
    await beginTouch(marker, touch(0, 0));
    await nativeTouch(marker, "touchMove", touch(1, 1));
    await nativeTouch(marker, "touchEnd", touch(1, 1, 0));
    await act(async () => marker.props.onResponderTerminate(touch(1, 1)));
    await nativeTouch(marker, "touchCancel", touch(1, 1));
    expect(order).toEqual([
      "negotiate",
      "start",
      "move",
      "click",
      "end",
      "terminate",
      "cancel",
    ]);
    expect(fixture.lock).not.toHaveBeenCalled();
  });

  test.each([
    "movement",
    "second-contact",
    "touchCancel",
    "responderTerminate",
  ])(
    "%s cancels live activation without projection or gesture changes",
    async (ending) => {
      jest.useFakeTimers();
      const fixture = sessionFixture();
      const clicked = jest.fn();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            onClick={clicked}
            {...{ hostProps: { testID: "activation" } }}
          />
        </FixtureSessionProvider>
      );
      const marker = view.getByTestId("activation");
      await beginTouch(marker, touch(0, 0));
      if (ending === "movement")
        await nativeTouch(marker, "touchMove", touch(20, 0));
      else if (ending === "second-contact")
        await nativeTouch(marker, "touchStart", touch(0, 0, 2));
      else if (ending === "touchCancel")
        await nativeTouch(marker, "touchCancel", touch(0, 0));
      else
        await act(async () => marker.props.onResponderTerminate(touch(0, 0)));
      await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
      await act(async () => jest.advanceTimersByTime(1000));
      expect(clicked).not.toHaveBeenCalled();
      expect(fixture.project).not.toHaveBeenCalled();
      expect(fixture.unproject).not.toHaveBeenCalled();
      expect(fixture.lock).not.toHaveBeenCalled();
      await beginTouch(marker, touch(0, 0));
      await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
      expect(clicked).toHaveBeenCalledTimes(1);
    }
  );

  test("background cancellation blocks transformed touches until a fresh foreground contact", async () => {
    const fixture = sessionFixture();
    const clicked = jest.fn();
    let change: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    const subscription = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, callback) => {
        change = callback;
        return { remove };
      });
    try {
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            onClick={clicked}
            {...{ hostProps: { testID: "activation" } }}
          />
        </FixtureSessionProvider>
      );
      const marker = view.getByTestId("activation");
      await beginTouch(marker, touch(0, 0));
      await act(async () => change("background"));
      await nativeTouch(marker, "touchEnd", touch(-400, 5000, 0));
      await beginTouch(marker, touch(0, 0));
      await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
      await act(async () => change("active"));
      await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
      expect(clicked).not.toHaveBeenCalled();
      await beginTouch(marker, touch(0, 0));
      await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
      expect(clicked).toHaveBeenCalledTimes(1);
      await view.unmount();
      expect(remove).toHaveBeenCalledTimes(1);
      expect(fixture.project).not.toHaveBeenCalled();
      expect(fixture.unproject).not.toHaveBeenCalled();
      expect(fixture.lock).not.toHaveBeenCalled();
    } finally {
      subscription.mockRestore();
    }
  });

  test("coordinate and mode changes cancel pending activation and detached handlers stay silent", async () => {
    const fixture = sessionFixture();
    const first = jest.fn();
    const latest = jest.fn();
    const tree = (longitude: number, renderMode?: "view" | "annotation") => (
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={longitude}
          latitude={20}
          renderMode={renderMode}
          onClick={longitude === 10 ? first : latest}
          {...{ hostProps: { testID: "activation" } }}
        />
      </FixtureSessionProvider>
    );
    const view = await render(tree(10));
    let marker = view.getByTestId("activation");
    await beginTouch(marker, touch(0, 0));
    await view.rerender(tree(30));
    marker = view.getByTestId("activation");
    await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
    expect(first).not.toHaveBeenCalled();
    expect(latest).not.toHaveBeenCalled();
    await beginTouch(marker, touch(0, 0));
    await nativeTouch(marker, "touchEnd", touch(0, 0, 0));
    expect(latest).toHaveBeenCalledWith({ lngLat: [30, 20] });
    await beginTouch(marker, touch(0, 0));
    const end = marker.props.onTouchEnd;
    await view.rerender(tree(30, "annotation"));
    await act(async () => end(touch(0, 0, 0)));
    expect(latest).toHaveBeenCalledTimes(1);
    await view.rerender(tree(30));
    marker = view.getByTestId("activation");
    await beginTouch(marker, touch(0, 0));
    const detachedEnd = marker.props.onTouchEnd;
    await view.unmount();
    await act(async () => detachedEnd(touch(0, 0, 0)));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(fixture.project).not.toHaveBeenCalled();
    expect(fixture.unproject).not.toHaveBeenCalled();
    expect(fixture.lock).not.toHaveBeenCalled();
  });

  test("annotation refresh delegates, live refresh resolves without work", async () => {
    const fixture = sessionFixture();
    const ref = createRef<MarkerRef>();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          ref={ref}
          renderMode="annotation"
        />
      </FixtureSessionProvider>
    );
    await ref.current?.refresh();
    expect(refresh).toHaveBeenCalledTimes(1);
    await view.unmount();
    await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker longitude={10} latitude={20} ref={ref} />
      </FixtureSessionProvider>
    );
    await ref.current?.refresh();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

const creationAdapter = {
  backend: "mapbox-native",
  services: { location: {} },
  ...ui,
} as unknown as Adapter;
const CreationSessionProvider = ({
  value,
  children,
}: {
  readonly value: FixtureSession;
  readonly children: ReactNode;
}) => (
  <MapSetup adapter={creationAdapter}>
    <FixtureSessionProvider value={value}>{children}</FixtureSessionProvider>
  </MapSetup>
);

test("native creation defaults compare by their effective values", async () => {
  const fixture = sessionFixture();
  const tree = (explicit: boolean) => (
    <CreationSessionProvider value={fixture.session}>
      <SharedMarker
        longitude={10}
        latitude={20}
        anchor={explicit ? "bottom" : undefined}
        renderMode={explicit ? "view" : undefined}
      />
    </CreationSessionProvider>
  );
  const mounted = await render(tree(false));
  await mounted.rerender(tree(true));
  await mounted.rerender(tree(false));
  await mounted.unmount();
});

test.each([false, true])(
  "removing a nondefault native marker anchor requires remount (custom content: %s)",
  async (custom) => {
    const fixture = sessionFixture();
    const tree = (anchor?: "top") => (
      <CreationSessionProvider value={fixture.session}>
        <SharedMarker longitude={10} latitude={20} anchor={anchor}>
          {custom ? <Text>custom</Text> : undefined}
        </SharedMarker>
      </CreationSessionProvider>
    );
    const mounted = await render(tree("top"));
    await expect(mounted.rerender(tree())).rejects.toThrow(
      'Marker changed the creation option "anchor"'
    );
  }
);

test("native marker defaults stay frozen when content changes", async () => {
  const fixture = sessionFixture();
  const tree = (custom: boolean, anchor?: "bottom" | "center") => (
    <CreationSessionProvider value={fixture.session}>
      <SharedMarker longitude={10} latitude={20} anchor={anchor}>
        {custom ? <Text>custom</Text> : undefined}
      </SharedMarker>
    </CreationSessionProvider>
  );
  const mounted = await render(tree(false));
  await mounted.rerender(tree(true));
  await mounted.rerender(tree(true, "bottom"));
  await mounted.rerender(tree(true));
  await expect(mounted.rerender(tree(true, "center"))).rejects.toThrow(
    'creation option "anchor"'
  );
});

test.each([false, true])(
  "native marker effective defaults work when initially explicit (custom content: %s)",
  async (custom) => {
    const fixture = sessionFixture();
    const tree = (explicit: boolean) => (
      <CreationSessionProvider value={fixture.session}>
        <SharedMarker
          longitude={10}
          latitude={20}
          anchor={explicit ? (custom ? "center" : "bottom") : undefined}
        >
          {custom ? <Text>custom</Text> : undefined}
        </SharedMarker>
      </CreationSessionProvider>
    );
    const mounted = await render(tree(true));
    await mounted.rerender(tree(false));
    await mounted.rerender(tree(true));
    await mounted.unmount();
  }
);
