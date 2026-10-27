import { expect, test, vi } from "vite-plus/test";

import { createMapboxFeatureStateMethods } from "../src/adapters/mapbox-native/feature-state-methods.js";
import { createMaplibreFeatureStateMethods } from "../src/adapters/maplibre-native/feature-state-methods.js";
import { MaplibreSourceRegistry } from "../src/adapters/maplibre-native/source-registry.js";

const wrapper = () => ({
  setFeatureState: vi.fn(async (..._args: unknown[]): Promise<void> => {}),
  getFeatureState: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({
    selected: true,
  })),
  removeFeatureState: vi.fn(async (..._args: unknown[]): Promise<void> => {}),
});

const fixture = (
  backend: "mapbox" | "maplibre",
  family: "geojson" | "vector" = "geojson"
) => {
  const handle = wrapper();
  let current: typeof handle | null = handle;
  let attached = true;
  const requireMap = () => {
    if (!attached || !current) throw new Error("Map is detached");
    return current;
  };
  const sources = new MaplibreSourceRegistry();
  const cleanups = ["source-a", "source-b"].map((id) =>
    sources.register(id, () =>
      current
        ? ({ kind: family, ref: current } as unknown as NonNullable<
            ReturnType<Parameters<MaplibreSourceRegistry["register"]>[1]>
          >)
        : undefined
    )
  );
  const methods =
    backend === "mapbox"
      ? createMapboxFeatureStateMethods(
          () =>
            requireMap() as unknown as ReturnType<
              Parameters<typeof createMapboxFeatureStateMethods>[0]
            >
        )
      : createMaplibreFeatureStateMethods(sources, requireMap);
  return {
    methods,
    set: handle.setFeatureState,
    get: handle.getFeatureState,
    remove: handle.removeFeatureState,
    replace: (next: typeof handle | null) => {
      current = next;
    },
    detachMap: () => {
      attached = false;
    },
    detachSource: () => {
      cleanups[0]?.();
    },
  };
};

test.each(["mapbox", "maplibre"] as const)(
  "%s dispatches independent explicit calls without waiting for a pending write",
  async (backend) => {
    const { methods, set, get, remove } = fixture(backend);
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    set.mockImplementationOnce(() => pending);
    const first = methods.setFeatureState(
      { source: "source-a", id: 1 },
      { selected: true }
    );
    const second = methods.getFeatureState({ source: "source-a", id: 2 });
    const other = methods.removeFeatureState({ source: "source-b", id: 3 });
    try {
      expect(set).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await Promise.all([first, second, other]);
    }
  }
);

test.each(["mapbox", "maplibre"] as const)(
  "%s uses fresh refs while already dispatched writes may settle",
  async (backend) => {
    const renderer = fixture(backend);
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    renderer.set.mockImplementationOnce(() => pending);
    const target = { source: "source-a", id: 1 };
    const oldWrite = renderer.methods.setFeatureState(target, { old: true });
    const replacement = wrapper();
    renderer.replace(replacement);
    await renderer.methods.setFeatureState(target, { next: true });
    expect(replacement.setFeatureState).toHaveBeenCalledTimes(1);
    expect(renderer.set).toHaveBeenCalledTimes(1);
    finish();
    await expect(oldWrite).resolves.toBeUndefined();
    renderer.replace(null);
    await expect(renderer.methods.getFeatureState(target)).rejects.toThrow();
    expect(replacement.getFeatureState).not.toHaveBeenCalled();
  }
);

test.each(["mapbox", "maplibre"] as const)(
  "%s rejects every new state operation when the map is detached",
  async (backend) => {
    const renderer = fixture(backend);
    renderer.detachMap();
    const target = { source: "source-a", id: 1 };
    await expect(
      renderer.methods.setFeatureState(target, { selected: true })
    ).rejects.toThrow("detached");
    await expect(renderer.methods.getFeatureState(target)).rejects.toThrow(
      "detached"
    );
    await expect(
      renderer.methods.removeFeatureState(target, "selected")
    ).rejects.toThrow("detached");
    expect(renderer.set).not.toHaveBeenCalled();
    expect(renderer.get).not.toHaveBeenCalled();
    expect(renderer.remove).not.toHaveBeenCalled();
  }
);

test.each(["mapbox", "maplibre"] as const)(
  "%s copies caller inputs and protects them from SDK mutation",
  async (backend) => {
    const renderer = fixture(backend, "vector");
    const target = { source: "source-a", id: 2, sourceLayer: "way" };
    const state = { count: 2, nested: { enabled: true }, values: [1, 2] };
    const operation = renderer.methods.setFeatureState(target, state);
    target.id = 99;
    target.source = "missing";
    target.sourceLayer = "place";
    state.nested.enabled = false;
    state.values[0] = 99;
    await operation;
    const args = renderer.set.mock.calls[0];
    expect(args).toEqual(
      backend === "mapbox"
        ? [
            "2",
            { count: 2, nested: { enabled: true }, values: [1, 2] },
            "source-a",
            "way",
          ]
        : [
            { id: 2, sourceLayer: "way" },
            { count: 2, nested: { enabled: true }, values: [1, 2] },
          ]
    );
    const sdkState = args?.[1] as typeof state;
    sdkState.count = 8;
    sdkState.nested.enabled = true;
    sdkState.values[1] = 8;
    expect(state).toEqual({
      count: 2,
      nested: { enabled: false },
      values: [99, 2],
    });
    if (backend === "maplibre") {
      const sdkTarget = args?.[0] as typeof target;
      sdkTarget.id = 77;
      expect(target.id).toBe(99);
    }
  }
);

