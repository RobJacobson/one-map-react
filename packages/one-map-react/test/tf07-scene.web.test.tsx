import { act, fireEvent, render } from "@testing-library/react";
import type {
  Adapter,
  MapProps,
  MapRef,
  MarkerProps,
  MarkerRef,
  ViewState,
} from "one-map-react";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { expect, test, vi } from "vite-plus/test";

import { NativeTf07Screen } from "../../../examples/shared/native-tf07-screen.js";
import {
  Tf07Scene,
  type Tf07Probe,
} from "../../../examples/shared/tf07-scene.js";

const fixture = vi.hoisted(() => ({
  markers: [] as Array<Record<string, unknown>>,
  viewState: undefined as ViewState | undefined,
  observedCenter: [-122.31, 47.6],
  zoom: 11,
  commands: [] as string[],
  probeInMap: [] as boolean[],
  click: undefined as
    | undefined
    | ((event: {
        lngLat: readonly [number, number];
        point: readonly [number, number];
        features: readonly object[];
      }) => void),
}));
vi.mock("one-map-react", async () => {
  const react = await import("react");
  const InMap = react.createContext(false);
  const Content = ({ children }: { readonly children?: ReactNode }) => children;
  return {
    MapSetup: Content,
    Map: react.forwardRef(
      (
        props: {
          readonly children?: ReactNode;
          readonly onClick?: typeof fixture.click;
          readonly viewState?: ViewState;
        },
        ref
      ) => {
        fixture.click = props.onClick;
        fixture.viewState = props.viewState;
        react.useImperativeHandle(ref, () => ({
          getCenter: async () => fixture.observedCenter,
          getZoom: async () => fixture.zoom,
          queryRenderedFeatures: async () => [],
          project: async () => [100, 100],
          jumpTo: async () => {
            fixture.commands.push("jumpTo");
          },
          zoomTo: async (zoom: number) => {
            fixture.zoom = zoom;
            fixture.commands.push("zoomTo");
          },
        }));
        return react.createElement(
          "div",
          { "data-testid": "sdk-map" },
          react.createElement(InMap.Provider, { value: true }, props.children)
        );
      }
    ),
    Source: Content,
    Layer: () => null,
    Marker: (props: Record<string, unknown>) => {
      const inMap = react.useContext(InMap);
      if (String(props.id).startsWith("tf07-rejection")) {
        fixture.probeInMap.push(inMap);
        if (props.draggable || props.onDrag)
          throw new Error(
            "Native Marker does not support dragging. Use a selected raw native annotation for SDK dragging."
          );
      }
      fixture.markers.push(props);
      return null;
    },
    UserLocation: () => null,
  };
});

test.each([false, true])(
  "TF07 native=%s supplies only supported marker interaction props",
  (native) => {
    fixture.markers = [];
    const view = render(
      <Tf07Scene
        renderLocation={() => null}
        renderNavigation={() => null}
        native={native}
        style={{ width: 400, height: 300 }}
        renderPopup={() => null}
        markerContent={() => null}
        report={() => undefined}
        attach={() => undefined}
      />
    );
    for (const id of ["tf07-live", "tf07-annotation"]) {
      const marker = fixture.markers.find((props) => props.id === id);
      expect(marker?.onClick).toBeTypeOf("function");
      for (const name of ["draggable", "onDragStart", "onDrag", "onDragEnd"]) {
        if (native) expect(marker).not.toHaveProperty(name);
        else
          expect(marker?.[name]).toEqual(
            name === "draggable" ? true : expect.any(Function)
          );
      }
    }
    view.unmount();
  }
);

