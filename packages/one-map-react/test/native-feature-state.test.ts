import { expect, test } from "@jest/globals";

import { NativeFeatureState } from "../src/adapters/shared/native-feature-state.js";
import type {
  FeatureIdentifier,
  FeatureState,
} from "../src/contracts/query-types.js";

test("the first owned lifetime preserves writes without resetting unrelated backend state", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  renderer.set(route, { external: true });
  state.register("routes");

  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  expect(await state.run(route, async () => renderer.get(route))).toEqual({
    external: true,
    selected: true,
  });
  expect(renderer.removals).toEqual([]);
});

test("a recreated owned source clears retained renderer state before its first read", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const detach = state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  detach();
  state.register("routes");

  // The renderer deliberately retains state across native source replacement.
  expect(renderer.get(route)).toEqual({ selected: true });
  expect(await state.run(route, async () => renderer.get(route))).toEqual({});
  expect(renderer.removals).toEqual([route]);
});

test("replacement clears every written feature and keeps vector source layers distinct", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const targets: readonly FeatureIdentifier[] = [
    { source: "tiles", sourceLayer: "roads", id: 1 },
    { source: "tiles", sourceLayer: "roads", id: "1" },
    { source: "tiles", sourceLayer: "buildings", id: 1 },
    { source: "tiles", sourceLayer: "roads", id: 2 },
  ];
  state.register("tiles");
  for (const target of targets) {
    await state.run(
      target,
      async () => renderer.set(target, { selected: true }),
      true
    );
  }
  state.register("tiles");

  for (const target of targets) {
    expect(await state.run(target, async () => renderer.get(target))).toEqual(
      {}
    );
  }
  expect(renderer.removals.map(targetKey).sort()).toEqual(
    [...new Set(targets.map(targetKey))].sort()
  );
});

test("reset of one source leaves another source and unowned style state intact", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const other = { source: "other", id: 1 };
  const style = { source: "style-owned", id: 1 };
  state.register("routes");
  state.register("other");
  for (const target of [route, other, style]) {
    await state.run(
      target,
      async () => renderer.set(target, { selected: true }),
      true
    );
  }
  state.register("routes");

  expect(await state.run(route, async () => renderer.get(route))).toEqual({});
  expect(await state.run(other, async () => renderer.get(other))).toEqual({
    selected: true,
  });
  expect(await state.run(style, async () => renderer.get(style))).toEqual({
    selected: true,
  });
  expect(renderer.removals).toEqual([route]);
});

test("replacement waits for an old write then resets before dispatching the new write", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const started = deferred();
  const finishOldWrite = deferred();
  const order: string[] = [];
  state.register("routes");
  const oldWrite = state.run(
    route,
    async () => {
      started.resolve();
      await finishOldWrite.promise;
      renderer.set(route, { old: true });
      order.push("old write");
    },
    true
  );
  const rejectedOldWrite = expect(oldWrite).rejects.toThrow();
  await started.promise;
  state.register("routes");
  const newWrite = state.run(
    route,
    async () => {
      order.push("new write");
      expect(renderer.get(route)).toEqual({});
      renderer.set(route, { replacement: true });
    },
    true
  );

  expect(order).toEqual([]);
  finishOldWrite.resolve();
  await rejectedOldWrite;
  await newWrite;
  expect(order).toEqual(["old write", "new write"]);
  expect(renderer.removals).toEqual([route]);
  expect(renderer.get(route)).toEqual({ replacement: true });
});

test("stale cleanup cannot detach the newer source lifetime", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const staleDetach = state.register("routes");
  state.register("routes");
  staleDetach();

  await state.run(
    route,
    async () => renderer.set(route, { current: true }),
    true
  );
  expect(await state.run(route, async () => renderer.get(route))).toEqual({
    current: true,
  });
});

test("detached owned sources reject calls without dispatching to the renderer", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const detach = state.register("routes");
  detach();
  let dispatched = false;

  await expect(
    state.run(route, async () => {
      dispatched = true;
      return renderer.get(route);
    })
  ).rejects.toThrow();
  expect(dispatched).toBe(false);
});

