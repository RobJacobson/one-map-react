import { act, renderHook } from "@testing-library/react";
import { startTransition, Suspense } from "react";
import { expect, test, vi } from "vite-plus/test";

import type { MapRef } from "../src/contracts/camera-types.js";
import type { ClickEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import { useMapInteractions } from "../src/facade/use-map-interactions.js";

type QueryRenderedFeatures = MapRef["queryRenderedFeatures"];

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

test("a retained filtered click skips the query after unmount", async () => {
  const query = vi.fn<QueryRenderedFeatures>().mockResolvedValue([]);
  const onClick = vi.fn();
  const onError = vi.fn();
  const map = { queryRenderedFeatures: query };
  const mounted = renderHook(() =>
    useMapInteractions(
      { ...props, onClick, onError, interactiveLayerIds: ["route-line"] },
      { current: map }
    )
  );
  const { click } = mounted.result.current;
  mounted.unmount();

  await act(async () => click(event));

  expect(query).not.toHaveBeenCalled();
  expect(onClick).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

test("custom forwarding proxies retain common queries", async () => {
  const query = vi.fn<QueryRenderedFeatures>().mockResolvedValue([]);
  const unknownMethod = vi.fn();
  const map = new Proxy(
    { queryRenderedFeatures: query },
    {
      get: (target, key) => Reflect.get(target, key) ?? unknownMethod,
    }
  );
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
      features: Awaited<ReturnType<QueryRenderedFeatures>>
    ) => void;
    const query = vi.fn<QueryRenderedFeatures>(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const original = { queryRenderedFeatures: query };
    const ref: { current: typeof original | null } = { current: original };
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
      ref.current = { queryRenderedFeatures: vi.fn<QueryRenderedFeatures>() };
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
    const query = vi.fn<QueryRenderedFeatures>(
      () =>
        new Promise((_done, fail) => {
          reject = fail;
        })
    );
    const ref = {
      current: { queryRenderedFeatures: query },
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
    if (replaced)
      ref.current = { queryRenderedFeatures: vi.fn<QueryRenderedFeatures>() };
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

test("an unfiltered tap waits for a preceding query error and uses the current callbacks", async () => {
  let reject!: (error: Error) => void;
  const query = vi.fn<QueryRenderedFeatures>(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      })
  );
  const ref = {
    current: { queryRenderedFeatures: query },
  };
  const delivered: unknown[] = [];
  const oldError = vi.fn();
  const error = new Error("Feature query failed");
  const mounted = renderHook(
    (filtered: boolean) =>
      useMapInteractions(
        {
          interactiveLayerIds: filtered ? ["poi"] : undefined,
          onClick: (tap) => delivered.push(tap),
          onError: filtered
            ? oldError
            : (failure) => delivered.push(failure.error),
        },
        ref
      ),
    { initialProps: true }
  );
  const first = mounted.result.current.click(event);
  mounted.rerender(false);
  const second = mounted.result.current.click(event);
  expect(delivered).toEqual([]);
  reject(error);
  await Promise.all([first, second]);
  expect(delivered).toEqual([error, event]);
  expect(oldError).not.toHaveBeenCalled();
  expect(query).toHaveBeenCalledTimes(1);

  const idle = mounted.result.current.click(event);
  expect(delivered).toEqual([error, event, event]);
  await idle;
});

test("a replacement map delivers taps while the previous map's first query is stalled", async () => {
  let finish!: (features: []) => void;
  const query = vi
    .fn<QueryRenderedFeatures>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce([]);
  const ref = {
    current: { queryRenderedFeatures: query },
  };
  const onClick = vi.fn();
  const mounted = renderHook(() =>
    useMapInteractions({ interactiveLayerIds: ["poi"], onClick }, ref)
  );
  const first = mounted.result.current.click(event);
  const second = mounted.result.current.click(event);
  expect(query).toHaveBeenCalledTimes(2);
  expect(onClick).not.toHaveBeenCalled();

  ref.current = {
    queryRenderedFeatures: vi.fn<QueryRenderedFeatures>().mockResolvedValue([]),
  };
  await mounted.result.current.click(event);
  expect(onClick).toHaveBeenCalledTimes(1);
  await Promise.all([first, second]);
  await act(async () => finish([]));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("an exception from a click callback leaves the next tap deliverable", async () => {
  const query = vi.fn<QueryRenderedFeatures>().mockResolvedValue([]);
  const ref = {
    current: { queryRenderedFeatures: query },
  };
  const error = new Error("Click callback failed");
  const onClick = vi.fn().mockImplementationOnce(() => {
    throw error;
  });
  const onError = vi.fn();
  const mounted = renderHook(() =>
    useMapInteractions({ interactiveLayerIds: ["poi"], onClick, onError }, ref)
  );
  const first = mounted.result.current.click(event);
  const second = mounted.result.current.click(event);
  await expect(first).rejects.toBe(error);
  await second;
  expect(onClick).toHaveBeenCalledTimes(2);
  expect(onError).not.toHaveBeenCalled();
});

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
    .fn<QueryRenderedFeatures>()
    .mockResolvedValue(firstFeatures);
  const secondQuery = vi
    .fn<QueryRenderedFeatures>()
    .mockResolvedValue(secondFeatures);
  const first = renderHook(() =>
    useMapInteractions(
      { ...props, onClick: firstClick, interactiveLayerIds: ["a"] },
      { current: { queryRenderedFeatures: firstQuery } }
    )
  );
  const second = renderHook(() =>
    useMapInteractions(
      { ...props, onClick: secondClick, interactiveLayerIds: ["b"] },
      { current: { queryRenderedFeatures: secondQuery } }
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
    const ref = {
      current: { queryRenderedFeatures: vi.fn<QueryRenderedFeatures>() },
    };
    const onClick = vi.fn();
    const query = vi.fn<QueryRenderedFeatures>(() => {
      if (change === "replace")
        ref.current = { queryRenderedFeatures: vi.fn<QueryRenderedFeatures>() };
      else mounted.unmount();
      return Promise.resolve([]);
    });
    ref.current = { queryRenderedFeatures: query };
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
  let resolve!: (features: Awaited<ReturnType<QueryRenderedFeatures>>) => void;
  const query = vi.fn<QueryRenderedFeatures>(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const ref = {
    current: { queryRenderedFeatures: query },
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