test("TF07 native scene remount retires its screen location action with the map attachment", async () => {
  const mountedLocation = vi.fn();
  const disposedLocation = vi.fn();
  const Location = () => {
    useEffect(() => {
      mountedLocation();
      return disposedLocation;
    }, []);
    return null;
  };
  let probe: Tf07Probe | null = null;
  const mounted = render(
    <Tf07Scene
      native
      renderLocation={Location}
      renderNavigation={() => null}
      renderPopup={() => null}
      markerContent={() => null}
      style={{ width: 400, height: 300 }}
      report={() => undefined}
      attach={(value) => {
        probe = value;
      }}
    />
  );
  expect(mountedLocation).toHaveBeenCalledTimes(1);
  await act(async () => {
    probe?.configure("remount");
  });
  expect(disposedLocation).toHaveBeenCalledTimes(1);
  expect(mountedLocation).toHaveBeenCalledTimes(2);
  mounted.unmount();
  expect(disposedLocation).toHaveBeenCalledTimes(2);
});

test("native application siblings preserve providers and local state when the map resizes", () => {
  const Theme = createContext("outside");
  const Navigation = () => {
    const theme = useContext(Theme);
    const [count, setCount] = useState(0);
    return (
      <button type="button" onClick={() => setCount(count + 1)}>
        {theme} {count}
      </button>
    );
  };
  const tree = (width: number, theme: string) => (
    <Theme.Provider value={theme}>
      <Tf07Scene
        native
        renderLocation={() => null}
        renderNavigation={Navigation}
        renderPopup={() => null}
        markerContent={() => null}
        style={{ width, height: 300 }}
        report={() => undefined}
        attach={() => undefined}
      />
    </Theme.Provider>
  );
  const mounted = render(tree(400, "inside"));
  const button = mounted.getByRole("button", { name: "inside 0" });
  expect(mounted.getByTestId("sdk-map").contains(button)).toBe(false);
  fireEvent.click(button);
  mounted.rerender(tree(600, "updated"));
  expect(mounted.getByRole("button", { name: "updated 1" })).toBeTruthy();
  mounted.unmount();
});

vi.mock("react-native", async () => {
  const react = await import("react");
  const View = ({
    children,
    style,
    testID,
  }: {
    children?: ReactNode;
    style?: object;
    testID?: string;
  }) =>
    react.createElement(
      "div",
      { "data-layout": JSON.stringify(style), "data-testid": testID },
      children
    );
  return {
    View,
    SafeAreaView: View,
    ScrollView: View,
    Text: View,
    Platform: { OS: "ios" },
    StatusBar: { currentHeight: 0 },
    StyleSheet: { create: (styles: object) => styles },
    Pressable: ({
      children,
      accessibilityLabel,
      onPress,
    }: {
      children?: ReactNode;
      accessibilityLabel?: string;
      onPress?: () => void;
    }) =>
      react.createElement(
        "button",
        { "aria-label": accessibilityLabel, onClick: onPress },
        children
      ),
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      react.createElement("button", { onClick: onPress }, title),
  };
});

test("native TF07 host bounds the map and screen buttons below the toolbar", () => {
  const mounted = render(
    <NativeTf07Screen
      adapter={{} as import("one-map-react").Adapter}
      ornaments={{}}
    />
  );
  const renderer = mounted.getByTestId("sdk-map");
  const host = renderer.parentElement;
  expect(host?.getAttribute("data-layout")).toBe(JSON.stringify({ flex: 1 }));
  expect(host?.contains(mounted.getByRole("button", { name: "Zoom in" }))).toBe(
    true
  );
  expect(
    host?.contains(mounted.getByRole("button", { name: "Locate me" }))
  ).toBe(true);
  expect(
    renderer.contains(mounted.getByRole("button", { name: "Zoom in" }))
  ).toBe(false);
  expect(host?.contains(mounted.getByRole("button", { name: "remount" }))).toBe(
    false
  );
  expect(host?.contains(mounted.getByText("Custom control"))).toBe(false);
  mounted.unmount();
});