test("detaching during an operation rejects its completion and cancels queued dispatch", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const detach = state.register("routes");
  const started = deferred();
  const complete = deferred();
  let queuedDispatched = false;
  const reading = state.run(route, async () => {
    started.resolve();
    await complete.promise;
    return renderer.get(route);
  });
  const rejectedReading = expect(reading).rejects.toThrow();
  await started.promise;
  const queued = state.run(route, async () => {
    queuedDispatched = true;
    return renderer.get(route);
  });
  const rejectedQueued = expect(queued).rejects.toThrow();
  detach();
  complete.resolve();

  await rejectedReading;
  await rejectedQueued;
  expect(queuedDispatched).toBe(false);
});

test("a reset failure prevents new dispatch and remains observable until another lifetime", async () => {
  const renderer = createRetainedRenderer();
  const failure = new Error("renderer reset failed");
  let fails = true;
  const state = new NativeFeatureState(async (target) => {
    if (fails) throw failure;
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.register("routes");
  let dispatched = false;
  const read = () =>
    state.run(route, async () => {
      dispatched = true;
      return renderer.get(route);
    });

  await expect(read()).rejects.toBe(failure);
  fails = false;
  await expect(read()).rejects.toBe(failure);
  expect(dispatched).toBe(false);
  state.register("routes");
  expect(await read()).toEqual({});
  expect(renderer.removals).toEqual([route]);
});

test("an ordinary renderer failure does not poison later calls in the same lifetime", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const failure = new Error("query failed");
  state.register("routes");

  await expect(
    state.run(route, async () => {
      throw failure;
    })
  ).rejects.toBe(failure);
  await state.run(
    route,
    async () => renderer.set(route, { recovered: true }),
    true
  );
  expect(await state.run(route, async () => renderer.get(route))).toEqual({
    recovered: true,
  });
});

test("a pending operation on one source does not block another source", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const other = { source: "other", id: 1 };
  const started = deferred();
  const complete = deferred();
  state.register("routes");
  state.register("other");
  const pending = state.run(route, async () => {
    started.resolve();
    await complete.promise;
    return renderer.get(route);
  });
  await started.promise;

  await state.run(
    other,
    async () => renderer.set(other, { ready: true }),
    true
  );
  expect(await state.run(other, async () => renderer.get(other))).toEqual({
    ready: true,
  });
  complete.resolve();
  await pending;
});

test("queued identifier mutation cannot change the renderer cleanup target", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const identifier = { source: "tiles", sourceLayer: "roads", id: 1 };
  const dispatchedTarget = { ...identifier };
  const started = deferred();
  const complete = deferred();
  state.register("tiles");
  const pending = state.run(dispatchedTarget, async () => {
    started.resolve();
    await complete.promise;
  });
  await started.promise;
  const writing = state.run(
    identifier,
    async () => renderer.set(dispatchedTarget, { selected: true }),
    true
  );

  identifier.source = "other";
  identifier.sourceLayer = "buildings";
  identifier.id = 2;
  complete.resolve();
  await pending;
  await writing;
  state.register("tiles");

  expect(
    await state.run(dispatchedTarget, async () =>
      renderer.get(dispatchedTarget)
    )
  ).toEqual({});
  expect(renderer.removals).toEqual([dispatchedTarget]);
});

test("replacement during a pending reset cannot erase the newest lifetime's write", async () => {
  const renderer = createRetainedRenderer();
  const resetStarted = deferred();
  const finishReset = deferred();
  let resets = 0;
  const state = new NativeFeatureState(async (target) => {
    resets += 1;
    if (resets === 1) {
      resetStarted.resolve();
      await finishReset.promise;
    }
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { original: true }),
    true
  );
  state.register("routes");
  const staleRead = state.run(route, async () => renderer.get(route));
  const rejectedRead = expect(staleRead).rejects.toThrow();
  await resetStarted.promise;
  state.register("routes");
  const newestWrite = state.run(
    route,
    async () => {
      expect(renderer.get(route)).toEqual({});
      renderer.set(route, { newest: true });
    },
    true
  );
  finishReset.resolve();

  await rejectedRead;
  await newestWrite;
  expect(renderer.get(route)).toEqual({ newest: true });
  expect(resets).toBe(2);
});

