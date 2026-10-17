import type { GeoJsonFeature, MapRef, MapStyle } from "one-map-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  clusteredPoints,
  initialViewState,
  queriesStyle,
  replacementStyle,
} from "../../tests/fixtures/map-fixture.js";

type QueriesPhase =
  | "await-load"
  | "queries"
  | "state"
  | "recreate"
  | "reset"
  | "done";

interface QueriesSmokeOptions {
  /**
   * Where the native runner reads the status line.
   *
   * @remarks
   * The iOS simulator posts here because its Metro log does not carry
   * `console.log`. Android keeps using logcat.
   */
  readonly statusUrl?: string;
  /** Imperative handle the assertions dispatch through. */
  readonly mapRef: { readonly current: MapRef | null };
}

interface QueriesSmoke {
  readonly phase: QueriesPhase;
  readonly status: string;
  readonly mapStyle: MapStyle;
  readonly sourceRevision: number;
  readonly onLoad: () => void;
  readonly onStyleLoad: () => void;
  readonly onError: (event: { readonly error?: unknown }) => void;
}

/** Scene inputs that must change in the same React commit as their phase. */
interface QueriesScene {
  readonly phase: QueriesPhase;
  readonly mapStyle: MapStyle;
  readonly sourceRevision: number;
}

interface SmokeFields {
  loaded: string;
  point: string;
  bounds: string;
  viewport: string;
  empty: string;
  source: string;
  clusterZoom: string;
  leaves: string;
  children: string;
  setState: string;
  getState: string;
  removeState: string;
  clearedState: string;
  recreatedState: string;
  wholeState: string;
  filters: string;
  pagination: string;
  error: string;
  note: string;
}

/**
 * Drives the TF06 queries smoke: rendered point, bounds, and viewport
 * queries with known feature ids, an empty off-screen result, a source
 * query, cluster expansion, leaves, and children, then feature-state
 * set/get/remove through a `feature-state` paint expression, followed by
 * source recreation and style replacement clearing feature state.
 *
 * @remarks
 * Known-feature assertions stay independent of pixel rendering: each query
 * checks the ids the fixture pins, which survive SDK tile encoding.
 * Android GeoJSON bridges stringify numeric ids, so smoke comparisons use
 * their string identities without changing facade results. A conversion or
 * renderer failure reports through `onError` or a bounded phase timeout.
 */
export const useQueriesSmoke = ({
  statusUrl,
  mapRef,
}: QueriesSmokeOptions): QueriesSmoke => {
  const fields = useRef<SmokeFields>(initialFields());
  const phaseRef = useRef<QueriesPhase>("await-load");
  const loaded = useRef(false);
  const styleLoaded = useRef(false);
  const mounted = useRef(false);
  const [{ phase, mapStyle, sourceRevision }, setScene] =
    useState<QueriesScene>({
      phase: "await-load",
      mapStyle: queriesStyle,
      sourceRevision: 0,
    });
  const [status, setStatus] = useState(() =>
    statusLine(initialFields(), "await-load")
  );
  const publish = () => {
    if (!mounted.current) return;
    const next = statusLine(fields.current, phaseRef.current);
    console.log(next);
    setStatus(next);
    if (statusUrl) {
      void fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: next,
      }).catch(() => undefined);
    }
  };
  const enter = (
    next: QueriesPhase,
    sceneUpdate: Partial<Omit<QueriesScene, "phase">> = {}
  ) => {
    if (!mounted.current) return;
    phaseRef.current = next;
    // A native effect must never enter recreation with the previous Source key.
    setScene((previous) => ({ ...previous, ...sceneUpdate, phase: next }));
    publish();
  };
  const enterRef = useRef(enter);
  useLayoutEffect(() => {
    enterRef.current = enter;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase === "done") return;
    const controller = new AbortController();
    const { signal } = controller;
    // Work is local until the phase finishes, so late resolutions cannot publish.
    const nextFields = { current: { ...fields.current } };
    const commit = (next: QueriesPhase) => {
      assertActive(signal);
      fields.current = nextFields.current;
      enterRef.current(next);
    };
    const timer = setTimeout(() => {
      if (signal.aborted) return;
      nextFields.current.error = "phase-timeout";
      commit("done");
      controller.abort();
    }, 30000);
    void (async () => {
      try {
        if (phase === "await-load") {
          await observe(
            () => Promise.resolve(loaded.current),
            "map load",
            signal,
            30000
          );
          nextFields.current.loaded = "1";
          // Enter before dispatch: the query phase owns exactly one flight.
          commit("queries");
        } else if (phase === "queries") {
          const map = requireMap(mapRef);
          // Position this query fixture explicitly. TF02 separately records the
          // pinned Mapbox Android opening-camera limitation on a cold cache.
          await map.jumpTo({
            center: [initialViewState.longitude, initialViewState.latitude],
            zoom: initialViewState.zoom,
            bearing: 0,
            pitch: 0,
          });
          assertActive(signal);
          await observe(
            async () => {
              const center = await map.getCenter();
              assertActive(signal);
              const zoom = await map.getZoom();
              return (
                Math.abs(center[0] - initialViewState.longitude) < 0.001 &&
                Math.abs(center[1] - initialViewState.latitude) < 0.001 &&
                Math.abs(zoom - initialViewState.zoom) < 0.05
              );
            },
            "fixture camera",
            signal
          );
          await sourceReady(map, sourceRevision, signal);
          await assertQueries(mapRef, nextFields, signal);
          commit("state");
        } else if (phase === "state") {
          await assertState(mapRef, nextFields, signal);
          assertActive(signal);
          fields.current = nextFields.current;
          enterRef.current("recreate", {
            sourceRevision: sourceRevision + 1,
          });
        } else if (phase === "recreate") {
          const map = requireMap(mapRef);
          await sourceReady(map, sourceRevision, signal);
          await observeStateRemoval(map, signal, true);
          nextFields.current.recreatedState = "cleared";
          await setAndVerifyState(map, signal);
          assertActive(signal);
          // Rearm before requesting replacement; synchronous load is retained.
          styleLoaded.current = false;
          fields.current = nextFields.current;
          enterRef.current("reset", { mapStyle: replacementStyle });
        } else if (phase === "reset") {
          await observe(
            () => Promise.resolve(styleLoaded.current),
            "replacement style load",
            signal,
            20000
          );
          const map = requireMap(mapRef);
          await sourceReady(map, sourceRevision, signal);
          await observeStateRemoval(map, signal, true);
          nextFields.current.clearedState = "cleared";
          commit("done");
        }
      } catch (error) {
        if (signal.aborted) return;
        nextFields.current.error = errorText(error);
        commit("done");
      }
    })();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phase, mapRef, sourceRevision]);

  return {
    phase,
    status,
    mapStyle,
    sourceRevision,
    onLoad: () => {
      if (mounted.current) loaded.current = true;
    },
    onStyleLoad: () => {
      if (mounted.current) styleLoaded.current = true;
    },
    onError: (event) => {
      if (!mounted.current) return;
      fields.current.error = errorText(event.error);
      enterRef.current("done");
    },
  };
};

