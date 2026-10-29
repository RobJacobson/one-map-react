import { act, renderHook } from "@testing-library/react";
import { isValidElement, useLayoutEffect } from "react";
import { afterEach, beforeEach, expect, vi, test } from "vite-plus/test";

import { LifetimesMap } from "../../../examples/shared/lifetimes-map.js";
import { useLifetimesSmoke } from "../../../examples/shared/lifetimes-smoke.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type {
  FeatureIdentifier,
  FeatureState,
} from "../src/contracts/query-types.js";

type Family = "geojson" | "vector";

/** Model renderer generations separately from React commits and retain state on demand. */
const fixture = (stringIds = false, deferredRemoval = false) => {
  let sourceRevision = 0;
  let renderedRevision = 0;
  let family: Family = "vector";
  let attached = true;
  let phase = "vector";
  const states = new Map<string, FeatureState>();
  const calls: {
    method: string;
    revision: number;
    family: Family;
    phase: string;
    target?: FeatureIdentifier;
  }[] = [];
  const key = (target: FeatureIdentifier) =>
    `${target.sourceLayer ?? "geojson"}/${target.id}`;
  const record = (method: string, target?: FeatureIdentifier) => {
    if (!attached) throw new Error("reactTag resolved to view null");
    if (target && (family === "vector") !== (target.sourceLayer !== undefined))
      throw new Error("Wrong feature-state family identifier");
    calls.push({ method, revision: sourceRevision, family, phase, target });
  };
  const features = (revision: number) =>
    [1, 2].map((id) => ({
      type: "Feature",
      id: stringIds ? String(id) : id,
      properties: { __oneMapSourceRevision: revision },
      geometry: null,
    }));
  const queryRenderedFeatures = vi.fn(async () => features(renderedRevision));
  const querySourceFeatures = vi.fn(
    async (_source: string, options?: { sourceLayer?: string }) => {
      record("querySourceFeatures");
      if (
        family === "vector" &&
        !["routes", "alternates"].includes(options?.sourceLayer ?? "")
      )
        throw new Error("Vector sourceLayer missing");
      if (family === "geojson" && options?.sourceLayer !== undefined)
        throw new Error("GeoJSON sourceLayer present");
      return features(sourceRevision);
    }
  );
  const setFeatureState = vi.fn(
    async (target: FeatureIdentifier, state: FeatureState) => {
      record("setFeatureState", target);
      states.set(key(target), { ...states.get(key(target)), ...state });
    }
  );
  const getFeatureState = vi.fn(async (target: FeatureIdentifier) => {
    record("getFeatureState", target);
    return states.get(key(target)) ?? {};
  });
  const removeFeatureState = vi.fn(
    async (target: FeatureIdentifier, property?: string) => {
      record("removeFeatureState", target);
      const remove = () => {
        if (property === undefined) states.delete(key(target));
        else {
          const next = { ...states.get(key(target)) };
          delete next[property];
          states.set(key(target), next);
        }
      };
      // Native SDK reads include pending writes before frame-coalesced deletions.
      if (deferredRemoval) setTimeout(remove, 0);
      else remove();
    }
  );
  // This partial handle exercises only the smoke's documented map operations.
  const map = {
    jumpTo: vi.fn(async () => undefined),
    getCenter: vi.fn(async () => [-122.34, 47.61]),
    getZoom: vi.fn(async () => 11),
    queryRenderedFeatures,
    querySourceFeatures,
    setFeatureState,
    getFeatureState,
    removeFeatureState,
  } as unknown as MapRef;
  return {
    mapRef: { current: map },
    queryRenderedFeatures,
    querySourceFeatures,
    setFeatureState,
    getFeatureState,
    removeFeatureState,
    calls,
    states,
    detach: () => {
      attached = false;
    },
    commit: (
      revision: number,
      nextFamily: Family,
      retainState = false,
      nextPhase = "vector"
    ) => {
      phase = nextPhase;
      sourceRevision = revision;
      renderedRevision = revision;
      family = nextFamily;
      attached = true;
      if (!retainState) states.clear();
    },
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const tick = (milliseconds: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });

const drive = async (hook: { result: { current: { phase: string } } }) => {
  for (
    let step = 0;
    step < 20 && hook.result.current.phase !== "done";
    step += 1
  )
    await tick(250);
};

test.each([
  { stringIds: false, retainState: false },
  { stringIds: true, retainState: false },
  { stringIds: false, retainState: true },
  { stringIds: true, retainState: true },
])(
  "application state works with bridge string ids=$stringIds and retained renderer state=$retainState",
  async ({ stringIds, retainState }) => {
    const renderer = fixture(stringIds);
    const retainedBeforeTransition: number[] = [];
    const hook = renderHook(() => {
      const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
      const { sourceRevision, family, phase, onStyleLoad } = smoke;
      useLayoutEffect(() => {
        if (sourceRevision === 0 || phase === "done") return;
        retainedBeforeTransition.push(renderer.states.size);
        renderer.commit(sourceRevision, family, retainState, phase);
        if (phase === "style") onStyleLoad();
      }, [sourceRevision, family, phase, onStyleLoad]);
      return smoke;
    });
    act(() => hook.result.current.onLoad());
    await drive(hook);
    expect(hook.result.current.phase).toBe("done");
    expect(hook.result.current.status).toContain("vector-namespaces=ok");
    expect(hook.result.current.status).toContain(
      "vector-remount=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain(
      "vector-style=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain(
      "vector-to-geojson=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain(
      "geojson-to-vector=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain(
      "final-remount=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain("error=none");
    expect(retainedBeforeTransition).toEqual(
      retainState ? [4, 4, 4, 6, 6] : [4, 4, 4, 2, 4]
    );
    expect(
      renderer.calls
        .filter((call) => call.method === "removeFeatureState")
        .map((call) => call.revision)
    ).toEqual(
      retainState
        ? [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]
        : [0, 0, 2, 2]
    );
    const transitions = renderer.calls.filter(
      (call) => call.method === "setFeatureState" && call.revision >= 2
    );
    expect(
      transitions.some(
        (call) => call.revision === 2 && call.target?.sourceLayer === undefined
      )
    ).toBe(true);
    expect(
      transitions.some(
        (call) =>
          call.revision === 3 &&
          call.target?.sourceLayer === "alternates" &&
          call.target.id === 2
      )
    ).toBe(true);
  }
);

test.each([false, true])(
  "frame-deferred removal preserves independent keys with retained state=%s",
  async (retainState) => {
    const renderer = fixture(false, true);
    const hook = renderHook(() => {
      const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
      const { sourceRevision, family, phase, onStyleLoad } = smoke;
      useLayoutEffect(() => {
        if (sourceRevision === 0 || phase === "done") return;
        renderer.commit(sourceRevision, family, retainState, phase);
        if (retainState && phase === "to-geojson") {
          renderer.states.set("geojson/1", { count: 99 });
          renderer.states.set("geojson/2", { count: 98 });
        }
        if (phase === "style") onStyleLoad();
      }, [sourceRevision, family, phase, onStyleLoad]);
      return smoke;
    });
    act(() => hook.result.current.onLoad());
    await drive(hook);
    expect(hook.result.current.phase).toBe("done");
    expect(hook.result.current.status).toContain("error=none");
    expect(hook.result.current.status).toContain(
      "vector-to-geojson=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain(
      "final-remount=explicitly-cleared"
    );
  }
);

test("key removal still fails when it deletes the independent count", async () => {
  const renderer = fixture();
  renderer.removeFeatureState.mockImplementation(async () => {
    renderer.states.clear();
  });
  const hook = renderHook(() => useLifetimesSmoke({ mapRef: renderer.mapRef }));
  act(() => hook.result.current.onLoad());
  await drive(hook);
  expect(hook.result.current.status).toContain(
    "error=Key-removal-also-removed-count."
  );
});

test("render generation gates source and state dispatch while native attachment is pending", async () => {
  const renderer = fixture();
  const hook = renderHook(() => {
    const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
    const { sourceRevision, family, phase, onStyleLoad } = smoke;
    useLayoutEffect(() => {
      if (sourceRevision === 0 || phase === "done") return;
      renderer.detach();
      const timer = setTimeout(() => {
        renderer.commit(sourceRevision, family, false, phase);
        if (phase === "style") onStyleLoad();
      }, 500);
      return () => clearTimeout(timer);
    }, [sourceRevision, family, phase, onStyleLoad]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("remount");
  const count = renderer.calls.length;
  await tick(100);
  expect(renderer.calls).toHaveLength(count);
  expect(
    renderer.queryRenderedFeatures.mock.calls.every((call) => call.length <= 1)
  ).toBe(true);
  await drive(hook);
  expect(hook.result.current.status).toContain("error=none");
});

test.each(["remount", "style", "to-geojson", "to-vector", "final-remount"])(
  "application explicitly clears retained renderer state after phase %s",
  async (retainPhase) => {
    const renderer = fixture();
    const hook = renderHook(() => {
      const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
      const { sourceRevision, family, phase, onStyleLoad } = smoke;
      useLayoutEffect(() => {
        if (sourceRevision === 0 || phase === "done") return;
        renderer.commit(sourceRevision, family, phase === retainPhase, phase);
        // Family namespaces differ. Simulate an erroneously retained destination
        // namespace as well, so an old count key alone must fail whole removal.
        if (phase === retainPhase) {
          renderer.states.set(family === "geojson" ? "geojson/1" : "routes/1", {
            count: 2,
          });
        }
        if (phase === "style") onStyleLoad();
      }, [sourceRevision, family, phase, onStyleLoad]);
      return smoke;
    });
    act(() => hook.result.current.onLoad());
    for (
      let step = 0;
      step < 35 && hook.result.current.phase !== "done";
      step += 1
    )
      await tick(250);
    expect(hook.result.current.status).toContain("error=none");
    expect(hook.result.current.phase).toBe("done");
    expect(
      renderer.calls.filter(
        (call) =>
          call.method === "removeFeatureState" && call.phase === retainPhase
      )
    ).not.toHaveLength(0);
  }
);

test("source errors reject immediately after renderer generation readiness", async () => {
  const renderer = fixture();
  renderer.querySourceFeatures.mockRejectedValueOnce(
    new Error("reactTag 38 invalid")
  );
  const hook = renderHook(() => useLifetimesSmoke({ mapRef: renderer.mapRef }));
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain("error=reactTag-38-invalid");
  expect(renderer.querySourceFeatures).toHaveBeenCalledTimes(1);
  expect(renderer.setFeatureState).not.toHaveBeenCalled();
});

test("an indefinitely stale rendered generation fails before an unpublished source is queried", async () => {
  const renderer = fixture();
  const hook = renderHook(() => {
    const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision > 0) renderer.detach();
    }, [smoke.sourceRevision]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  const count = renderer.querySourceFeatures.mock.calls.length;
  await tick(10500);
  expect(hook.result.current.status).toContain(
    "error=rendered-source-readiness-timed-out"
  );
  expect(renderer.querySourceFeatures).toHaveBeenCalledTimes(count);
});

test("unmount cancels a pending generation observation without later SDK calls", async () => {
  const renderer = fixture();
  const hook = renderHook(() => {
    const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision > 0) renderer.detach();
    }, [smoke.sourceRevision]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  hook.unmount();
  const calls = renderer.calls.length;
  renderer.commit(1, "vector");
  await tick(10000);
  expect(renderer.calls).toHaveLength(calls);
});

test("unmount during state read prevents subsequent removal and transition dispatch", async () => {
  const renderer = fixture();
  let resolve: (state: FeatureState) => void = () => {};
  renderer.getFeatureState.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const hook = renderHook(() => useLifetimesSmoke({ mapRef: renderer.mapRef }));
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(renderer.getFeatureState).toHaveBeenCalledTimes(1);
  hook.unmount();
  await act(async () => resolve({ selected: true, count: 2 }));
  expect(renderer.removeFeatureState).not.toHaveBeenCalled();
  expect(renderer.setFeatureState).toHaveBeenCalledTimes(1);
});

test("style replacement preserves the vector source key, revision and tile URL", async () => {
  const renderer = fixture();
  const inputs: {
    phase: string;
    family: string;
    revision: number;
    key: string | null;
    tiles?: readonly string[];
  }[] = [];
  const hook = renderHook(() => {
    const smoke = useLifetimesSmoke({ mapRef: renderer.mapRef });
    const mapElement = LifetimesMap({
      family: smoke.family,
      mapStyle: smoke.mapStyle,
      sourceRevision: smoke.sourceRevision,
    });
    const source = mapElement.props.children;
    const { sourceRevision, family, phase, onStyleLoad } = smoke;
    useLayoutEffect(() => {
      if (!isValidElement<{ tiles?: readonly string[] }>(source))
        throw new Error("Lifetime scene has no Source element.");
      inputs.push({
        phase: phase,
        family: family,
        revision: sourceRevision,
        key: source.key,
        tiles: source.props.tiles,
      });
      if (sourceRevision === 0 || phase === "done") return;
      renderer.commit(sourceRevision, family, false, phase);
      if (phase === "style") onStyleLoad();
    }, [source, sourceRevision, family, phase, onStyleLoad]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await drive(hook);
  const remount = inputs.find((input) => input.phase === "remount");
  const style = inputs.find((input) => input.phase === "style");
  expect(remount).toBeDefined();
  expect(style).toEqual({ ...remount, phase: "style" });
  expect(hook.result.current.status).toContain(
    "vector-style=explicitly-cleared"
  );
});