test("style replacement clears whole state from owned and unowned written targets", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const styleTarget = { source: "style-source", id: 2 };
  const untouched = { source: "external", id: 3 };
  state.register("routes");
  renderer.set(untouched, { external: true });
  for (const target of [route, styleTarget]) {
    await state.run(
      target,
      async () => renderer.set(target, { selected: true, count: 2 }),
      true
    );
  }
  state.resetStyle();

  for (const target of [route, styleTarget]) {
    expect(await state.run(target, async () => renderer.get(target))).toEqual(
      {}
    );
  }
  expect(renderer.get(untouched)).toEqual({ external: true });
  expect(renderer.removals).toEqual([route, styleTarget]);
});

test("a new style's first write starts after removing all previous state keys", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { old: true, count: 2 }),
    true
  );
  state.resetStyle();

  await state.run(
    route,
    async () => {
      expect(renderer.get(route)).toEqual({});
      renderer.set(route, { fresh: true });
    },
    true
  );
  expect(await state.run(route, async () => renderer.get(route))).toEqual({
    fresh: true,
  });
});

test("a style change waits for an old write and rejects stale completion before resetting", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const started = deferred();
  const complete = deferred();
  state.register("routes");
  const oldWrite = state.run(
    route,
    async () => {
      started.resolve();
      await complete.promise;
      renderer.set(route, { old: true });
    },
    true
  );
  const rejectedWrite = expect(oldWrite).rejects.toThrow();
  await started.promise;
  state.resetStyle();
  const freshRead = state.run(route, async () => renderer.get(route));
  expect(renderer.removals).toEqual([]);
  complete.resolve();

  await rejectedWrite;
  expect(await freshRead).toEqual({});
  expect(renderer.removals).toEqual([route]);
});

test("registered source cleanup still detaches after multiple style epochs", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const detach = state.register("routes");
  state.resetStyle();
  state.resetStyle();
  detach();
  let dispatched = false;

  await expect(
    state.run(route, async () => {
      dispatched = true;
      return renderer.get(route);
    })
  ).rejects.toThrow("detached");
  expect(dispatched).toBe(false);
});

test("a style epoch cannot make stale source cleanup detach its replacement", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const staleDetach = state.register("routes");
  state.register("routes");
  state.resetStyle();
  staleDetach();

  await state.run(
    route,
    async () => renderer.set(route, { current: true }),
    true
  );
  expect(await state.run(route, async () => renderer.get(route))).toEqual({
    current: true,
  });
});

