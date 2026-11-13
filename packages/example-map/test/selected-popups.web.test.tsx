import { act, fireEvent, render } from "@testing-library/react";
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

import { App as MapboxApp } from "../src/scenarios/mapbox-web.js";
import { App as MaplibreApp } from "../src/scenarios/maplibre-web.js";

const popup = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  closes: 0,
  scale: [] as Array<Record<string, unknown>>,
  attribution: [] as Array<Record<string, unknown>>,
  navigation: [] as Array<Record<string, unknown>>,
  fullscreen: [] as Array<Record<string, unknown>>,
  location: [] as Array<Record<string, unknown>>,
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

    UserLocation: Empty,
  };
});
vi.mock("one-map-react/mapbox-web", () => ({
  adapter: { backend: "mapbox-web" },
  Map: ({ children }: { children?: ReactNode }) => children,
  WrapperGeolocateControl: (props: Record<string, unknown>) => {
    popup.location.push(props);
    return null;
  },
  WrapperNavigationControl: (props: Record<string, unknown>) => {
    popup.navigation.push(props);
    return null;
  },
  WrapperScaleControl: (props: Record<string, unknown>) => {
    popup.scale.push(props);
    return null;
  },
  WrapperAttributionControl: (props: Record<string, unknown>) => {
    popup.attribution.push(props);
    return null;
  },
  WrapperFullscreenControl: (props: Record<string, unknown>) => {
    popup.fullscreen.push(props);
    return null;
  },
  WrapperPopup: (props: ComponentProps<typeof RawPopup>) => (
    <RawPopup {...props} />
  ),
}));
vi.mock("one-map-react/maplibre-web", () => ({
  adapter: { backend: "maplibre-web" },
  Map: ({ children }: { children?: ReactNode }) => children,
  WrapperGeolocateControl: (props: Record<string, unknown>) => {
    popup.location.push(props);
    return null;
  },
  WrapperNavigationControl: (props: Record<string, unknown>) => {
    popup.navigation.push(props);
    return null;
  },
  WrapperScaleControl: (props: Record<string, unknown>) => {
    popup.scale.push(props);
    return null;
  },
  WrapperAttributionControl: (props: Record<string, unknown>) => {
    popup.attribution.push(props);
    return null;
  },
  WrapperFullscreenControl: (props: Record<string, unknown>) => {
    popup.fullscreen.push(props);
    return null;
  },
  WrapperPopup: (props: ComponentProps<typeof RawPopup>) => (
    <RawPopup {...props} />
  ),
}));

test.each([MapboxApp, MaplibreApp])(
  "selected web TF07 app uses raw popup and owns conditional dismissal",
  (App) => {
    popup.closes = 0;
    const tree = (theme: string) => (
      <Theme value={theme}>
        <App scenario="tf07" />
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

test.each([MapboxApp, MaplibreApp])(
  "selected web entries render raw navigation for TF07/TF08 and raw fullscreen for focused UI",
  async (App) => {
    for (const scenario of ["tf07", "tf08", "tf07-focused"] as const) {
      popup.navigation = [];
      popup.fullscreen = [];
      const view = render(<App scenario={scenario} />);
      if (scenario === "tf08") {
        await act(async () => {
          await window.__oneMapTf08?.command("configure", {
            mode: "coverage-ornaments",
          });
        });
      }
      expect(popup.navigation.length).toBeGreaterThan(0);
      expect(popup.navigation.at(-1)).toEqual(
        scenario !== "tf07-focused" ? { position: "top-right" } : {}
      );
      expect(popup.fullscreen.length > 0).toBe(scenario === "tf07-focused");
      view.unmount();
    }
  }
);

test.each([MapboxApp, MaplibreApp])(
  "selected web entries own raw SDK scales, mutable units and coverage attribution placement",
  async (App) => {
    popup.scale = [];
    popup.attribution = [];
    const view = render(<App scenario="tf07" />);
    expect(popup.scale.at(-1)).toEqual({
      position: "bottom-left",
      unit: "metric",
    });
    fireEvent.click(view.getByRole("button", { name: "units" }));
    expect(popup.scale.at(-1)).toEqual({
      position: "bottom-left",
      unit: "imperial",
    });
    view.unmount();
    const coverage = render(<App scenario="tf08" />);
    await act(async () => {
      await window.__oneMapTf08?.command("configure", {
        mode: "coverage-ornaments",
      });
    });
    expect(popup.attribution.at(-1)).toEqual({ position: "bottom-right" });
    expect(popup.scale.at(-1)).toEqual({ position: "bottom-left" });
    coverage.unmount();
  }
);

test.each([MapboxApp, MaplibreApp])(
  "selected web application location delegates acquisition while common supplied data owns the single puck",
  (App) => {
    popup.location = [];
    const tf07 = render(<App scenario="tf07" />);
    expect(popup.location.at(-1)).toMatchObject({
      position: "top-left",
      showUserLocation: false,
      fitBoundsOptions: { maxZoom: 11 },
      onGeolocate: expect.any(Function),
      onError: expect.any(Function),
    });
    tf07.unmount();
    const tf08 = render(<App scenario="tf08" />);
    expect(popup.location.at(-1)).toMatchObject({
      position: "top-right",
      showUserLocation: false,
      fitBoundsOptions: { maxZoom: 12 },
    });
    tf08.unmount();
  }
);