// Each read finishes before the next one starts. Operational errors propagate
// immediately; only a successful observation of pending work is retried.
const observe = async (
  read: () => Promise<boolean>,
  label: string,
  signal: AbortSignal,
  timeout = 5000
): Promise<void> => {
  const deadline = Date.now() + timeout;
  while (true) {
    assertActive(signal);
    const done = await read();
    assertActive(signal);
    if (done) return;
    if (Date.now() >= deadline)
      throw new Error(`${label} timed out after ${timeout} ms.`);
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("Smoke phase cancelled."));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 100);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
};

const identifier = { source: "queries-routes", id: 1 };
const observeStateRemoval = (map: MapRef, signal: AbortSignal, whole = false) =>
  observe(
    async () => {
      const state = await map.getFeatureState(identifier);
      return whole
        ? Object.keys(state).length === 0
        : state.selected === undefined;
    },
    whole ? "whole state removal" : "selected state removal",
    signal
  );

/** Waits through the stable map handle before dispatching to an attaching ref. */
const sourceReady = async (
  map: MapRef,
  sourceRevision: number,
  signal: AbortSignal
): Promise<void> => {
  // A React ref may already exist while Fabric has not published its native
  // tag. New-generation rendered data establishes Source/layer attachment.
  await observe(
    async () =>
      hasSourceRevision(
        await map.queryRenderedFeatures(undefined),
        sourceRevision
      ),
    "rendered source readiness",
    signal,
    10000
  );
  await observe(
    async () => {
      try {
        const features = await map.querySourceFeatures("queries-routes");
        // Native source tiles can outlive the React commit that replaces their
        // source. The stable feature id alone cannot establish new readiness.
        return hasSourceRevision(features, sourceRevision);
      } catch (error) {
        if (
          error instanceof Error &&
          /not (present|a mounted)/.test(error.message)
        )
          return false;
        throw error;
      }
    },
    "source readiness",
    signal,
    10000
  );
};

const hasSourceRevision = (
  features: readonly GeoJsonFeature[],
  sourceRevision: number
): boolean =>
  features.some(
    (feature) =>
      String(feature.id) === "1" &&
      feature.properties?.__oneMapSourceRevision === sourceRevision
  );

const setAndVerifyState = async (
  map: MapRef,
  signal: AbortSignal
): Promise<void> => {
  await map.setFeatureState(identifier, { selected: true, count: 2 });
  assertActive(signal);
  const state = await map.getFeatureState(identifier);
  assertActive(signal);
  if (state.selected !== true || state.count !== 2)
    throw new Error(`state get after set was ${JSON.stringify(state)}`);
};