test.each([false, true])(
  "TF07 native=%s activates GeoJSON identity without web metadata",
  (native) => {
    const report = vi.fn();
    const view = render(
      <Tf07Scene
        native={native}
        renderLocation={() => null}
        renderNavigation={() => null}
        renderPopup={() => null}
        markerContent={() => null}
        style={{ width: 400, height: 300 }}
        report={report}
        attach={() => undefined}
      />
    );
    act(() =>
      fixture.click?.({
        lngLat: [1, 2],
        point: [3, 4],
        features: [
          {
            type: "Feature",
            id: "707",
            properties: { fixture: "tf07" },
            geometry: { type: "Point", coordinates: [1, 2] },
          },
        ],
      })
    );
    expect(report).toHaveBeenCalledWith("source-click");
    expect(report).toHaveBeenCalledWith("map-click");
    view.unmount();
  }
);

const nativeAdapter: Adapter = {
  backend: "mapbox-native",
  Map: forwardRef<MapRef, MapProps>(() => null),
  Source: () => null,
  Layer: () => null,
  Images: () => null,
  Marker: forwardRef<MarkerRef, MarkerProps>(() => null),
};

test("native target controls distinguish fresh equal inputs from actual renderer readback", async () => {
  fixture.commands = [];
  fixture.observedCenter = [-122.31, 47.6];
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response());
  const mounted = render(
    <NativeTf07Screen adapter={nativeAdapter} ornaments={{}} />
  );
  const map = mounted.getByTestId("sdk-map");
  fireEvent.click(mounted.getByRole("button", { name: "Target A" }));
  const first = fixture.viewState;
  expect(first).toMatchObject({ longitude: -122.34, latitude: 47.61 });
  fireEvent.click(mounted.getByRole("button", { name: "Repeat target" }));
  expect(fixture.viewState).toEqual(first);
  expect(fixture.viewState).not.toBe(first);
  expect(fixture.commands).toEqual([]);
  await act(async () => {
    fireEvent.click(mounted.getByRole("button", { name: "Read renderer" }));
  });
  expect(mounted.getByTestId("tf07-readback").textContent).toContain(
    '"center":[-122.31,47.6]'
  );
  expect(mounted.getByTestId("tf07-requested-target").textContent).toContain(
    '"longitude":-122.34'
  );
  fireEvent.click(mounted.getByRole("button", { name: "Target B" }));
  expect(fixture.viewState).toMatchObject({
    longitude: -122.32,
    latitude: 47.615,
  });
  fireEvent.click(mounted.getByRole("button", { name: "Target A" }));
  expect(fixture.viewState).toEqual(first);
  fireEvent.click(mounted.getByRole("button", { name: "Clear target" }));
  expect(fixture.viewState).toBeUndefined();
  await act(async () => {
    fireEvent.click(mounted.getByRole("button", { name: "Zoom in" }));
  });
  expect(fixture.commands).toEqual(["zoomTo"]);
  expect(mounted.getByTestId("sdk-map")).toBe(map);
  mounted.unmount();
  request.mockRestore();
});

test("each native legacy-prop probe rejects inside map context and resets without replacing map", () => {
  fixture.markers = [];
  fixture.probeInMap = [];
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const mounted = render(
    <NativeTf07Screen adapter={nativeAdapter} ornaments={{}} />
  );
  const map = mounted.getByTestId("sdk-map");
  for (const title of [
    "Reject view draggable",
    "Reject view callback",
    "Reject annotation draggable",
    "Reject annotation callback",
  ]) {
    fireEvent.click(mounted.getByRole("button", { name: title }));
    expect(mounted.getByTestId("tf07-marker-rejection").textContent).toContain(
      "Native Marker does not support dragging."
    );
    expect(mounted.getByTestId("tf07-marker-rejection").textContent).toContain(
      title
    );
    expect(
      fixture.markers.some((props) =>
        String(props.id).startsWith("tf07-rejection")
      )
    ).toBe(false);
    fireEvent.click(mounted.getByRole("button", { name: "Clear rejection" }));
    expect(mounted.getByTestId("tf07-marker-rejection").textContent).toBe(
      "No rejection requested"
    );
    expect(mounted.getByTestId("sdk-map")).toBe(map);
  }
  expect(fixture.probeInMap.length).toBeGreaterThanOrEqual(4);
  expect(fixture.probeInMap.every(Boolean)).toBe(true);
  mounted.unmount();
  errors.mockRestore();
});