test.each(["mapbox", "maplibre"] as const)(
  "%s captures read and removal identifiers and keys before caller mutation",
  async (backend) => {
    const renderer = fixture(backend, "vector");
    const target = { source: "source-a", id: 2, sourceLayer: "way" };
    let key = "selected";
    const read = renderer.methods.getFeatureState(target);
    const removal = renderer.methods.removeFeatureState(target, key);
    target.id = 99;
    target.sourceLayer = "place";
    key = "other";
    await Promise.all([read, removal]);
    expect(renderer.get).toHaveBeenCalledWith(
      ...(backend === "mapbox"
        ? ["2", "source-a", "way"]
        : [{ id: 2, sourceLayer: "way" }])
    );
    expect(renderer.remove).toHaveBeenCalledWith(
      ...(backend === "mapbox"
        ? ["2", "selected", "source-a", "way"]
        : [{ id: 2, sourceLayer: "way" }, "selected"])
    );
    await renderer.methods.removeFeatureState(target);
    expect(renderer.remove).toHaveBeenLastCalledWith(
      ...(backend === "mapbox"
        ? ["99", null, "source-a", "place"]
        : [{ id: 99, sourceLayer: "place" }])
    );
  }
);

test.each(["mapbox", "maplibre"] as const)(
  "%s preserves each SDK error and converts null and malformed read results",
  async (backend) => {
    const renderer = fixture(backend);
    const target = { source: "source-a", id: 1 };
    const failure = new Error("SDK failure");
    renderer.set.mockRejectedValueOnce(failure);
    renderer.get.mockRejectedValueOnce(failure);
    renderer.remove.mockRejectedValueOnce(failure);
    await expect(
      renderer.methods.setFeatureState(target, { selected: true })
    ).rejects.toBe(failure);
    await expect(renderer.methods.getFeatureState(target)).rejects.toBe(
      failure
    );
    await expect(renderer.methods.removeFeatureState(target)).rejects.toBe(
      failure
    );
    renderer.get.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    await expect(renderer.methods.getFeatureState(target)).resolves.toEqual({});
    await expect(renderer.methods.getFeatureState(target)).rejects.toThrow(
      "must be an object"
    );
  }
);

test.each(["mapbox", "maplibre"] as const)(
  "%s validates malformed identifiers and nested state before dispatch",
  async (backend) => {
    const renderer = fixture(backend);
    await expect(
      renderer.methods.setFeatureState(
        { source: "", id: 1 },
        { selected: true }
      )
    ).rejects.toThrow();
    await expect(
      renderer.methods.setFeatureState(
        { source: "source-a", id: 1 },
        { nested: { bad: Number.NaN } }
      )
    ).rejects.toThrow("non-finite");
    expect(renderer.set).not.toHaveBeenCalled();
  }
);

test("MapLibre rejects detached and missing sources independently of other sources", async () => {
  const renderer = fixture("maplibre");
  renderer.detachSource();
  await expect(
    renderer.methods.getFeatureState({ source: "source-a", id: 1 })
  ).rejects.toThrow("not a mounted");
  await expect(
    renderer.methods.removeFeatureState({ source: "unknown", id: 1 })
  ).rejects.toThrow("not a mounted");
  await renderer.methods.getFeatureState({ source: "source-b", id: 1 });
  expect(renderer.get).toHaveBeenCalledTimes(1);
});

test("MapLibre vector methods retain sourceLayer validation", async () => {
  const renderer = fixture("maplibre", "vector");
  const target = { source: "source-a", id: 1 };
  await expect(
    renderer.methods.setFeatureState(target, { selected: true })
  ).rejects.toThrow("need sourceLayer");
  await expect(renderer.methods.getFeatureState(target)).rejects.toThrow(
    "need sourceLayer"
  );
  await expect(renderer.methods.removeFeatureState(target)).rejects.toThrow(
    "need sourceLayer"
  );
  expect(renderer.set).not.toHaveBeenCalled();
  expect(renderer.get).not.toHaveBeenCalled();
  expect(renderer.remove).not.toHaveBeenCalled();
});

test("RNMapbox state methods dispatch style-owned vector sources without facade registration", async () => {
  const renderer = fixture("mapbox");
  const target = { source: "style-source", id: 1, sourceLayer: "way" };
  await renderer.methods.setFeatureState(target, { selected: true });
  await renderer.methods.getFeatureState(target);
  await renderer.methods.removeFeatureState(target, "selected");
  expect(renderer.set).toHaveBeenCalledWith(
    "1",
    { selected: true },
    "style-source",
    "way"
  );
  expect(renderer.get).toHaveBeenCalledWith("1", "style-source", "way");
  expect(renderer.remove).toHaveBeenCalledWith(
    "1",
    "selected",
    "style-source",
    "way"
  );
});