/**
 * Runs the rendered, source, and cluster assertions.
 *
 * @param mapRef - Imperative handle of the mounted smoke map.
 * @param fields - Mutable status fields this step marks on success.
 * @param signal - Phase cancellation signal.
 * @throws When a query result, order, or cluster payload disagrees with
 * the fixture's pinned values.
 */
const assertQueries = async (
  mapRef: { readonly current: MapRef | null },
  fields: { readonly current: SmokeFields },
  signal: AbortSignal
): Promise<void> => {
  const map = requireMap(mapRef);

  // The projected vertex sits exactly on route 1, so the point query must
  // return it. The nearby routes are within a few hundred pixels.
  const onLine = await map.project([-122.34, 47.62]);
  assertActive(signal);
  const pointFeatures = await map.queryRenderedFeatures(onLine);
  assertActive(signal);

  if (!pointFeatures.some((feature) => String(feature.id) === "1")) {
    throw new Error(`point query missed route 1: ${describe(pointFeatures)}`);
  }

  fields.current.point = "ok";

  const boundsFeatures = await map.queryRenderedFeatures([
    [onLine[0] - 400, onLine[1] - 300],
    [onLine[0] + 400, onLine[1] + 300],
  ]);
  assertActive(signal);

  if (!boundsFeatures.some((feature) => String(feature.id) === "2")) {
    throw new Error(`bounds query missed route 2: ${describe(boundsFeatures)}`);
  }

  fields.current.bounds = "ok";

  const viewportFeatures = await map.queryRenderedFeatures(undefined, {
    layers: ["queries-line"],
  });
  assertActive(signal);

  if (
    !viewportFeatures.some((feature) => String(feature.id) === "1") ||
    viewportFeatures.some((feature) => String(feature.id) === "3")
  ) {
    throw new Error(
      `viewport query wrong scope: ${describe(viewportFeatures)}`
    );
  }

  fields.current.viewport = "ok";

  const offscreen = await map.queryRenderedFeatures([2, 2], {
    layers: ["queries-line"],
  });
  assertActive(signal);

  if (offscreen.length !== 0) {
    throw new Error(`corner query was not empty: ${describe(offscreen)}`);
  }

  fields.current.empty = "ok";

  const sourceFeatures = await map.querySourceFeatures("queries-routes");
  assertActive(signal);

  // Source queries see loaded tiles, and the fixture camera covers both
  // on-screen routes, so route 1 must be present.
  if (
    !sourceFeatures.some((feature) => String(feature.id) === "1") ||
    sourceFeatures.some((feature) => String(feature.id) === "3")
  ) {
    throw new Error(
      `source query wrong loaded-tile scope: ${describe(sourceFeatures)}`
    );
  }

  fields.current.source = "ok";
  const filter = ["==", ["get", "route"], "north"] as const;
  const filteredRendered = await map.queryRenderedFeatures(undefined, {
    layers: ["queries-line"],
    filter,
  });
  assertActive(signal);
  const filteredSource = await map.querySourceFeatures("queries-routes", {
    filter,
  });
  assertActive(signal);
  for (const features of [filteredRendered, filteredSource]) {
    if (
      features.length === 0 ||
      features.some((feature) => String(feature.id) !== "1")
    ) {
      throw new Error(`filter query wrong result: ${describe(features)}`);
    }
  }
  fields.current.filters = "ok";

  const clusterId = await findClusterId(map, signal);
  assertActive(signal);
  const expansionZoom = await map.getClusterExpansionZoom(
    "queries-clusters",
    clusterId
  );
  assertActive(signal);

  if (typeof expansionZoom !== "number" || !Number.isFinite(expansionZoom)) {
    throw new Error(`expansion zoom was not finite: ${String(expansionZoom)}`);
  }

  fields.current.clusterZoom = "ok";

  const leaves = await map.getClusterLeaves(
    "queries-clusters",
    clusterId,
    10,
    0
  );
  assertActive(signal);

  const knownIds = new Set(
    clusteredPoints.features.map((feature) => String(feature.id))
  );
  if (
    leaves.length === 0 ||
    leaves.length > 6 ||
    new Set(leaves.map((leaf) => String(leaf.id))).size !== leaves.length ||
    leaves.some((leaf) => !knownIds.has(String(leaf.id)))
  ) {
    throw new Error(`leaves count out of range: ${leaves.length}`);
  }

  fields.current.leaves = "ok";
  const page = await map.getClusterLeaves("queries-clusters", clusterId, 1, 1);
  assertActive(signal);
  if (
    leaves.length < 2 ||
    page.length !== 1 ||
    String(page[0]?.id) !== String(leaves[1]?.id)
  )
    throw new Error("cluster pagination disagreed with leaves");
  fields.current.pagination = "ok";

  const children = await map.getClusterChildren("queries-clusters", clusterId);
  assertActive(signal);

  if (children.length === 0 || children.length > leaves.length) {
    throw new Error(
      `children ${children.length} exceeded leaves ${leaves.length}`
    );
  }

  fields.current.children = "ok";
};

