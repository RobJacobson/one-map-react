import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  type ComponentProps,
  createContext,
  createRef,
  forwardRef,
  type ReactNode,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { mapboxNativeUI } from "../src/adapters/mapbox-native/ui.js";
import { maplibreNativeUI } from "../src/adapters/maplibre-native/ui.js";
import {
  NativeCameraContext,
  NativeMapPresentationContext,
  NativeOverlayContext,
  type NativeMapPresentation,
  type NativeOverlay,
} from "../src/adapters/shared/native-map-presentation.js";
import { NativeMarkerOverlay } from "../src/adapters/shared/native-marker-overlay.js";
import {
  createNativeUI,
  type NativeMarkerHostProps,
  type NativeMarkerProps,
} from "../src/adapters/shared/native-ui.js";
import type {
  MapRef,
  Point,
  ViewState,
} from "../src/contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../src/contracts/event-types.js";
import type { ControlPosition, MarkerRef } from "../src/contracts/ui-types.js";
import {
  type MapSession,
  MapSessionContext,
} from "../src/facade/map-context.js";

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
      <NativeCameraContext.Provider value={value.viewState}>
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
    <View
      testID="native-marker"
      nativeID={nativeID}
      {...{ onAnnotationDragEnd: props.onDragEnd }}
    >
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
  const session: FixtureSession = {
    nativeLocationFollowing: false,
    ref: { current: map },
    map,
    ready: true,
    viewState: { longitude: 10, latitude: 20, zoom: 4, bearing: 0, pitch: 0 },
    gestureLocked: false,
    overlayHostName: "fixture-control-host",
    ornaments: {},
    requestGestureLock: lock,
    setNativeLayout: jest.fn(),
    setOverlay: jest.fn(),
    setOrnament: jest.fn(),
    subscribe: (event, callback) => {
      listeners[event].add(callback);
      return () => {
        listeners[event].delete(callback);
      };
    },
    emit: (event, payload) => {
      for (const callback of listeners[event]) callback(payload);
    },
    registerSource: () => () => undefined,
    dispatchSource: () => undefined,
  };
  return { session, project, unproject, easeTo, lock };
};

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

afterEach(() => {
  jest.useRealTimers();
  refresh.mockClear();
});

