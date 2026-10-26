import { act, fireEvent, render } from "@testing-library/react";
import {
  createContext,
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
  const Content = ({ children }: { readonly children?: ReactNode }) => children;
  return {
    MapSetup: Content,
    Map: react.forwardRef(
      (
        props: {
          readonly children?: ReactNode;
          readonly onClick?: typeof fixture.click;
        },
        _ref
      ) => {
        fixture.click = props.onClick;
        return react.createElement(
          "div",
          { "data-testid": "sdk-map" },
          props.children
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
  }: {
    children?: ReactNode;
    style?: object;
  }) =>
    react.createElement(
      "div",
      { "data-layout": JSON.stringify(style) },
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
