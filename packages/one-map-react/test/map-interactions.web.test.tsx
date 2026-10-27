import { act, renderHook } from "@testing-library/react";
import { startTransition, Suspense } from "react";
import { expect, test, vi } from "vite-plus/test";

import type { MapRef } from "../src/contracts/camera-types.js";
import type { ClickEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import { useMapInteractions } from "../src/facade/use-map-interactions.js";

const event: ClickEvent = { lngLat: [1, 2], point: [3, 4] };
const props: MapProps = {
  initialViewState: {
    longitude: 1,
    latitude: 2,
    zoom: 3,
    bearing: 0,
    pitch: 0,
  },
  mapStyle: { version: 8, sources: {}, layers: [] },
};
test("callback teardown suppresses retained movement and click handlers", async () => {
  const onMove = vi.fn(() => mounted.unmount());
  const onClick = vi.fn();
  const mounted = renderHook(() =>
    useMapInteractions({ ...props, onMove, onClick }, { current: null })
  );
  const interactions = mounted.result.current;
  act(() =>
    interactions.move({ viewState: props.initialViewState, origin: "user" })
  );
  act(() =>
    interactions.move({ viewState: props.initialViewState, origin: "user" })
  );
  await act(async () => interactions.click(event));
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onClick).not.toHaveBeenCalled();
});

test("custom forwarding proxies retain common queries", async () => {
  const query = vi.fn<MapRef["queryRenderedFeatures"]>().mockResolvedValue([]);
  const unknownMethod = vi.fn();
  const map = new Proxy(
    { queryRenderedFeatures: query },
    {
      get: (target, key) =>
        (target as Record<PropertyKey, unknown>)[key] ?? unknownMethod,
    }
  ) as unknown as MapRef;
  const mounted = renderHook(() =>
    useMapInteractions(
      { ...props, interactiveLayerIds: ["route-line"] },
      { current: map }
    )
  );
  await act(async () => mounted.result.current.click(event));
  expect(unknownMethod).not.toHaveBeenCalled();
  expect(query).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenLastCalledWith(event.point, {
    layers: ["route-line"],
  });
});

test("detached filtered clicks report failure without delivering a click", async () => {
  const onError = vi.fn();
  const onClick = vi.fn();
  const mounted = renderHook(() =>
    useMapInteractions(
      {
        ...props,
        onError,
        onClick,
        interactiveLayerIds: ["route-line"],
      },
      { current: null }
    )
  );
  await act(async () => mounted.result.current.click(event));
  expect(onError).toHaveBeenCalledExactlyOnceWith({
    error: new Error("Map is not attached."),
  });
  expect(onClick).not.toHaveBeenCalled();
});

test.each(["detach", "replace", "unmount", "current"] as const)(
  "pending map query %s keeps delivery bound to its concrete owner",
  async (change) => {
    let resolve!: (
      features: Awaited<ReturnType<MapRef["queryRenderedFeatures"]>>
    ) => void;
    const query = vi.fn<MapRef["queryRenderedFeatures"]>(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const original = { queryRenderedFeatures: query } as unknown as MapRef;
    const ref = { current: original as MapRef | null };
    const onClick = vi.fn();
    const updated = vi.fn();
    const onError = vi.fn();
    const mounted = renderHook(
      ({ callback }) =>
        useMapInteractions(
          {
            ...props,
            onClick: callback,
            onError,
            interactiveLayerIds: ["lower", "upper"],
          },
          ref
        ),
      { initialProps: { callback: onClick } }
    );
    const pending = mounted.result.current.click(event);
    expect(query).toHaveBeenCalledExactlyOnceWith(event.point, {
      layers: ["lower", "upper"],
    });
    if (change === "detach") ref.current = null;
    if (change === "replace")
      ref.current = { queryRenderedFeatures: vi.fn() } as unknown as MapRef;
    if (change === "unmount") mounted.unmount();
    if (change === "current") mounted.rerender({ callback: updated });
    const features = [
      {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [1, 2] },
        source: "upper-source",
        layer: { id: "upper" },
      },
      {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [1, 2] },
        source: "lower-source",
        layer: { id: "lower" },
      },
    ];
    await act(async () => {
      resolve(features);
      await pending;
    });
    expect(onClick).not.toHaveBeenCalled();
    if (change === "current")
      expect(updated).toHaveBeenCalledExactlyOnceWith({ ...event, features });
    else expect(updated).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  }
);

test.each([false, true])(
  "query rejection is observable only for current owner (replaced=%s)",
  async (replaced) => {
    let reject!: (error: Error) => void;
    const query = vi.fn<MapRef["queryRenderedFeatures"]>(
      () =>
        new Promise((_done, fail) => {
          reject = fail;
        })
    );
    const ref = {
      current: { queryRenderedFeatures: query } as unknown as MapRef,
    };
    const onError = vi.fn();
    const onClick = vi.fn();
    const mounted = renderHook(() =>
      useMapInteractions(
        { ...props, onError, onClick, interactiveLayerIds: ["point"] },
        ref
      )
    );
    const pending = mounted.result.current.click(event);
    if (replaced) ref.current = {} as MapRef;
    const error = new Error("SDK query rejected");
    await act(async () => {
      reject(error);
      await pending;
    });
    if (replaced) expect(onError).not.toHaveBeenCalled();
    else expect(onError).toHaveBeenCalledExactlyOnceWith({ error });
    expect(onClick).not.toHaveBeenCalled();
  }
);