test("a later style replacement recovers a failed reset without recreating the source", async () => {
  const renderer = createRetainedRenderer();
  const failure = new Error("style reset failed");
  let fails = true;
  const state = new NativeFeatureState(async (target) => {
    if (fails) throw failure;
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.resetStyle();
  const read = () => state.run(route, async () => renderer.get(route));

  await expect(read()).rejects.toBe(failure);
  fails = false;
  await expect(read()).rejects.toBe(failure);
  state.resetStyle();
  expect(await read()).toEqual({});
});

test("a style change during a pending reset keeps invalidation for the next epoch", async () => {
  const renderer = createRetainedRenderer();
  const resetStarted = deferred();
  const finishReset = deferred();
  let resets = 0;
  const state = new NativeFeatureState(async (target) => {
    resets += 1;
    if (resets === 1) {
      resetStarted.resolve();
      await finishReset.promise;
    }
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { original: true }),
    true
  );
  state.resetStyle();
  const staleRead = state.run(route, async () => renderer.get(route));
  const rejectedRead = expect(staleRead).rejects.toThrow();
  await resetStarted.promise;
  state.resetStyle();
  const newestWrite = state.run(
    route,
    async () => renderer.set(route, { newest: true }),
    true
  );
  finishReset.resolve();

  await rejectedRead;
  await newestWrite;
  expect(renderer.get(route)).toEqual({ newest: true });
  expect(resets).toBe(2);
});

test("style reset on a busy source does not delay independent source resets", async () => {
  const renderer = createRetainedRenderer();
  const resetStarted = deferred();
  const finishReset = deferred();
  const other = { source: "other", id: 1 };
  const state = new NativeFeatureState(async (target) => {
    if (target.source === "routes") {
      resetStarted.resolve();
      await finishReset.promise;
    }
    await renderer.reset(target);
  });
  for (const target of [route, other]) {
    state.register(target.source);
    await state.run(
      target,
      async () => renderer.set(target, { selected: true }),
      true
    );
  }
  state.resetStyle();
  const busyRead = state.run(route, async () => renderer.get(route));
  await resetStarted.promise;

  expect(await state.run(other, async () => renderer.get(other))).toEqual({});
  expect(renderer.get(route)).toEqual({ selected: true });
  finishReset.resolve();
  expect(await busyRead).toEqual({});
});

test("renderer readiness clears remounted state without a caller state operation", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const errors: unknown[] = [];
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.register("routes");

  await state.flush((error) => errors.push(error));
  expect(renderer.get(route)).toEqual({});
  expect(renderer.removals).toEqual([route]);
  expect(errors).toEqual([]);
});

test("renderer readiness clears styled owned and raw sources without facade reads", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const raw = { source: "style-source", id: 2 };
  const untouched = { source: "external", id: 3 };
  state.register("routes");
  renderer.set(untouched, { external: true });
  for (const target of [route, raw]) {
    await state.run(
      target,
      async () => renderer.set(target, { selected: true, count: 2 }),
      true
    );
  }
  state.resetStyle();

  await state.flush(() => {});
  expect(renderer.get(route)).toEqual({});
  expect(renderer.get(raw)).toEqual({});
  expect(renderer.get(untouched)).toEqual({ external: true });
});

test("automatic cleanup waits for a pending old write without another state call", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  const errors: unknown[] = [];
  const started = deferred();
  const complete = deferred();
  state.register("routes");
  const oldWrite = state.run(
    route,
    async () => {
      started.resolve();
      await complete.promise;
      renderer.set(route, { old: true });
    },
    true
  );
  const rejectedWrite = expect(oldWrite).rejects.toThrow();
  await started.promise;
  state.resetStyle();
  const flushing = state.flush((error) => errors.push(error));
  expect(renderer.removals).toEqual([]);
  complete.resolve();

  await rejectedWrite;
  await flushing;
  expect(renderer.get(route)).toEqual({});
  expect(errors).toEqual([]);
});

