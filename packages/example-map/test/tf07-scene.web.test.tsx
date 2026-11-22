import { act, fireEvent, render } from "@testing-library/react";
import type { ViewState } from "one-map-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { expect, test, vi } from "vite-plus/test";

import { nativeSceneComponents } from "../src/scenarios/native-scene-components.js";
import { NativeTf07Screen } from "../src/scenarios/native-tf07-screen.js";
import { Tf07Scene, type Tf07Probe } from "../src/scenarios/tf07-scene.js";

const fixture = vi.hoisted(() => ({
  markers: [] as Array<Record<string, unknown>>,
  viewState: undefined as ViewState | undefined,
  observedCenter: [-122.31, 47.6],
  zoom: 11,
  commands: [] as string[],
  click: undefined as
    | undefined
    | ((event: {
        lngLat: readonly [number, number];
        point: readonly [number, number];
        features: readonly object[];
      }) => void),
}));
vi.mock("one-map-react/native-extensions", async () => {
  const legacy = await import("one-map-react/legacy");
  return {
    Images: () => null,
    UserLocation: Reflect.get(legacy, "UserLocation"),
  };
});

vi.mock("one-map-react/legacy", async () => {
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
      fixture.markers.push(props);
      return null;
    },
    UserLocation: () => null,
  };
});

test("TF07 native supplies only supported marker interaction props", () => {
  fixture.markers = [];
  const view = render(
    <Tf07Scene
      renderLocation={() => null}
      renderNavigation={() => null}
      components={nativeSceneComponents}
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
      expect(marker).not.toHaveProperty(name);
    }
  }
  view.unmount();
});

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
      components={nativeSceneComponents}
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
        components={nativeSceneComponents}
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
    useWindowDimensions: () => ({
      width: 400,
      height: 800,
      scale: 2,
      fontScale: 1,
    }),
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

test("TF07 native activates GeoJSON identity without web metadata", () => {
  const report = vi.fn();
  const view = render(
    <Tf07Scene
      components={nativeSceneComponents}
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
});
