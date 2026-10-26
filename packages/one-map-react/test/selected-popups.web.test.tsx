import { fireEvent, render } from "@testing-library/react";
import {
  createContext,
  type ComponentProps,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { expect, test, vi } from "vite-plus/test";

import { App as MapboxApp } from "../../../examples/web-mapbox/src/app.js";
import { App as MaplibreApp } from "../../../examples/web-maplibre/src/app.js";

const popup = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  closes: 0,
}));
const Theme = createContext("missing");

// This boundary stands in for the selected wrapper, not the renderer or its context.
const RawPopup = (props: {
  children?: ReactNode;
  onOpen?: () => void;
  onClose?: () => void;
}) => {
  useEffect(() => {
    popup.props = props;
  });
  const theme = useContext(Theme);
  const [count, setCount] = useState(0);
  const opened = useEffectEvent(() => props.onOpen?.());
  useEffect(() => {
    opened();
  }, []);
  return (
    <div data-testid="raw-popup">
      <button type="button" onClick={() => setCount(count + 1)}>
        {theme}: {count}
      </button>
      <button
        type="button"
        aria-label="Close selected popup"
        onClick={() => {
          popup.closes += 1;
          props.onClose?.();
        }}
      >
        ×
      </button>
      {props.children}
    </div>
  );
};

vi.mock("one-map-react", async (original) => {
  const actual = await original<typeof import("one-map-react")>();
  const react = await import("react");
  const Content = ({ children }: { children?: ReactNode }) => children;
  const Empty = () => null;
  return {
    ...actual,
    MapSetup: Content,
    Map: react.forwardRef(({ children }: { children?: ReactNode }, _ref) => (
      <div>{children}</div>
    )),
    Marker: Empty,
    Source: Content,
    Layer: Empty,
    Control: Empty,
    NavigationControl: Empty,
    GeolocateControl: Empty,
    ScaleControl: Empty,
  };
});
vi.mock("one-map-react/mapbox-web", () => ({
  adapter: { backend: "mapbox-web" },
  WrapperPopup: (props: ComponentProps<typeof RawPopup>) => (
    <RawPopup {...props} />
  ),
}));
vi.mock("one-map-react/maplibre-web", () => ({
  adapter: { backend: "maplibre-web" },
  WrapperPopup: (props: ComponentProps<typeof RawPopup>) => (
    <RawPopup {...props} />
  ),
}));

test.each([MapboxApp, MaplibreApp])(
  "selected web TF07 app uses raw popup and owns conditional dismissal",
  (App) => {
    window.history.replaceState({}, "", "?tf07=ui");
    popup.closes = 0;
    const tree = (theme: string) => (
      <Theme value={theme}>
        <App />
      </Theme>
    );
    const mounted = render(tree("first"));
    expect(popup.props).toMatchObject({
      longitude: -122.3,
      latitude: 47.63,
      closeOnClick: false,
      closeOnMove: false,
    });
    expect(popup.props).not.toHaveProperty("maxWidth");
    expect(popup.props).not.toHaveProperty("focusAfterOpen");
    fireEvent.click(mounted.getByText("first: 0"));
    mounted.rerender(tree("updated"));
    expect(mounted.getByText("updated: 1")).toBeTruthy();
    const childButton = mounted.container.querySelector(
      '[data-tf07-child="popup"]'
    );
    if (!childButton) throw new Error("Application popup child is missing.");
    fireEvent.click(childButton);
    expect(mounted.getByText("updated: 1")).toBeTruthy();
    fireEvent.click(
      mounted.getByRole("button", { name: "Close selected popup" })
    );
    expect(mounted.queryByTestId("raw-popup")).toBeNull();
    expect(popup.closes).toBe(1);
    fireEvent.click(mounted.getByRole("button", { name: "popup" }));
    expect(mounted.getByText("updated: 0")).toBeTruthy();
    mounted.unmount();
    expect(popup.closes).toBe(1);
  }
);