test("repeated renderer frames join one pending automatic reset", async () => {
  const renderer = createRetainedRenderer();
  const started = deferred();
  const complete = deferred();
  let resets = 0;
  const state = new NativeFeatureState(async (target) => {
    resets += 1;
    started.resolve();
    await complete.promise;
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.register("routes");
  const firstFrame = state.flush(() => {});
  await started.promise;
  const secondFrame = state.flush(() => {});
  const thirdFrame = state.flush(() => {});
  expect(resets).toBe(1);
  complete.resolve();

  await Promise.all([firstFrame, secondFrame, thirdFrame]);
  await state.flush(() => {});
  expect(renderer.get(route)).toEqual({});
  expect(resets).toBe(1);
});

test("a newer style's automatic cleanup survives a pending superseded reset", async () => {
  const renderer = createRetainedRenderer();
  const errors: unknown[] = [];
  const started = deferred();
  const complete = deferred();
  let resets = 0;
  const state = new NativeFeatureState(async (target) => {
    resets += 1;
    if (resets === 1) {
      started.resolve();
      await complete.promise;
    }
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.resetStyle();
  const staleFrame = state.flush((error) => errors.push(error));
  await started.promise;
  state.resetStyle();
  const currentFrame = state.flush((error) => errors.push(error));
  complete.resolve();

  await Promise.all([staleFrame, currentFrame]);
  expect(renderer.get(route)).toEqual({});
  expect(resets).toBe(2);
  expect(errors).toEqual([]);
});

test("automatic reset failures report once while other sources clear independently", async () => {
  const renderer = createRetainedRenderer();
  const failure = new Error("routes reset failed");
  const errors: unknown[] = [];
  const other = { source: "other", id: 1 };
  let attempts = 0;
  const state = new NativeFeatureState(async (target) => {
    if (target.source === "routes") {
      attempts += 1;
      throw failure;
    }
    await renderer.reset(target);
  });
  for (const target of [route, other]) {
    state.register(target.source);
    await state.run(
      target,
      async () => renderer.set(target, { selected: true }),
      true
    );
  }
  state.resetStyle();

  await state.flush((error) => errors.push(error));
  await state.flush((error) => errors.push(error));
  expect(renderer.get(route)).toEqual({ selected: true });
  expect(renderer.get(other)).toEqual({});
  expect(errors).toEqual([failure]);
  expect(attempts).toBe(1);
  await expect(state.run(route, async () => renderer.get(route))).rejects.toBe(
    failure
  );
});

test("an automatic failure stays sticky until a later style's readiness retries it", async () => {
  const renderer = createRetainedRenderer();
  const failure = new Error("reset failed");
  const errors: unknown[] = [];
  let fails = true;
  const state = new NativeFeatureState(async (target) => {
    if (fails) throw failure;
    await renderer.reset(target);
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.resetStyle();
  await state.flush((error) => errors.push(error));
  fails = false;
  await state.flush((error) => errors.push(error));
  expect(renderer.get(route)).toEqual({ selected: true });
  state.resetStyle();

  await state.flush((error) => errors.push(error));
  expect(renderer.get(route)).toEqual({});
  expect(errors).toEqual([failure]);
});

test("detachment cancels an automatic flush without reporting stale errors", async () => {
  const renderer = createRetainedRenderer();
  const started = deferred();
  const complete = deferred();
  const failure = new Error("retired source reset failed");
  const errors: unknown[] = [];
  const state = new NativeFeatureState(async () => {
    started.resolve();
    await complete.promise;
    throw failure;
  });
  state.register("routes");
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  const detach = state.register("routes");
  const flushing = state.flush((error) => errors.push(error));
  await started.promise;
  detach();
  complete.resolve();

  await flushing;
  await state.flush((error) => errors.push(error));
  expect(errors).toEqual([]);
});

test("automatic cleanup skips detached sources and preserves unwritten initial state", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  renderer.set(route, { external: true });
  const detach = state.register("routes");
  await state.flush(() => {});
  expect(renderer.get(route)).toEqual({ external: true });
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.resetStyle();
  detach();

  await state.flush(() => {});
  expect(renderer.removals).toEqual([]);
  state.register("routes");
  await state.flush(() => {});
  expect(renderer.get(route)).toEqual({});
});

test("first owned registration preserves state written through a raw style source", async () => {
  const renderer = createRetainedRenderer();
  const state = new NativeFeatureState(renderer.reset);
  await state.run(
    route,
    async () => renderer.set(route, { selected: true }),
    true
  );
  state.register("routes", "geojson");
  await state.flush(() => {});
  expect(renderer.get(route)).toEqual({});
  expect(renderer.removals).toEqual([route]);
});

test.each([
  ["geojson", "vector"],
  ["vector", "geojson"],
])(
  "%s to %s starts a new family namespace but retains same-family cleanup",
  async (previous, next) => {
    const removals: FeatureIdentifier[] = [];
    const errors: unknown[] = [];
    const state = new NativeFeatureState(async (target) => {
      removals.push(target);
    });
    // A GeoJSON caller may supply sourceLayer, although its native ref ignores it.
    // The family must come from registration rather than this public identifier.
    const target = { source: "shared", id: 1, sourceLayer: "way" };
    state.register("shared", previous);
    await state.run(target, async () => undefined, true);
    state.register("shared", next);
    await state.flush((error) => errors.push(error));
    await state.run(target, async () => undefined, true);
    expect(removals).toEqual([]);
    state.register("shared", next);
    await state.flush((error) => errors.push(error));
    expect(removals).toEqual([target]);
    expect(errors).toEqual([]);
  }
);

test.each([
  ["geojson", "vector"],
  ["vector", "geojson"],
])(
  "%s to %s waits for started writes and cancels queued old writes",
  async (previous, next) => {
    const started = deferred();
    const complete = deferred();
    const order: string[] = [];
    const removals: FeatureIdentifier[] = [];
    const state = new NativeFeatureState(async (target) => {
      removals.push(target);
    });
    const oldTarget = { source: "shared", id: 1, sourceLayer: "way" };
    const newTarget = { source: "shared", id: 2, sourceLayer: "way" };
    state.register("shared", previous);
    const oldWrite = state.run(
      oldTarget,
      async () => {
        started.resolve();
        await complete.promise;
        order.push("old write settled");
      },
      true
    );
    const oldRejection = expect(oldWrite).rejects.toThrow("changed during");
    await started.promise;
    const queuedWrite = state.run(
      oldTarget,
      async () => {
        order.push("queued old write dispatched");
      },
      true
    );
    const queuedRejection =
      expect(queuedWrite).rejects.toThrow("changed during");
    state.register("shared", next);
    const newWrite = state.run(
      newTarget,
      async () => {
        order.push("new write");
      },
      true
    );
    expect(order).toEqual([]);
    complete.resolve();
    await Promise.all([oldRejection, queuedRejection, newWrite]);
    expect(order).toEqual(["old write settled", "new write"]);
    expect(removals).toEqual([]);
    state.register("shared", next);
    await state.flush(() => {});
    expect(removals).toEqual([newTarget]);
  }
);

test.each(["geojson", "vector"] as const)(
  "%s roundtrip restores only that family's journal and clears every target before a returning read",
  async (firstFamily) => {
    const renderer = createFamilyRetainedRenderer(firstFamily);
    const state = new NativeFeatureState(renderer.reset);
    const nextFamily = firstFamily === "vector" ? "geojson" : "vector";
    const firstTargets = familyTargets(firstFamily);
    const nextTargets = familyTargets(nextFamily);
    state.register("shared", firstFamily);
    for (const [index, target] of firstTargets.entries()) {
      await state.run(
        target,
        async () => renderer.set(target, { count: index + 2 }),
        true
      );
    }

    renderer.activate(nextFamily);
    state.register("shared", nextFamily);
    await state.flush(renderer.reportError);
    expect(renderer.removals).toEqual([]);
    for (const target of nextTargets) {
      await state.run(
        target,
        async () => renderer.set(target, { selected: true, count: 9 }),
        true
      );
    }
    state.resetStyle();
    await state.flush(renderer.reportError);
    expect(renderer.removals.map((removal) => removal.family)).toEqual(
      nextTargets.map(() => nextFamily)
    );
    // Re-arm the inactive family's journal with destination writes. Native
    // replacement deliberately keeps both families' state in this renderer.
    for (const target of nextTargets) {
      await state.run(
        target,
        async () => renderer.set(target, { selected: true }),
        true
      );
    }

    renderer.activate(firstFamily);
    state.register("shared", firstFamily);
    expect(renderer.get(firstTargets[0])).not.toEqual({});
    expect(
      await state.run(firstTargets[0], async () =>
        renderer.get(firstTargets[0])
      )
    ).toEqual({});
    for (const target of firstTargets) expect(renderer.get(target)).toEqual({});
    expect(
      renderer.removals
        .slice(nextTargets.length)
        .map((removal) => removal.target)
    ).toEqual(firstTargets);
    expect(renderer.errors).toEqual([]);

    renderer.activate(nextFamily);
    state.register("shared", nextFamily);
    await state.flush(renderer.reportError);
    for (const target of nextTargets) expect(renderer.get(target)).toEqual({});
    expect(renderer.errors).toEqual([]);
  }
);

test("returning vector frames clear retained targets after a partial old write without replaying canceled queued writes", async () => {
  const renderer = createFamilyRetainedRenderer("vector");
  const state = new NativeFeatureState(renderer.reset);
  const oldTarget = familyTargets("vector")[0];
  const queuedTarget = familyTargets("vector")[1];
  const nextTarget = familyTargets("geojson")[0];
  const started = deferred();
  const complete = deferred();
  const failure = new Error("native partial write failed");
  state.register("shared", "vector");
  const oldWrite = state.run(
    oldTarget,
    async () => {
      started.resolve();
      await complete.promise;
      renderer.setForFamily("vector", oldTarget, { count: 2 });
      throw failure;
    },
    true
  );
  const oldRejection = expect(oldWrite).rejects.toBe(failure);
  await started.promise;
  let queuedDispatched = false;
  const queuedWrite = state.run(
    queuedTarget,
    async () => {
      queuedDispatched = true;
    },
    true
  );
  const queuedRejection = expect(queuedWrite).rejects.toThrow("changed during");
  renderer.activate("geojson");
  state.register("shared", "geojson");
  const geojsonWrite = state.run(
    nextTarget,
    async () => renderer.set(nextTarget, { selected: true }),
    true
  );
  expect(renderer.get(nextTarget)).toEqual({});
  complete.resolve();
  await Promise.all([oldRejection, queuedRejection, geojsonWrite]);
  expect(queuedDispatched).toBe(false);
  expect(renderer.removals).toEqual([]);

  renderer.activate("vector");
  state.register("shared", "vector");
  await state.flush(renderer.reportError);
  expect(renderer.get(oldTarget)).toEqual({});
  expect(renderer.removals).toEqual([{ family: "vector", target: oldTarget }]);
  expect(renderer.errors).toEqual([]);
});

test.each(["geojson", "vector"] as const)(
  "%s roundtrip frame cleanup waits for an old write and cancels an intermediate queued write",
  async (firstFamily) => {
    const renderer = createFamilyRetainedRenderer(firstFamily);
    const state = new NativeFeatureState(renderer.reset);
    const nextFamily = firstFamily === "vector" ? "geojson" : "vector";
    const oldTarget = familyTargets(firstFamily)[0];
    const nextTarget = familyTargets(nextFamily)[0];
    const started = deferred();
    const complete = deferred();
    state.register("shared", firstFamily);
    const oldWrite = state.run(
      oldTarget,
      async () => {
        started.resolve();
        await complete.promise;
        renderer.setForFamily(firstFamily, oldTarget, {
          selected: true,
          count: 2,
        });
      },
      true
    );
    const oldRejection = expect(oldWrite).rejects.toThrow("changed during");
    await started.promise;
    renderer.activate(nextFamily);
    state.register("shared", nextFamily);
    let intermediateDispatched = false;
    const intermediateWrite = state.run(
      nextTarget,
      async () => {
        intermediateDispatched = true;
      },
      true
    );
    const intermediateRejection =
      expect(intermediateWrite).rejects.toThrow("changed during");
    renderer.activate(firstFamily);
    state.register("shared", firstFamily);
    const flushing = state.flush(renderer.reportError);
    expect(renderer.removals).toEqual([]);
    complete.resolve();
    await Promise.all([oldRejection, intermediateRejection, flushing]);
    expect(intermediateDispatched).toBe(false);
    expect(renderer.get(oldTarget)).toEqual({});
    expect(renderer.removals).toEqual([
      { family: firstFamily, target: oldTarget },
    ]);
    expect(renderer.errors).toEqual([]);
  }
);

test("raw source adoption preserves tracked targets before later family roundtrips", async () => {
  const renderer = createFamilyRetainedRenderer("vector");
  const state = new NativeFeatureState(renderer.reset);
  const targets = familyTargets("vector");
  for (const target of targets) {
    await state.run(
      target,
      async () => renderer.set(target, { selected: true }),
      true
    );
  }
  state.register("shared", "vector");
  await state.flush(renderer.reportError);
  for (const target of targets) expect(renderer.get(target)).toEqual({});
  expect(renderer.removals.map((removal) => removal.target)).toEqual(targets);
  expect(renderer.errors).toEqual([]);
});

test("a returning family's failed reset remains visible until another lifetime retries its retained journal", async () => {
  const renderer = createFamilyRetainedRenderer("vector");
  const failure = new Error("returning vector reset failed");
  let fails = false;
  const state = new NativeFeatureState(async (target) => {
    if (fails) throw failure;
    await renderer.reset(target);
  });
  const target = familyTargets("vector")[0];
  state.register("shared", "vector");
  await state.run(target, async () => renderer.set(target, { count: 2 }), true);
  renderer.activate("geojson");
  state.register("shared", "geojson");
  await state.flush(renderer.reportError);
  renderer.activate("vector");
  state.register("shared", "vector");
  fails = true;
  await state.flush(renderer.reportError);
  await state.flush(renderer.reportError);
  expect(renderer.errors).toEqual([failure]);
  expect(renderer.get(target)).toEqual({ count: 2 });
  fails = false;
  await expect(
    state.run(target, async () => renderer.get(target))
  ).rejects.toBe(failure);
  state.register("shared", "vector");
  await state.flush(renderer.reportError);
  expect(renderer.get(target)).toEqual({});
});

const route: FeatureIdentifier = { source: "routes", id: 1 };

const createRetainedRenderer = () => {
  const values = new Map<string, FeatureState>();
  const removals: FeatureIdentifier[] = [];

  return {
    removals,
    get: (target: FeatureIdentifier): FeatureState =>
      values.get(targetKey(target)) ?? {},
    set: (target: FeatureIdentifier, state: FeatureState): void => {
      values.set(targetKey(target), {
        ...values.get(targetKey(target)),
        ...state,
      });
    },
    reset: async (target: FeatureIdentifier): Promise<void> => {
      removals.push(target);
      values.delete(targetKey(target));
    },
  };
};

const targetKey = (target: FeatureIdentifier): string =>
  JSON.stringify([target.source, target.sourceLayer, String(target.id)]);

const deferred = () => {
  let resolve: () => void = () => {
    throw new Error("Promise not initialized");
  };
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve: () => resolve() };
};

type SourceFamily = "vector" | "geojson";

const familyTargets = (family: SourceFamily): FeatureIdentifier[] => {
  if (family === "geojson")
    return [1, 2].map((id) => ({ source: "shared", id }));
  return ["routes", "alternates"].flatMap((sourceLayer) =>
    [1, 2].map((id) => ({ source: "shared", sourceLayer, id }))
  );
};

/** Model separate SDK family namespaces retained behind the same source id. */
const createFamilyRetainedRenderer = (initialFamily: SourceFamily) => {
  let activeFamily = initialFamily;
  const values = new Map<string, FeatureState>();
  const removals: { family: SourceFamily; target: FeatureIdentifier }[] = [];
  const errors: unknown[] = [];
  const key = (family: SourceFamily, target: FeatureIdentifier) =>
    JSON.stringify([family, targetKey(target)]);
  const assertTarget = (
    target: FeatureIdentifier | undefined
  ): FeatureIdentifier => {
    if (!target) throw new Error("Missing fixture target.");
    if ((activeFamily === "vector") !== (target.sourceLayer !== undefined))
      throw new Error(`Incompatible ${activeFamily} cleanup target.`);
    return target;
  };
  const setForFamily = (
    family: SourceFamily,
    target: FeatureIdentifier | undefined,
    value: FeatureState
  ) => {
    if (!target) throw new Error("Missing fixture target.");
    const identifier = key(family, target);
    values.set(identifier, { ...values.get(identifier), ...value });
  };
  return {
    removals,
    errors,
    reportError: (error: unknown) => {
      errors.push(error);
    },
    activate: (family: SourceFamily) => {
      activeFamily = family;
    },
    get: (target: FeatureIdentifier | undefined): FeatureState =>
      values.get(key(activeFamily, assertTarget(target))) ?? {},
    set: (target: FeatureIdentifier | undefined, value: FeatureState): void => {
      setForFamily(activeFamily, assertTarget(target), value);
    },
    setForFamily,
    reset: async (target: FeatureIdentifier): Promise<void> => {
      assertTarget(target);
      removals.push({ family: activeFamily, target });
      values.delete(key(activeFamily, target));
    },
  };
};
