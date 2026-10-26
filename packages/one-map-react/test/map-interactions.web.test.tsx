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
const mountInteractions = () =>
  renderHook(() => useMapInteractions(props, { current: null }));

test.each(["click", "move"] as const)(
  "%s delivery snapshots registrations and respects disposal",
  (type) => {
    const mounted = mountInteractions();
    const interactions = mounted.result.current;
    const deliveries: string[] = [];
    const added = vi.fn(() => deliveries.push("added"));
    let releaseSelf = () => {};
    let releaseOther = () => {};
    const self = () => {
      deliveries.push("self");
      releaseSelf();
      releaseOther();
      // Bound re-registration so a broken live iterator fails instead of hanging.
      if (deliveries.length < 3)
        releaseSelf = interactions.subscribe(type, self);
      interactions.subscribe(type, added);
    };
    releaseSelf = interactions.subscribe(type, self);
    releaseOther = interactions.subscribe(type, () =>
      deliveries.push("removed")
    );
    interactions.subscribe(type, () => deliveries.push("last"));

    act(() => interactions.emit(type, event));
    expect(deliveries).toEqual(["self", "last"]);
    expect(added).not.toHaveBeenCalled();
    act(() => interactions.emit(type, event));
    expect(deliveries).toEqual(["self", "last", "last", "self", "added"]);
  }
);

test("unmount during delivery suppresses the rest of the snapshot and retained publishers", () => {
  const mounted = mountInteractions();
  const interactions = mounted.result.current;
  const later = vi.fn();
  interactions.subscribe("click", () => mounted.unmount());
  interactions.subscribe("click", later);

  act(() => interactions.emit("click", event));
  act(() => interactions.emit("click", event));
  expect(later).not.toHaveBeenCalled();
});

test("click subscriber unmount suppresses the map callback", async () => {
  const onClick = vi.fn();
  const mounted = renderHook(() =>
    useMapInteractions({ ...props, onClick }, { current: null })
  );
  mounted.result.current.subscribe("click", () => mounted.unmount());
  await act(async () => mounted.result.current.click(event));
  expect(onClick).not.toHaveBeenCalled();
});

test("duplicate callbacks have independently disposable registrations", () => {
  const mounted = mountInteractions();
  const interactions = mounted.result.current;
  const callback = vi.fn();
  const release = interactions.subscribe("move", callback);
  interactions.subscribe("move", callback);
  release();
  release();
  act(() => interactions.emit("move", event));
  expect(callback).toHaveBeenCalledTimes(1);
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

test("subscriber replacement suppresses the old map callback", async () => {
  const ref = { current: {} as MapRef };
  const onClick = vi.fn();
  const mounted = renderHook(() =>
    useMapInteractions({ ...props, onClick }, ref)
  );
  mounted.result.current.subscribe("click", () => {
    ref.current = {} as MapRef;
  });
  await act(async () => mounted.result.current.click(event));
  expect(onClick).not.toHaveBeenCalled();
});

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