test("simultaneous maps keep feature results and callbacks local", async () => {
  const firstClick = vi.fn();
  const secondClick = vi.fn();
  const firstFeatures = [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [1, 2] },
      source: "first",
      layer: { id: "a" },
    },
  ];
  const secondFeatures = [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [1, 2] },
      source: "second",
      layer: { id: "b" },
    },
  ];
  const firstQuery = vi
    .fn<MapRef["queryRenderedFeatures"]>()
    .mockResolvedValue(firstFeatures);
  const secondQuery = vi
    .fn<MapRef["queryRenderedFeatures"]>()
    .mockResolvedValue(secondFeatures);
  const first = renderHook(() =>
    useMapInteractions(
      { ...props, onClick: firstClick, interactiveLayerIds: ["a"] },
      { current: { queryRenderedFeatures: firstQuery } as unknown as MapRef }
    )
  );
  const second = renderHook(() =>
    useMapInteractions(
      { ...props, onClick: secondClick, interactiveLayerIds: ["b"] },
      { current: { queryRenderedFeatures: secondQuery } as unknown as MapRef }
    )
  );
  await act(async () => {
    await Promise.all([
      first.result.current.click(event),
      second.result.current.click(event),
    ]);
  });
  expect(firstClick).toHaveBeenCalledExactlyOnceWith({
    ...event,
    features: firstFeatures,
  });
  expect(secondClick).toHaveBeenCalledExactlyOnceWith({
    ...event,
    features: secondFeatures,
  });
});

test.each(["replace", "unmount"] as const)(
  "a synchronous SDK query %s suppresses its former map callback",
  async (change) => {
    const ref = { current: {} as MapRef };
    const onClick = vi.fn();
    const query = vi.fn<MapRef["queryRenderedFeatures"]>(() => {
      if (change === "replace") ref.current = {} as MapRef;
      else mounted.unmount();
      return Promise.resolve([]);
    });
    ref.current = { queryRenderedFeatures: query } as unknown as MapRef;
    const mounted = renderHook(() =>
      useMapInteractions(
        { ...props, onClick, interactiveLayerIds: ["point"] },
        ref
      )
    );
    await act(async () => mounted.result.current.click(event));
    expect(query).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  }
);

test("a suspended transition cannot replace the committed click callback", async () => {
  let resolve!: (
    features: Awaited<ReturnType<MapRef["queryRenderedFeatures"]>>
  ) => void;
  const query = vi.fn<MapRef["queryRenderedFeatures"]>(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const ref = {
    current: { queryRenderedFeatures: query } as unknown as MapRef,
  };
  const committed = vi.fn();
  const suspended = vi.fn();
  const never = new Promise<void>(() => {});
  const mounted = renderHook(
    ({ callback, paused }) => {
      const interactions = useMapInteractions(
        { ...props, onClick: callback, interactiveLayerIds: ["point"] },
        ref
      );
      if (paused) throw never;
      return interactions;
    },
    {
      initialProps: { callback: committed, paused: false },
      wrapper: ({ children }) => (
        <Suspense fallback={null}>{children}</Suspense>
      ),
    }
  );
  const pending = mounted.result.current.click(event);
  act(() =>
    startTransition(() =>
      mounted.rerender({ callback: suspended, paused: true })
    )
  );
  await act(async () => {
    resolve([]);
    await pending;
  });
  expect(committed).toHaveBeenCalledExactlyOnceWith({ ...event, features: [] });
  expect(suspended).not.toHaveBeenCalled();
});

test("a suspended transition cannot replace the committed movement callback", () => {
  const committed = vi.fn();
  const suspended = vi.fn();
  const never = new Promise<void>(() => {});
  const mounted = renderHook(
    ({ callback, paused }) => {
      const interactions = useMapInteractions(
        { ...props, onMove: callback },
        { current: null }
      );
      if (paused) throw never;
      return interactions;
    },
    {
      initialProps: { callback: committed, paused: false },
      wrapper: ({ children }) => (
        <Suspense fallback={null}>{children}</Suspense>
      ),
    }
  );
  act(() =>
    startTransition(() =>
      mounted.rerender({ callback: suspended, paused: true })
    )
  );
  const movement = {
    viewState: props.initialViewState,
    origin: "user" as const,
  };
  act(() => mounted.result.current.move(movement));
  expect(committed).toHaveBeenCalledExactlyOnceWith(movement);
  expect(suspended).not.toHaveBeenCalled();
});