describe("TF07 native UI composition", () => {
  test("live overlay follows measured anchors, offsets, camera movement, and viewport layout", async () => {
    const fixture = sessionFixture();
    const scene = (
      offset: Point,
      layout?: { width: number; height: number }
    ) => (
      <FixtureSessionProvider
        value={{ ...fixture.session, nativeLayout: layout }}
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
    await act(async () =>
      fixture.session.emit("move", {
        viewState: {
          longitude: 0,
          latitude: 0,
          zoom: 10,
          bearing: 0,
          pitch: 0,
        },
        origin: "user",
      })
    );
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

  test("invalid injected locations report failure without successful notification or camera dispatch", async () => {
    const fixture = sessionFixture();
    const located = jest.fn();
    const failed = jest.fn();
    const view = await render(
      <NativeOverlayHost session={fixture.session}>
        <ui.GeolocateControl
          getCurrentPosition={async () => ({ lngLat: [1, Number.NaN] })}
          onGeolocate={located}
          onError={failed}
        />
      </NativeOverlayHost>
    );
    await fireEvent.press(view.getByLabelText("Locate me"));
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("coordinate"),
      })
    );
    expect(located).not.toHaveBeenCalled();
    expect(fixture.easeTo).not.toHaveBeenCalled();
  });

  test("injected location coordinates are copied before callbacks and camera dispatch", async () => {
    const fixture = sessionFixture();
    const located = jest.fn();
    const position: { lngLat: [number, number] } = { lngLat: [1, 2] };
    const view = await render(
      <NativeOverlayHost session={fixture.session}>
        <ui.GeolocateControl
          getCurrentPosition={async () => position}
          onGeolocate={located}
        />
      </NativeOverlayHost>
    );
    await fireEvent.press(view.getByLabelText("Locate me"));
    position.lngLat[0] = 99;
    expect(located).toHaveBeenCalledWith({ lngLat: [1, 2] });
    expect(fixture.easeTo).toHaveBeenCalledWith({ center: [1, 2], zoom: 14 });
  });

  test("native popups and custom controls forward their owned host presentation", async () => {
    const fixture = sessionFixture();
    const touched = jest.fn();
    const popup = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Popup
          longitude={10}
          latitude={20}
          {...{
            hostProps: {
              testID: "bubble",
              style: { backgroundColor: "pink" },
              onTouchStart: touched,
            },
          }}
        />
      </FixtureSessionProvider>
    );
    expect(
      StyleSheet.flatten(popup.getByTestId("bubble").props.style)
        .backgroundColor
    ).toBe("pink");
    await nativeTouch(popup.getByTestId("bubble"), "touchStart", touch(1, 2));
    expect(touched).toHaveBeenCalledTimes(1);
    await popup.unmount();
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

  test("browser focus and expanded attribution requests fail explicitly on native", async () => {
    const fixture = sessionFixture();
    await expect(
      render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Popup longitude={10} latitude={20} focusAfterOpen />
        </FixtureSessionProvider>
      )
    ).rejects.toThrow("focusAfterOpen");
    await expect(
      render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.AttributionControl compact={false} />
        </FixtureSessionProvider>
      )
    ).rejects.toThrow("expanded attribution");
  });

  test("compass pitch presentation and reset follow the observed camera", async () => {
    const fixture = sessionFixture();
    const session = {
      ...fixture.session,
      viewState: {
        longitude: 10,
        latitude: 20,
        zoom: 4,
        bearing: 30,
        pitch: 60,
      },
    };
    const view = await render(
      <NativeOverlayHost session={session}>
        <ui.NavigationControl visualizePitch />
      </NativeOverlayHost>
    );
    expect(view.getByText("↑").props.style.transform).toEqual([
      { rotate: "-30deg" },
      { perspective: 400 },
      { rotateX: "60deg" },
    ]);
    await fireEvent.press(view.getByLabelText("Reset north"));
    expect(fixture.easeTo).toHaveBeenCalledWith({ bearing: 0, pitch: 0 });
  });

  test("navigation uses the renderer zoom when movement snapshots lag", async () => {
    const fixture = sessionFixture();
    const getZoom = jest.fn(async () => 12);
    const zoomTo = jest.fn(async () => undefined);
    fixture.session.ref.current = {
      ...fixture.session.ref.current,
      getZoom,
      zoomTo,
    } as MapRef;
    const view = await render(
      <NativeOverlayHost session={fixture.session}>
        <ui.NavigationControl />
      </NativeOverlayHost>
    );
    await fireEvent.press(view.getByLabelText("Zoom out"));
    expect(getZoom).toHaveBeenCalledTimes(1);
    expect(zoomTo).toHaveBeenCalledWith(11);
  });

  test("child scroll handoff keeps SDK gestures unchanged", async () => {
    const fixture = sessionFixture();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker longitude={10} latitude={20} draggable>
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
    const started = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          draggable
          onDragStart={started}
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
    expect(started).toHaveBeenCalledTimes(1);
    expect(fixture.lock).toHaveBeenLastCalledWith(true);
    await view.unmount();
    expect(fixture.lock).toHaveBeenLastCalledWith(false);
  });

  test.each(["vertical", "horizontal"])(
    "%s scrollable descendants keep stationary long touches without marker activation",
    async (direction) => {
      jest.useFakeTimers();
      const fixture = sessionFixture();
      const clicked = jest.fn();
      const started = jest.fn();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            draggable
            onClick={clicked}
            onDragStart={started}
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
      expect(started).not.toHaveBeenCalled();
      expect(clicked).not.toHaveBeenCalled();
    }
  );

  test("Android child touches keep SDK ownership until a live drag activates", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    jest.useFakeTimers();
    try {
      const fixture = sessionFixture();
      const pressed = jest.fn();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker
            longitude={10}
            latitude={20}
            draggable
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
      await beginTouch(view.getByTestId("android-marker"), touch(5, 8));
      await act(async () => jest.advanceTimersByTime(500));
      expect(fixture.lock).toHaveBeenLastCalledWith(true);
      await view.unmount();
      expect(fixture.lock).toHaveBeenLastCalledWith(false);
    } finally {
      platform.restore();
    }
  });

  test.each(["touchCancel", "multiple-touch", "unmount"])(
    "%s restores map gestures after child interaction",
    async (ending) => {
      const fixture = sessionFixture();
      const view = await render(
        <FixtureSessionProvider value={fixture.session}>
          <ui.Marker longitude={10} latitude={20} draggable>
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
    "Mapbox %s annotation reports consecutive taps and still supports dragging and refresh",
    async (os) => {
      const platform = jest.replaceProperty(Platform, "OS", os);
      try {
        const fixture = sessionFixture();
        const clicked = jest.fn();
        const dragged = jest.fn();
        const ref = createRef<MarkerRef>();
        const view = await render(
          <FixtureSessionProvider value={fixture.session}>
            <mapboxNativeUI.Marker
              ref={ref}
              longitude={10}
              latitude={20}
              renderMode="annotation"
              draggable
              onClick={clicked}
              onDragEnd={dragged}
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

        await fireEvent(view.getByTestId("mapbox-annotation"), "dragEnd", {
          geometry: { coordinates: [11, 21] },
          properties: { screenPointX: 110, screenPointY: 210 },
        });
        expect(dragged).toHaveBeenCalledWith(
          expect.objectContaining({ lngLat: [11, 21] })
        );
        expect(view.getByTestId("mapbox-annotation").props.coordinate).toEqual([
          10, 20,
        ]);
        await expect(ref.current?.refresh()).resolves.toBeUndefined();
        await fireEvent.press(view.getByTestId("mapbox-annotation"));
        expect(clicked).toHaveBeenCalledTimes(3);
        await view.unmount();
      } finally {
        platform.restore();
      }
    }
  );

  test("MapLibre live, annotation, and popup activation each notify once", async () => {
    const fixture = sessionFixture();
    const clicked = jest.fn();
    const closed = jest.fn();
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
    const popup = await render(
      <FixtureSessionProvider value={fixture.session}>
        <maplibreNativeUI.Popup longitude={10} latitude={20} onClose={closed} />
      </FixtureSessionProvider>
    );
    await fireEvent.press(popup.getByLabelText("Close popup"));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  test("long press emits coordinate proposals and releases the gesture lock", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const started = jest.fn();
    const ended = jest.fn();
    const markerProps: NativeMarkerProps = {
      longitude: 10,
      latitude: 20,
      draggable: true,
      hostProps: { testID: "content" },
      onDragStart: started,
      onDragEnd: ended,
    };
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker {...markerProps} />
      </FixtureSessionProvider>
    );
    const marker = view.getByTestId("content");
    await beginTouch(marker, touch(5, 8));
    await act(async () => {
      jest.advanceTimersByTime(499);
    });
    expect(started).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(started).toHaveBeenCalledWith({
      lngLat: [10, 20],
      point: [100, 200],
    });
    await act(async () => {
      await nativeTouch(marker, "touchMove", touch(25, 18));
    });
    expect(fixture.unproject).toHaveBeenLastCalledWith([120, 210]);
    await act(async () => {
      await nativeTouch(marker, "touchEnd", touch(35, 28, 0));
    });
    expect(ended).toHaveBeenCalledWith({ lngLat: [13, 22], point: [130, 220] });
    expect(fixture.lock.mock.calls).toEqual([[true], [false]]);
  });

  test("early motion and additional touches cancel long press without starting a drag", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          draggable
          {...{ hostProps: { testID: "content" } }}
        />
      </FixtureSessionProvider>
    );
    const marker = view.getByTestId("content");
    await beginTouch(marker, touch(0, 0));
    await nativeTouch(marker, "touchMove", touch(20, 0));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(fixture.project).not.toHaveBeenCalled();
    await beginTouch(marker, touch(0, 0));
    await nativeTouch(marker, "touchMove", touch(0, 0, 2));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(fixture.project).not.toHaveBeenCalled();
  });

  test("unmount discards a pending drag projection and restores gestures", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    let finish: (point: Point) => void = () => undefined;
    fixture.project.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const started = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          draggable
          onDragStart={started}
          {...{ hostProps: { testID: "content" } }}
        />
      </FixtureSessionProvider>
    );
    await beginTouch(view.getByTestId("content"), touch(0, 0));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await view.unmount();
    await act(async () => {
      finish([100, 200]);
    });
    expect(started).not.toHaveBeenCalled();
    expect(fixture.lock.mock.calls).toEqual([[true], [false]]);
  });

  test("external coordinates cancel a drag while application proposal echoes keep it active", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const proposal = jest.fn();
    const marker = (longitude: number, latitude: number) => (
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={longitude}
          latitude={latitude}
          draggable
          onDrag={proposal}
          {...{ hostProps: { testID: "content" } }}
        />
      </FixtureSessionProvider>
    );
    const view = await render(marker(10, 20));
    await beginTouch(view.getByTestId("content"), touch(0, 0));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await nativeTouch(view.getByTestId("content"), "touchMove", touch(20, 10));
    await view.rerender(marker(12, 21));
    expect(fixture.lock).toHaveBeenCalledTimes(1);
    await view.rerender(marker(30, 40));
    expect(fixture.lock.mock.calls).toEqual([[true], [false]]);
  });

  test("an older unprojection cannot replace a newer drag proposal", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const proposal = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          draggable
          onDrag={proposal}
          {...{ hostProps: { testID: "content" } }}
        />
      </FixtureSessionProvider>
    );
    await beginTouch(view.getByTestId("content"), touch(0, 0));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    proposal.mockClear();
    let older: (coordinate: readonly [number, number]) => void = () =>
      undefined;
    let newer: (coordinate: readonly [number, number]) => void = () =>
      undefined;
    fixture.unproject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          older = resolve;
        })
    );
    fixture.unproject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          newer = resolve;
        })
    );
    await nativeTouch(view.getByTestId("content"), "touchMove", touch(20, 10));
    await nativeTouch(view.getByTestId("content"), "touchMove", touch(30, 20));
    await act(async () => {
      newer([13, 22]);
    });
    await act(async () => {
      older([12, 21]);
    });
    expect(proposal).toHaveBeenCalledTimes(1);
    expect(proposal).toHaveBeenCalledWith({
      lngLat: [13, 22],
      point: [130, 220],
    });
  });

  test("a superseded unprojection failure does not cancel the current drag", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const failed = jest.fn();
    const ended = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          draggable
          onError={failed}
          onDragEnd={ended}
          {...{ hostProps: { testID: "content" } }}
        />
      </FixtureSessionProvider>
    );
    const marker = view.getByTestId("content");
    await beginTouch(marker, touch(0, 0));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    let rejectOlder: (error: Error) => void = () => {};
    fixture.unproject.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOlder = reject;
        })
    );
    await nativeTouch(marker, "touchMove", touch(20, 10));
    await nativeTouch(marker, "touchMove", touch(30, 20));
    await act(async () => {
      rejectOlder(new Error("stale bridge failure"));
    });
    expect(fixture.lock.mock.calls).toEqual([[true]]);
    expect(failed).not.toHaveBeenCalled();
    await nativeTouch(marker, "touchEnd", touch(40, 30, 0));
    expect(ended).toHaveBeenCalledWith({ lngLat: [14, 23], point: [140, 230] });
    expect(fixture.lock.mock.calls).toEqual([[true], [false]]);
  });

  test("the current unprojection failure still reports and releases the drag", async () => {
    jest.useFakeTimers();
    const fixture = sessionFixture();
    const failed = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          draggable
          onError={failed}
          {...{ hostProps: { testID: "content" } }}
        />
      </FixtureSessionProvider>
    );
    const marker = view.getByTestId("content");
    await beginTouch(marker, touch(0, 0));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    const failure = new Error("current bridge failure");
    fixture.unproject.mockRejectedValueOnce(failure);
    await nativeTouch(marker, "touchMove", touch(20, 10));
    expect(failed).toHaveBeenCalledWith(failure);
    expect(fixture.lock.mock.calls).toEqual([[true], [false]]);
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

  test("annotation drag rejection reapplies the authoritative coordinate", async () => {
    const fixture = sessionFixture();
    const ended = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          renderMode="annotation"
          draggable
          onDragEnd={ended}
        />
      </FixtureSessionProvider>
    );
    const originalHost = view.getByTestId("native-marker").props.nativeID;
    await fireEvent(view.getByTestId("native-marker"), "annotationDragEnd", {
      lngLat: [30, 40],
    });
    expect(ended).toHaveBeenCalledWith({ lngLat: [30, 40] });
    expect(view.getByTestId("native-marker").props.nativeID).not.toBe(
      originalHost
    );
  });

  test("popup dismissal is requested once and teardown is silent", async () => {
    const fixture = sessionFixture();
    const closed = jest.fn();
    const opened = jest.fn();
    const view = await render(
      <FixtureSessionProvider value={fixture.session}>
        <ui.Popup
          longitude={10}
          latitude={20}
          onClose={closed}
          onOpen={opened}
          closeOnMove
        />
      </FixtureSessionProvider>
    );
    expect(opened).toHaveBeenCalledTimes(1);
    await act(async () => {
      fixture.session.emit("move", {
        viewState: {
          longitude: 10,
          latitude: 20,
          zoom: 4,
          bearing: 0,
          pitch: 0,
        },
        origin: "user",
      });
    });
    await act(async () => {
      fixture.session.emit("click", { lngLat: [10, 20], point: [0, 0] });
    });
    expect(closed).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  test("injected location centers once and pending work is ignored after teardown", async () => {
    const fixture = sessionFixture();
    const located = jest.fn();
    let finish: (position: {
      lngLat: readonly [number, number];
    }) => void = () => undefined;
    const provider = jest.fn(
      () =>
        new Promise<{ lngLat: readonly [number, number] }>((resolve) => {
          finish = resolve;
        })
    );
    const view = await render(
      <NativeOverlayHost session={fixture.session}>
        <ui.GeolocateControl
          getCurrentPosition={provider}
          onGeolocate={located}
        />
      </NativeOverlayHost>
    );
    await fireEvent.press(view.getByLabelText("Locate me"));
    await fireEvent.press(view.getByLabelText("Locate me"));
    expect(provider).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ lngLat: [1, 2] });
    });
    expect(fixture.easeTo).toHaveBeenCalledWith({ center: [1, 2], zoom: 14 });
    expect(located).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByLabelText("Locate me"));
    await view.unmount();
    await act(async () => {
      finish({ lngLat: [3, 4] });
    });
    expect(fixture.easeTo).toHaveBeenCalledTimes(1);
    expect(located).toHaveBeenCalledTimes(1);
  });
});

