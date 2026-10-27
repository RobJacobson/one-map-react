import { act, fireEvent, render, renderHook } from "@testing-library/react";
import {
  startTransition,
  Suspense,
  use,
  useLayoutEffect,
  useState,
} from "react";
import { afterEach, beforeEach, expect, vi, test } from "vite-plus/test";

import { useQueriesSmoke } from "../../../examples/shared/queries-smoke.js";
import {
  queryRoutes,
  replacementStyle,
} from "../../../tests/fixtures/map-fixture.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { FeatureState } from "../src/contracts/query-types.js";
import { sdkFeatureState } from "./sdk-feature-state.js";

const scene = (removalReads = 2, stringIds = false) => {
  let state: FeatureState = {};
  let remaining = 0;
  let removeWhole = false;
  let sourceRevision = 0;
  let renderedRevision = 0;
  let renderedLayerUnavailable = false;
  const route = (id: number, revision = sourceRevision) => ({
    type: "Feature",
    id: stringIds ? String(id) : id,
    properties: { __oneMapSourceRevision: revision },
    geometry: null,
  });
  const leaves = [route(1), route(2)];
  const project = vi.fn(async () => [600, 400]);
  const queryRenderedFeatures = vi.fn(
    async (
      target?: readonly number[],
      options?: { layers?: readonly string[]; filter?: unknown }
    ) => {
      if (renderedLayerUnavailable && options?.layers?.length) {
        throw new Error('Rendered query layer "queries-line" is not present.');
      }
      if (options?.layers?.[0] === "queries-cluster-circles")
        return [
          { type: "Feature", properties: { cluster: true, cluster_id: 7 } },
        ];
      if (target?.[0] === 2) return [];
      return options?.filter
        ? [route(1, renderedRevision)]
        : [route(1, renderedRevision), route(2, renderedRevision)];
    }
  );
  const querySourceFeatures = vi.fn(
    async (_id: string, options?: { filter?: unknown }) =>
      options?.filter ? [route(1)] : [route(1), route(2)]
  );
  const getFeatureState = vi.fn(async () => {
    if (remaining > 0) {
      remaining -= 1;
      if (remaining === 0) {
        if (removeWhole) state = {};
        else {
          const { selected: _selected, ...rest } = state;
          state = rest;
        }
      }
    }
    return state;
  });
  const removeFeatureState = vi.fn(
    async (_identifier: object, key?: string) => {
      remaining = removalReads;
      removeWhole = key === undefined;
    }
  );
  const setFeatureState = vi.fn(
    async (_identifier: object, value: FeatureState) => {
      state = { ...state, ...value };
    }
  );
  // These partial handles exercise only the smoke's public operations.
  const map = {
    jumpTo: vi.fn(async () => undefined),
    getCenter: vi.fn(async () => [-122.34, 47.61]),
    getZoom: vi.fn(async () => 11),
    project,
    queryRenderedFeatures,
    querySourceFeatures,
    getFeatureState,
    setFeatureState,
    removeFeatureState,
    getClusterExpansionZoom: vi.fn(async () => 13),
    getClusterLeaves: vi.fn(
      async (_id: string, _cluster: number, limit: number, offset: number) =>
        leaves.slice(offset, offset + limit)
    ),
    getClusterChildren: vi.fn(async () => leaves),
  } as unknown as MapRef;
  const mapRef = { current: map };
  return {
    mapRef,
    project,
    queryRenderedFeatures,
    querySourceFeatures,
    getFeatureState,
    setFeatureState,
    removeFeatureState,
    clearState: () => {
      state = {};
    },
    setRenderedLayerUnavailable: (unavailable: boolean) => {
      renderedLayerUnavailable = unavailable;
    },
    commitRenderedRevision: (revision: number) => {
      renderedRevision = revision;
    },
    commitSourceRevision: (
      revision: number,
      replacementState: FeatureState = {}
    ) => {
      sourceRevision = revision;
      renderedRevision = revision;
      state = replacementState;
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
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

test("query dispatch is single-flight and late completion after unmount is ignored", async () => {
  const fixture = scene();
  let resolve: (point: number[]) => void = () => {};
  fixture.project.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const hook = renderHook(() => useQueriesSmoke({ mapRef: fixture.mapRef }));
  act(() => hook.result.current.onLoad());
  await tick(1000);
  expect(hook.result.current.phase).toBe("queries");
  await tick(3000);
  expect(fixture.project).toHaveBeenCalledTimes(1);
  const readinessQueries = fixture.queryRenderedFeatures.mock.calls.length;
  hook.unmount();
  await act(async () => {
    resolve([600, 400]);
  });
  expect(fixture.queryRenderedFeatures).toHaveBeenCalledTimes(readinessQueries);
});

test.each([false, true])(
  "delayed removal and reset complete with bridge string ids=%s",
  async (stringIds) => {
    const fixture = scene(3, stringIds);
    const hook = renderHook(() => {
      const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
      useLayoutEffect(() => {
        if (smoke.sourceRevision > 0)
          fixture.commitSourceRevision(smoke.sourceRevision);
      }, [smoke.sourceRevision]);
      const { mapStyle, onStyleLoad } = smoke;
      useLayoutEffect(() => {
        if (mapStyle === replacementStyle) {
          fixture.clearState();
          onStyleLoad();
        }
      }, [mapStyle, onStyleLoad]);
      return smoke;
    });
    act(() => hook.result.current.onLoad());
    for (
      let step = 0;
      step < 12 && hook.result.current.phase !== "done";
      step += 1
    )
      await tick(250);
    expect(hook.result.current.status).toContain("remove-state=ok");
    expect(hook.result.current.status).toContain("whole-state=ok");
    expect(hook.result.current.status).toContain(
      "recreated-state=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain(
      "cleared-state=explicitly-cleared"
    );
    expect(hook.result.current.status).toContain("error=none");
    expect(hook.result.current.phase).toBe("done");
    expect(fixture.setFeatureState).toHaveBeenCalledWith(
      { source: "queries-routes", id: 1 },
      { selected: true, count: 2 }
    );
  }
);

test("the query scene pins portable numeric route ids to known geometry", () => {
  expect(
    queryRoutes.features.map((feature) => [
      feature.id,
      feature.properties?.route,
    ])
  ).toEqual([
    [1, "north"],
    [2, "south"],
    [3, "offscreen"],
  ]);
});

test("recreation waits for the loaded source generation before reading state", async () => {
  const fixture = scene(1);
  let readsBeforeNativeCommit = 0;
  const renders: { phase: string; sourceRevision: number; reset: boolean }[] =
    [];
  const hook = renderHook(() => {
    const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
    renders.push({
      phase: smoke.phase,
      sourceRevision: smoke.sourceRevision,
      reset: smoke.mapStyle === replacementStyle,
    });
    useLayoutEffect(() => {
      if (smoke.sourceRevision === 0) return;
      readsBeforeNativeCommit = fixture.getFeatureState.mock.calls.length;
      fixture.setRenderedLayerUnavailable(true);
      // Old tiles and their state survive until the simulated native commit.
      const timer = setTimeout(() => {
        fixture.setRenderedLayerUnavailable(false);
        fixture.commitSourceRevision(smoke.sourceRevision);
      }, 300);
      return () => clearTimeout(timer);
    }, [smoke.sourceRevision]);
    const { mapStyle, onStyleLoad } = smoke;
    useLayoutEffect(() => {
      if (mapStyle === replacementStyle) {
        fixture.clearState();
        onStyleLoad();
      }
    }, [mapStyle, onStyleLoad]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  for (let step = 0; step < 10; step += 1) {
    if (hook.result.current.phase === "recreate") break;
    await tick(50);
  }
  expect(hook.result.current.phase).toBe("recreate");
  expect(hook.result.current.sourceRevision).toBe(1);
  const queriesBeforeWait = fixture.querySourceFeatures.mock.calls.length;
  const renderedQueriesBeforeWait =
    fixture.queryRenderedFeatures.mock.calls.length;
  await tick(200);
  expect(fixture.querySourceFeatures).toHaveBeenCalledTimes(queriesBeforeWait);
  expect(fixture.queryRenderedFeatures.mock.calls.length).toBeGreaterThan(
    renderedQueriesBeforeWait
  );
  expect(fixture.getFeatureState).toHaveBeenCalledTimes(
    readsBeforeNativeCommit
  );
  expect(hook.result.current.phase).toBe("recreate");
  await tick(500);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain(
    "recreated-state=explicitly-cleared"
  );
  expect(hook.result.current.status).toContain(
    "cleared-state=explicitly-cleared"
  );
  expect(hook.result.current.status).toContain("error=none");
  // Both recreated and replacement sources are already empty in this scene.
  expect(fixture.removeFeatureState).toHaveBeenCalledTimes(2);
  expect(renders.filter((render) => render.phase === "recreate")).toEqual(
    expect.arrayContaining([
      { phase: "recreate", sourceRevision: 1, reset: false },
    ])
  );
  expect(
    renders.some(
      (render) =>
        (render.phase === "recreate" && render.sourceRevision !== 1) ||
        (render.phase === "reset" && !render.reset)
    )
  ).toBe(false);
});

test("the old source generation cannot satisfy remount readiness", async () => {
  const fixture = scene(1);
  const hook = renderHook(() => {
    const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision > 0) {
        fixture.clearState();
        fixture.commitRenderedRevision(smoke.sourceRevision);
      }
    }, [smoke.sourceRevision]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("recreate");
  const readsBeforeWait = fixture.getFeatureState.mock.calls.length;
  await tick(10500);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain(
    "source-readiness-timed-out-after-10000-ms"
  );
  expect(fixture.getFeatureState).toHaveBeenCalledTimes(readsBeforeWait);
});

test("an attaching native source tag is not queried before its generation renders", async () => {
  const fixture = scene(1);
  let attached = true;
  let queriesBeforeNativeCommit = 0;
  const sourceQuery = fixture.querySourceFeatures.getMockImplementation();
  if (!sourceQuery) throw new Error("Missing source query fixture.");
  fixture.querySourceFeatures.mockImplementation(async (...args) => {
    if (!attached)
      throw new Error("reactTag resolved to view null before native commit");
    return sourceQuery(...args);
  });
  const hook = renderHook(() => {
    const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision === 0) return;
      attached = false;
      queriesBeforeNativeCommit = fixture.querySourceFeatures.mock.calls.length;
      const timer = setTimeout(() => {
        fixture.commitSourceRevision(smoke.sourceRevision);
        attached = true;
      }, 300);
      return () => clearTimeout(timer);
    }, [smoke.sourceRevision]);
    const { mapStyle, onStyleLoad } = smoke;
    useLayoutEffect(() => {
      if (mapStyle === replacementStyle) {
        fixture.clearState();
        onStyleLoad();
      }
    }, [mapStyle, onStyleLoad]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  for (let step = 0; step < 10; step += 1) {
    if (hook.result.current.phase === "recreate") break;
    await tick(50);
  }
  expect(hook.result.current.phase).toBe("recreate");
  await tick(200);
  expect(attached).toBe(false);
  expect(fixture.querySourceFeatures).toHaveBeenCalledTimes(
    queriesBeforeNativeCommit
  );
  await tick(500);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain("error=none");
  expect(hook.result.current.status).toContain(
    "recreated-state=explicitly-cleared"
  );
  expect(hook.result.current.status).toContain(
    "cleared-state=explicitly-cleared"
  );
});

test("a native tag failure during remount readiness propagates immediately", async () => {
  const fixture = scene(1);
  let queriesBeforeRemount = 0;
  const hook = renderHook(() => {
    const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision === 0) return;
      fixture.commitRenderedRevision(smoke.sourceRevision);
      queriesBeforeRemount = fixture.querySourceFeatures.mock.calls.length;
      fixture.querySourceFeatures.mockRejectedValueOnce(
        new Error("Invalid reactTag 38, could not find MLRNGeoJSONSource")
      );
    }, [smoke.sourceRevision]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain("error=Invalid-reactTag-38");
  expect(fixture.querySourceFeatures).toHaveBeenCalledTimes(
    queriesBeforeRemount + 1
  );
});

test("the application explicitly clears retained whole state after recreation", async () => {
  const fixture = scene(1);
  const hook = renderHook(() => {
    const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision > 0)
        fixture.commitSourceRevision(smoke.sourceRevision, { count: 2 });
    }, [smoke.sourceRevision]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("reset");
  expect(hook.result.current.status).toContain(
    "recreated-state=explicitly-cleared"
  );
  expect(fixture.removeFeatureState).toHaveBeenCalledTimes(3);
  act(() => hook.result.current.onStyleLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain("error=none");
  expect(fixture.removeFeatureState).toHaveBeenCalledTimes(4);
});

test("state removal times out after five seconds", async () => {
  const fixture = scene(1000);
  const hook = renderHook(() => useQueriesSmoke({ mapRef: fixture.mapRef }));
  act(() => hook.result.current.onLoad());
  await tick(250);
  await tick(5500);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain(
    "selected-state-removal-timed-out-after-5000-ms"
  );
});

test("an operational removal read failure ends observation immediately", async () => {
  const fixture = scene();
  fixture.removeFeatureState.mockImplementationOnce(async () => {
    fixture.getFeatureState.mockRejectedValueOnce(
      new Error("renderer unavailable")
    );
  });
  const hook = renderHook(() => useQueriesSmoke({ mapRef: fixture.mapRef }));
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("done");
  expect(hook.result.current.status).toContain("error=renderer-unavailable");
  expect(fixture.getFeatureState).toHaveBeenCalledTimes(2);
});

test("pending removal reads do not overlap and cleanup ignores their completion", async () => {
  const fixture = scene();
  let resolve: (state: FeatureState) => void = () => {};
  fixture.removeFeatureState.mockImplementationOnce(async () => {
    fixture.getFeatureState.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
  });
  const hook = renderHook(() => useQueriesSmoke({ mapRef: fixture.mapRef }));
  act(() => hook.result.current.onLoad());
  await tick(250);
  await tick(250);
  expect(hook.result.current.phase).toBe("state");
  expect(fixture.getFeatureState).toHaveBeenCalledTimes(2);
  await tick(1000);
  expect(fixture.getFeatureState).toHaveBeenCalledTimes(2);
  hook.unmount();
  await act(async () => {
    resolve({ count: 2 });
  });
  expect(fixture.removeFeatureState).toHaveBeenCalledTimes(1);
});

test("a suspended render cannot redirect a committed smoke callback to a new status URL", async () => {
  vi.useRealTimers();
  const post = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
  const wait = new Promise<void>(() => {});
  const mapRef = { current: null };
  const Probe = ({ pending }: { pending: boolean }) => {
    const smoke = useQueriesSmoke({
      mapRef,
      statusUrl: pending ? "/pending" : "/committed",
    });
    if (pending) use(wait);
    return (
      <button
        type="button"
        onClick={() => smoke.onError({ error: new Error("probe") })}
      >
        report error
      </button>
    );
  };
  const Harness = () => {
    const [pending, setPending] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => startTransition(() => setPending(true))}
        >
          suspend
        </button>
        <Suspense fallback={null}>
          <Probe pending={pending} />
        </Suspense>
      </>
    );
  };
  const view = render(<Harness />);
  await act(async () => fireEvent.click(view.getByText("suspend")));
  fireEvent.click(view.getByText("report error"));
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(
    "/committed",
    expect.objectContaining({ method: "POST" })
  );
});

test.each(["mapbox", "maplibre"] as const)(
  "%s actual SDK state queue survives fresh and retained source/style lifetimes",
  async (backend) => {
    for (const retained of [false, true]) {
      const fixture = scene(1);
      let source = sdkFeatureState(backend);
      const trace: string[] = [];
      fixture.setFeatureState.mockImplementation(async (_target, value) => {
        trace.push("set");
        source.setFeatureState(1, value);
      });
      fixture.getFeatureState.mockImplementation(async () => {
        trace.push("get");
        return source.getFeatureState(1);
      });
      fixture.removeFeatureState.mockImplementation(async (_target, key) => {
        trace.push(`remove:${key ?? "whole"}`);
        source.removeFeatureState(1, key);
      });
      const attach = () => {
        source = sdkFeatureState(backend);
        if (retained) {
          source.setFeatureState(1, {
            selected: true,
            count: 2,
            retained: true,
          });
          source.coalesce();
        }
      };
      const hook = renderHook(() => {
        const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
        useLayoutEffect(() => {
          if (smoke.sourceRevision === 0) return;
          trace.push("recreate");
          fixture.commitSourceRevision(smoke.sourceRevision);
          attach();
        }, [smoke.sourceRevision]);
        const { mapStyle, onStyleLoad } = smoke;
        useLayoutEffect(() => {
          if (mapStyle !== replacementStyle || trace.includes("replacement"))
            return;
          trace.push("replacement");
          attach();
          onStyleLoad();
        }, [mapStyle, onStyleLoad]);
        return smoke;
      });
      act(() => hook.result.current.onLoad());
      await tick(1000);
      expect(hook.result.current.status).toContain("error=none");
      expect(hook.result.current.status).toContain(
        "recreated-state=explicitly-cleared"
      );
      expect(hook.result.current.status).toContain(
        "cleared-state=explicitly-cleared"
      );
      expect(hook.result.current.phase).toBe("done");
      expect(trace).toContain("replacement");
      expect(source.getFeatureState(1)).toEqual({});
      expect(fixture.removeFeatureState).toHaveBeenCalledTimes(
        retained ? 4 : 2
      );
      hook.unmount();
    }
  }
);

test.each(["read", "remove"] as const)(
  "a recreation state %s failure propagates without retry or replacement",
  async (operation) => {
    const fixture = scene(1);
    let replaced = false;
    const hook = renderHook(() => {
      const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
      useLayoutEffect(() => {
        if (smoke.sourceRevision === 0) return;
        fixture.commitSourceRevision(smoke.sourceRevision, { retained: true });
        const failure = new Error(`recreation ${operation} failed`);
        if (operation === "read")
          fixture.getFeatureState.mockRejectedValueOnce(failure);
        else fixture.removeFeatureState.mockRejectedValueOnce(failure);
      }, [smoke.sourceRevision]);
      useLayoutEffect(() => {
        if (smoke.mapStyle === replacementStyle) replaced = true;
      }, [smoke.mapStyle]);
      return smoke;
    });
    act(() => hook.result.current.onLoad());
    await tick(250);
    expect(hook.result.current.phase).toBe("done");
    expect(hook.result.current.status).toContain(
      `error=recreation-${operation}-failed`
    );
    expect(replaced).toBe(false);
    const calls = fixture.getFeatureState.mock.calls.length;
    await tick(1000);
    expect(fixture.getFeatureState).toHaveBeenCalledTimes(calls);
    expect(fixture.removeFeatureState).toHaveBeenCalledTimes(
      operation === "read" ? 2 : 3
    );
    hook.unmount();
  }
);

test("a pending recreation state read cannot remove state after unmount", async () => {
  const fixture = scene(1);
  let resolve: (state: FeatureState) => void = () => {};
  const hook = renderHook(() => {
    const smoke = useQueriesSmoke({ mapRef: fixture.mapRef });
    useLayoutEffect(() => {
      if (smoke.sourceRevision === 0) return;
      fixture.commitSourceRevision(smoke.sourceRevision, { retained: true });
      fixture.getFeatureState.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
    }, [smoke.sourceRevision]);
    return smoke;
  });
  act(() => hook.result.current.onLoad());
  await tick(250);
  expect(hook.result.current.phase).toBe("recreate");
  expect(fixture.removeFeatureState).toHaveBeenCalledTimes(2);
  hook.unmount();
  await act(async () => {
    resolve({ retained: true });
  });
  expect(fixture.removeFeatureState).toHaveBeenCalledTimes(2);
});
