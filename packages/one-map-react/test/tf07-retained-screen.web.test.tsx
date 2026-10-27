import { act, fireEvent, render } from "@testing-library/react";
import type { Adapter } from "one-map-react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { NativeTf07RetainedScreen } from "../../../examples/shared/native-tf07-retained-screen.js";

const fixture = vi.hoisted(() => ({
  dimensions: { width: 390, height: 844, scale: 3, fontScale: 1 },
  maps: {} as Record<
    string,
    {
      getCenter: () => Promise<readonly [number, number]>;
      getZoom: () => Promise<number>;
      queryRenderedFeatures: () => Promise<object[]>;
      project: () => Promise<number[]>;
      jumpTo: () => Promise<void>;
    }
  >,
  refresh: vi.fn(async () => undefined),
  post: vi.fn(async (_url: string, _init: { body: string }) => ({})),
  images: [] as Array<{ onLoad: () => void; onError: () => void }>,
}));
vi.mock("react-native", async () => {
  const react = await import("react");
  const View = react.forwardRef(
    ({ children }: { children?: ReactNode }, ref) => {
      react.useImperativeHandle(
        ref,
        () => ({
          measureInWindow: (done: (...values: number[]) => void) =>
            done(0, 100, 300, 250),
        }),
        []
      );
      return react.createElement("div", null, children);
    }
  );
  return {
    View,
    SafeAreaView: View,
    ScrollView: View,
    Text: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      react.createElement("span", { "data-testid": testID }, children),
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      react.createElement("button", { onClick: onPress }, title),
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: ReactNode;
      onPress: () => void;
      accessibilityLabel: string;
    }) =>
      react.createElement(
        "button",
        { onClick: onPress, "aria-label": accessibilityLabel },
        children
      ),
    Image: (props: { onLoad: () => void; onError: () => void }) => {
      fixture.images.push(props);
      return react.createElement("img", { alt: "delayed annotation" });
    },
    useWindowDimensions: () => fixture.dimensions,
  };
});
vi.mock("one-map-react", async () => {
  const react = await import("react");
  const InMarker = react.createContext(false);
  const Content = ({ children }: { children?: ReactNode }) => children;
  return {
    MapSetup: Content,
    Source: Content,
    Layer: () => null,
    Map: react.forwardRef(
      ({ id, children }: { id: string; children?: ReactNode }, ref) => {
        const name = id.endsWith("a") ? "a" : "b";
        const map = react.useMemo(
          () => ({
            getCenter: async () =>
              name === "a"
                ? ([-122.34, 47.61] as const)
                : ([-122.33, 47.615] as const),
            getZoom: async () => (name === "a" ? 11 : 12),
            queryRenderedFeatures: async () => [
              { id: name === "a" ? 1707 : 2707 },
            ],
            project: async () => [120, 120],
            jumpTo: async () => undefined,
          }),
          [name]
        );
        fixture.maps[id] = map;
        react.useImperativeHandle(ref, () => map, [map]);
        return react.createElement("div", { "data-testid": id }, children);
      }
    ),
    Marker: react.forwardRef(
      (
        { children, renderMode }: { children?: ReactNode; renderMode?: string },
        ref
      ) => {
        react.useImperativeHandle(
          ref,
          () => ({ refresh: fixture.refresh }),
          []
        );
        return react.createElement(
          InMarker.Provider,
          { value: true },
          react.createElement(
            "div",
            {
              "data-testid":
                renderMode === "annotation" ? "annotation" : "live-marker",
            },
            children
          )
        );
      }
    ),
    useMap: (id: string) => {
      if (!react.useContext(InMarker))
        throw new Error("Named lookup must run inside the live marker portal.");
      return fixture.maps[id];
    },
  };
});

const mount = () => {
  fixture.images = [];
  fixture.post.mockClear();
  fixture.refresh.mockClear();
  vi.stubGlobal("fetch", fixture.post);
  return render(<NativeTf07RetainedScreen adapter={{} as Adapter} />);
};