/**
 * Runs the feature-state assertions through the paint expression.
 *
 * @param mapRef - Imperative handle of the mounted smoke map.
 * @param fields - Mutable status fields this step marks on success.
 * @param signal - Phase cancellation signal.
 * @throws When state set/get/remove or the style-reset clearing disagrees
 * with the contract.
 */
const assertState = async (
  mapRef: { readonly current: MapRef | null },
  fields: { readonly current: SmokeFields },
  signal: AbortSignal
): Promise<void> => {
  const map = requireMap(mapRef);
  await setAndVerifyState(map, signal);
  assertActive(signal);
  fields.current.getState = "ok";
  await map.removeFeatureState(identifier, "selected");
  assertActive(signal);
  await observeStateRemoval(map, signal);
  assertActive(signal);
  const remaining = await map.getFeatureState(identifier);
  assertActive(signal);
  if (remaining.count !== 2) throw new Error("key removal also removed count");
  fields.current.removeState = "ok";
  await setAndVerifyState(map, signal);
  assertActive(signal);
  await map.removeFeatureState(identifier);
  assertActive(signal);
  await observeStateRemoval(map, signal, true);
  assertActive(signal);
  fields.current.wholeState = "ok";
  // Verify state exists before source recreation, then again before style reset.
  await setAndVerifyState(map, signal);
  assertActive(signal);
  fields.current.setState = "ok";
};

const requireMap = (mapRef: { readonly current: MapRef | null }): MapRef => {
  const map = mapRef.current;

  if (!map) {
    throw new Error("Queries map handle was not attached.");
  }

  return map;
};

/**
 * Finds the rendered cluster feature's numeric id.
 *
 * @param map - Attached smoke map handle.
 * @param signal - Phase cancellation signal.
 * @returns The `cluster_id` property of a rendered cluster.
 * @throws When no cluster rendered at the fixture zoom.
 */
const findClusterId = async (
  map: MapRef,
  signal: AbortSignal
): Promise<number> => {
  let clusterId: number | undefined;
  await observe(
    async () => {
      const features = await map.queryRenderedFeatures(undefined, {
        layers: ["queries-cluster-circles"],
      });
      const cluster = features.find(
        (feature) =>
          (feature as { properties?: { cluster?: unknown } }).properties
            ?.cluster === true
      );
      const id = (
        cluster as { properties?: { cluster_id?: unknown } } | undefined
      )?.properties?.cluster_id;
      if (typeof id !== "number" || !Number.isFinite(id)) return false;
      clusterId = id;
      return true;
    },
    "rendered cluster readiness",
    signal
  );
  if (clusterId === undefined) throw new Error("No cluster rendered.");
  return clusterId;
};

const describe = (features: readonly unknown[]): string =>
  features
    .map((feature) => JSON.stringify(feature).slice(0, 60))
    .join(",")
    .slice(0, 240);

const initialFields = (): SmokeFields => ({
  loaded: "pending",
  point: "pending",
  bounds: "pending",
  viewport: "pending",
  empty: "pending",
  source: "pending",
  clusterZoom: "pending",
  leaves: "pending",
  children: "pending",
  setState: "pending",
  getState: "pending",
  removeState: "pending",
  clearedState: "pending",
  recreatedState: "pending",
  wholeState: "pending",
  filters: "pending",
  pagination: "pending",
  error: "none",
  note: "none",
});

const errorText = (error: unknown): string => {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "map-error";

  return text.replaceAll(/\s+/g, "-").slice(0, 80);
};

const statusLine = (fields: SmokeFields, phase: QueriesPhase): string =>
  `TF06 loaded=${fields.loaded} point=${fields.point} bounds=${fields.bounds} viewport=${fields.viewport} empty=${fields.empty} source=${fields.source} cluster-zoom=${fields.clusterZoom} leaves=${fields.leaves} children=${fields.children} set-state=${fields.setState} get-state=${fields.getState} remove-state=${fields.removeState} filters=${fields.filters} pagination=${fields.pagination} whole-state=${fields.wholeState} recreated-state=${fields.recreatedState} cleared-state=${fields.clearedState} error=${fields.error} note=${fields.note} phase=${phase} done=${phase === "done" ? 1 : 0}`;

const assertActive = (signal: AbortSignal): void => {
  if (signal.aborted) throw new Error("Smoke phase cancelled.");
};
