import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Adapter } from "one-map-react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { NativeTf07FocusedScreen } from "../src/scenarios/native-tf07-focused-screen.js";

const fixture = vi.hoisted(() => ({
  move: vi.fn(async () => undefined),
  mapOptions: [] as Array<unknown>,
  mapClicks: new globalThis.Map<
    number,
    (event: { features: readonly object[] }) => void
  >(),
  subscribe: () => () => undefined,
  firstZoom: vi.fn(async () => 11),
  secondZoom: vi.fn(async () => 12),
  dimensions: { width: 400, height: 800, scale: 1, fontScale: 1 },
}));
vi.mock("one-map-react", async () => {
  const react = await import("react");
  const Parent = ({ children }: { children?: ReactNode }) => children;
  return {
    MapSetup: Parent,
    Map: react.forwardRef(
      (
        {
          children,
          options,
          minZoom,
          onClick,
        }: {
          children?: ReactNode;
          options?: unknown;
          minZoom?: number;
          onClick?: (event: { features: readonly object[] }) => void;
        },
        ref
      ) => {
        fixture.mapOptions.push(options);
        if (onClick) fixture.mapClicks.set(minZoom ?? 0, onClick);
        react.useImperativeHandle(
          ref,
          () => ({
            easeTo: fixture.move,
            getCenter: async () => [0, 0],
            queryRenderedFeatures: async () => [],
            project: async () => [1, 2],
            getZoom: minZoom === 12 ? fixture.secondZoom : fixture.firstZoom,
          }),
          [minZoom]
        );
        return react.createElement(
          "div",
          { "data-testid": "sdk-map" },
          children
        );
      }
    ),
    Source: Parent,
    Marker: Parent,
    Layer: () => null,
    UserLocation: () => null,
  };
});
vi.mock("react-native", async () => {
  const react = await import("react");
  const Parent = ({
    children,
    style,
  }: {
    children?: ReactNode;
    style?: unknown;
  }) =>
    react.createElement(
      "div",
      { "data-layout": JSON.stringify(style) },
      children
    );
  return {
    View: Parent,
    SafeAreaView: Parent,
    Text: Parent,
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
      disabled,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
      disabled?: boolean;
    }) =>
      react.createElement(
        "button",
        { onClick: onPress, "aria-label": accessibilityLabel, disabled },
        children
      ),
    Image: () => null,
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      react.createElement("button", { onClick: onPress }, title),
    Platform: { OS: "android" },
    StatusBar: { currentHeight: 0 },
    useWindowDimensions: () => fixture.dimensions,
  };
});

test("focused status updates retain rejection and delayed location ownership; removal retires a stale result", async () => {
  // The selected backend is irrelevant to this fixture/provider lifecycle regression.
  const adapter = { backend: "mapbox-native" } as Adapter;
  const mounted = render(<NativeTf07FocusedScreen adapter={adapter} />);
  expect(fixture.mapOptions).toContainEqual({
    compassPosition: { top: 64, right: 8 },
  });
  expect(fixture.mapOptions).toContainEqual({
    compassPosition: { top: 104, right: 8 },
  });
  expect(
    screen
      .getByRole("button", { name: "Locate me" })
      .parentElement?.getAttribute("data-layout")
  ).toBe(JSON.stringify({ position: "absolute", top: 8, right: 8 }));
  fireEvent.click(screen.getByText("Locate me"));
  await waitFor(() =>
    expect(screen.getByText(/provider-error; provider reject/)).toBeTruthy()
  );
  expect(fixture.move).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Delay"));
  fireEvent.click(screen.getByText("Locate me"));
  expect(screen.getByText(/provider-call; provider delay/)).toBeTruthy();
  expect(fixture.move).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByText("Resolve")));
  await waitFor(() =>
    expect(fixture.move).toHaveBeenCalledWith({
      center: [-122.33, 47.62],
      zoom: 14,
    })
  );
  expect(screen.getByText(/provider-location; provider delay/)).toBeTruthy();

  fireEvent.click(screen.getByText("Locate me"));
  fireEvent.click(screen.getByText("Drop locate"));
  await act(async () => fireEvent.click(screen.getByText("Resolve")));
  expect(fixture.move).toHaveBeenCalledTimes(1);
  mounted.unmount();
});

test("screen children retain providers and state across resize and address their own maps", async () => {
  const adapter = { backend: "mapbox-native" } as Adapter;
  const mounted = render(<NativeTf07FocusedScreen adapter={adapter} />);
  const first = screen.getByRole("button", { name: "Map A initial 0" });
  const second = screen.getByRole("button", { name: "Map B initial 0" });
  for (const map of screen.getAllByTestId("sdk-map")) {
    expect(map.contains(first)).toBe(false);
    expect(map.contains(second)).toBe(false);
  }
  fireEvent.click(first);
  await waitFor(() => expect(fixture.firstZoom).toHaveBeenCalledTimes(1));
  expect(fixture.secondZoom).not.toHaveBeenCalled();
  fixture.dimensions = { ...fixture.dimensions, width: 800, height: 400 };
  mounted.rerender(<NativeTf07FocusedScreen adapter={adapter} />);
  fireEvent.click(screen.getByText("Theme"));
  expect(screen.getByRole("button", { name: "Map A updated 1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Map B updated 0" }));
  await waitFor(() => expect(fixture.secondZoom).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Map B updated 1" })).toBeTruthy();
  mounted.unmount();
});

vi.mock("../src/scenarios/native-viewport.js", () => ({
  measureNativeViewport: async () => ({ x: 0, y: 0, width: 100, height: 100 }),
}));

test("focused feature activation uses GeoJSON IDs and keeps two map routes independent", async () => {
  const fetch = vi.fn(async () => new Response());
  vi.stubGlobal("fetch", fetch);
  try {
    const view = render(
      <NativeTf07FocusedScreen
        adapter={{ backend: "mapbox-native" } as Adapter}
      />
    );
    const feature = (id: number) => ({
      type: "Feature",
      id,
      properties: { fixture: "tf07-focused" },
      geometry: { type: "Point", coordinates: [1, 2] },
    });
    act(() =>
      fixture.mapClicks.get(0)?.({ features: [feature(708), feature(707)] })
    );
    act(() => fixture.mapClicks.get(0)?.({ features: [feature(707)] }));
    act(() => fixture.mapClicks.get(12)?.({ features: [feature(42)] }));
    fireEvent.click(screen.getByText("Read focus"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const observation = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body
    ) as { counts: Record<string, number> };
    expect(observation.counts).toMatchObject({
      "high-click": 1,
      "a-map-click": 2,
      "vector-click": 1,
      "b-map-click": 1,
    });
    expect(observation.counts["low-click"]).toBe(1);
    view.unmount();
  } finally {
    vi.unstubAllGlobals();
  }
});