test("both live marker children retain provider/local state and query their own named renderer", async () => {
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Map A initial 0" }));
    fireEvent.click(view.getByRole("button", { name: "Map B initial 0" }));
  });
  fireEvent.click(view.getByText("Theme"));
  expect(view.getByRole("button", { name: "Map A updated 1" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Map B updated 1" })).toBeTruthy();
  fireEvent.click(view.getByText("Resize"));
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Map A updated 1" }));
    fireEvent.click(view.getByRole("button", { name: "Map B updated 1" }));
  });
  await act(async () => fireEvent.click(view.getByText("Read focus")));
  const result = JSON.parse(
    fixture.post.mock.calls.at(-1)?.[1]?.body as string
  );
  expect(result.observations[0].children.a).toMatchObject({
    theme: "updated",
    count: 2,
    zoom: 11,
  });
  expect(result.observations[0].children.b).toMatchObject({
    theme: "updated",
    count: 2,
    zoom: 12,
  });
  expect(result.observations[0].window.scale).toBe(3);
  expect(result.observations[0].a.bounds).toEqual([0, 100, 300, 250]);
  view.unmount();
  vi.unstubAllGlobals();
});

test("annotation refresh waits for actual delayed image load, ignores retired load and clears timers on teardown", async () => {
  vi.useFakeTimers();
  const view = mount();
  fireEvent.click(view.getByText("Image"));
  expect(fixture.refresh).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(200));
  const firstImage = fixture.images.at(-1);
  if (!firstImage) throw new Error("Delayed image did not mount.");
  expect(view.getByAltText("delayed annotation")).toBeTruthy();
  expect(fixture.refresh).not.toHaveBeenCalled();
  await act(async () => firstImage.onLoad());
  expect(fixture.refresh).toHaveBeenCalledTimes(1);
  fireEvent.click(view.getByText("Image"));
  await act(async () => firstImage.onLoad());
  expect(fixture.refresh).toHaveBeenCalledTimes(1);
  view.unmount();
  act(() => vi.runAllTimers());
  expect(fixture.refresh).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("a newer read or layout invalidation prevents stale renderer batches from publishing", async () => {
  const view = mount();
  let finish: (value: readonly [number, number]) => void = () => {};
  fixture.maps["tf07-focus-a"].getCenter = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  fireEvent.click(view.getByText("Read focus"));
  fireEvent.click(view.getByText("Resize"));
  await act(async () => finish([-122.34, 47.61]));
  expect(fixture.post).not.toHaveBeenCalled();
  fireEvent.click(view.getByText("Read focus"));
  view.unmount();
  await act(async () => finish([-122.34, 47.61]));
  expect(fixture.post).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("retired failed reads cannot add an error to the current layout", async () => {
  const view = mount();
  let reject: (error: Error) => void = () => {};
  fixture.maps["tf07-focus-a"].getCenter = () =>
    new Promise((_resolve, fail) => {
      reject = fail;
    });
  fireEvent.click(view.getByText("Read focus"));
  fireEvent.click(view.getByText("Resize"));
  await act(async () => reject(new Error("retired renderer")));
  expect(view.getByTestId("tf07-focused-status").textContent).not.toBe(
    "read-error"
  );
  expect(fixture.post).not.toHaveBeenCalled();
  view.unmount();
  vi.unstubAllGlobals();
});

test("only the latest of overlapping renderer reads is published", async () => {
  const view = mount();
  const pending: Array<(value: readonly [number, number]) => void> = [];
  fixture.maps["tf07-focus-a"].getCenter = () =>
    new Promise((resolve) => pending.push(resolve));
  fireEvent.click(view.getByText("Read focus"));
  fireEvent.click(view.getByText("Read focus"));
  const current = pending[1];
  if (!current) throw new Error("Second read did not start.");
  await act(async () => current([-122.34, 47.61]));
  expect(fixture.post).toHaveBeenCalledTimes(1);
  const retired = pending[0];
  if (!retired) throw new Error("First read did not start.");
  await act(async () => retired([-122.4, 47.7]));
  expect(fixture.post).toHaveBeenCalledTimes(1);
  view.unmount();
  vi.unstubAllGlobals();
});

test("a current annotation refresh failure stays observable", async () => {
  vi.useFakeTimers();
  const view = mount();
  fixture.refresh.mockRejectedValueOnce(new Error("native annotation failed"));
  fireEvent.click(view.getByText("Image"));
  act(() => vi.advanceTimersByTime(200));
  const current = fixture.images.at(-1);
  if (!current) throw new Error("Delayed image did not mount.");
  await act(async () => current.onLoad());
  expect(view.getByTestId("tf07-focused-status").textContent).toBe(
    "image-error"
  );
  view.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("a named child read from an old provider epoch cannot certify the new theme", async () => {
  const view = mount();
  let finish: (value: readonly [number, number]) => void = () => {};
  const map = fixture.maps["tf07-focus-a"];
  if (!map) throw new Error("Map A did not attach.");
  map.getCenter = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  fireEvent.click(view.getByRole("button", { name: "Map A initial 0" }));
  fireEvent.click(view.getByText("Theme"));
  await act(async () => finish([-122.34, 47.61]));
  expect(view.getByTestId("tf07-focused-status").textContent).not.toBe(
    "a-child"
  );
  expect(view.getByRole("button", { name: "Map A updated 1" })).toBeTruthy();
  view.unmount();
  vi.unstubAllGlobals();
});

test("current renderer query failures remain visible", async () => {
  const view = mount();
  const map = fixture.maps["tf07-focus-a"];
  if (!map) throw new Error("Map A did not attach.");
  const query = map.queryRenderedFeatures;
  map.queryRenderedFeatures = async () => {
    throw new Error("renderer query failed");
  };
  await act(async () => fireEvent.click(view.getByText("Read focus")));
  expect(view.getByTestId("tf07-focused-status").textContent).toBe(
    "read-error"
  );
  expect(fixture.post).not.toHaveBeenCalled();
  map.queryRenderedFeatures = query;
  await act(async () => fireEvent.click(view.getByText("Read focus")));
  const result = JSON.parse(
    fixture.post.mock.calls.at(-1)?.[1]?.body as string
  );
  expect(result.observations.at(-1).events["read-error"]).toBe(1);
  view.unmount();
  vi.unstubAllGlobals();
});

test("more than twenty actual reads retain initial provider evidence", async () => {
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Map A initial 0" }));
    fireEvent.click(view.getByRole("button", { name: "Map B initial 0" }));
  });
  await act(async () => fireEvent.click(view.getByText("Read focus")));
  fireEvent.click(view.getByText("Theme"));
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Map A updated 1" }));
    fireEvent.click(view.getByRole("button", { name: "Map B updated 1" }));
  });
  for (let index = 0; index < 22; index += 1)
    await act(async () => fireEvent.click(view.getByText("Read focus")));
  const posted = fixture.post.mock.calls.at(-1);
  if (!posted) throw new Error("Screen did not publish actual reads.");
  const result = JSON.parse(posted[1].body);
  expect(result.observations).toHaveLength(23);
  expect(result.observations[0].children.a).toMatchObject({
    theme: "initial",
    count: 1,
  });
  expect(result.observations[0].children.b).toMatchObject({
    theme: "initial",
    count: 1,
  });
  expect(result.observations.at(-1).children.a).toMatchObject({
    theme: "updated",
    count: 2,
  });
  expect(result.observations.at(-1).children.b).toMatchObject({
    theme: "updated",
    count: 2,
  });
  view.unmount();
  vi.unstubAllGlobals();
});