test("native creation defaults compare by their effective values", async () => {
  const fixture = sessionFixture();
  const tree = (explicit: boolean) => (
    <FixtureSessionProvider value={fixture.session}>
      <ui.Marker
        longitude={10}
        latitude={20}
        anchor={explicit ? "bottom" : undefined}
        renderMode={explicit ? "view" : undefined}
      />
      <ui.Popup
        longitude={10}
        latitude={20}
        closeButton={explicit ? true : undefined}
        closeOnClick={explicit ? true : undefined}
        closeOnMove={explicit ? false : undefined}
      />
      <ui.NavigationControl
        position={explicit ? "top-right" : undefined}
        showZoom={explicit ? true : undefined}
        showCompass={explicit ? true : undefined}
        visualizePitch={explicit ? false : undefined}
      />
      <ui.ScaleControl
        position={explicit ? "bottom-left" : undefined}
        maxWidth={explicit ? 100 : undefined}
      />
    </FixtureSessionProvider>
  );
  const mounted = await render(tree(false));
  await mounted.rerender(tree(true));
  await mounted.rerender(tree(false));
  await mounted.unmount();
});

test("native creation validation continues rejecting genuine changes", async () => {
  const fixture = sessionFixture();
  const tree = (showZoom: boolean) => (
    <FixtureSessionProvider value={fixture.session}>
      <ui.NavigationControl showZoom={showZoom} />
    </FixtureSessionProvider>
  );
  const mounted = await render(tree(true));
  await expect(mounted.rerender(tree(false))).rejects.toThrow(
    'NavigationControl changed the creation option "showZoom"'
  );
});

test.each([false, true])(
  "removing a nondefault native marker anchor requires remount (custom content: %s)",
  async (custom) => {
    const fixture = sessionFixture();
    const tree = (anchor?: "top") => (
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker longitude={10} latitude={20} anchor={anchor}>
          {custom ? <Text>custom</Text> : undefined}
        </ui.Marker>
      </FixtureSessionProvider>
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
    <FixtureSessionProvider value={fixture.session}>
      <ui.Marker longitude={10} latitude={20} anchor={anchor}>
        {custom ? <Text>custom</Text> : undefined}
      </ui.Marker>
    </FixtureSessionProvider>
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
      <FixtureSessionProvider value={fixture.session}>
        <ui.Marker
          longitude={10}
          latitude={20}
          anchor={explicit ? (custom ? "center" : "bottom") : undefined}
        >
          {custom ? <Text>custom</Text> : undefined}
        </ui.Marker>
      </FixtureSessionProvider>
    );
    const mounted = await render(tree(true));
    await mounted.rerender(tree(false));
    await mounted.rerender(tree(true));
    await mounted.unmount();
  }
);
