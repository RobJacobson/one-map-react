import { act, fireEvent, render } from "@testing-library/react";
import * as nativeEntry from "one-map-react/mapbox-native";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { expect, test, vi } from "vite-plus/test";

import { createNativeSceneComponents } from "../src/scenarios/native-scene-components.js";
import { NativeTf07Screen } from "../src/scenarios/native-tf07-screen.js";
import { Tf07Scene, type Tf07Probe } from "../src/scenarios/tf07-scene.js";

vi.mock("one-map-react/native-extensions", () => ({
  Images: () => null,
  UserLocation: () => null,
}));

vi.mock("one-map-react/mapbox-native", async () => {
  const react = await import("react");
  const Content = ({ children }: { readonly children?: ReactNode }) => children;
  return {
    MapProvider: Content,
    useMap: () => ({}),
    Map: react.forwardRef<HTMLDivElement, { readonly children?: ReactNode }>(
      ({ children }, ref) =>
        react.createElement("div", { ref, "data-testid": "sdk-map" }, children)
    ),
    Source: Content,
    Layer: () => null,
    Marker: () => null,
  };
});

const nativeSceneComponents = createNativeSceneComponents(
  "mapbox-native",
  nativeEntry
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
    <NativeTf07Screen components={nativeSceneComponents} ornaments={{}} />
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
