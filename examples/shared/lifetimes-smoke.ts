import type {
  FeatureIdentifier,
  FeatureState,
  GeoJsonFeature,
  MapRef,
  MapStyle,
} from "one-map-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  initialViewState,
  queriesStyle,
  replacementStyle,
} from "../../tests/fixtures/map-fixture.js";

type LifetimesPhase =
  | "await-load"
  | "vector"
  | "remount"
  | "style"
  | "to-geojson"
  | "to-vector"
  | "final-remount"
  | "done";

interface LifetimesScene {
  readonly phase: LifetimesPhase;
  readonly family: "geojson" | "vector";
  readonly sourceRevision: number;
  readonly mapStyle: MapStyle;
}

interface LifetimesSmokeOptions {
  readonly mapRef: { readonly current: MapRef | null };
  readonly statusUrl?: string;
}

interface LifetimesSmoke extends LifetimesScene {
  readonly status: string;
  readonly onLoad: () => void;
  readonly onStyleLoad: () => void;
  readonly onError: (event: { readonly error?: unknown }) => void;
}

interface LifetimeFields {
  loaded: string;
  vectorQueries: string;
  keyRemove: string;
  wholeRemove: string;
  vectorNamespaces: string;
  vectorRemount: string;
  vectorStyle: string;
  vectorToGeojson: string;
  geojsonToVector: string;
  finalRemount: string;
  error: string;
}

/**
 * Observes vector feature-state namespaces across keyed source lifetimes and
 * both family changes. The application explicitly clears destination state
 * after every transition, then reapplies its values. Generation-bearing tiles
 * establish attachment before any ref-based source query or state operation.
 */
export const useLifetimesSmoke = ({
  mapRef,
  statusUrl,
}: LifetimesSmokeOptions): LifetimesSmoke => {
  const mounted = useRef(false);
  const loaded = useRef(false);
  const styleLoaded = useRef(false);
  const fields = useRef<LifetimeFields>(initialFields());
  const phaseRef = useRef<LifetimesPhase>("await-load");
  const [scene, setScene] = useState<LifetimesScene>({
    phase: "await-load",
    family: "vector",
    sourceRevision: 0,
    mapStyle: queriesStyle,
  });
  const [status, setStatus] = useState(() =>
    statusLine(initialFields(), "await-load")
  );
  const enter = (
    phase: LifetimesPhase,
    update: Partial<Omit<LifetimesScene, "phase">> = {}
  ) => {
    if (!mounted.current) return;
    phaseRef.current = phase;
    // Commit family, key, style, and phase together before the next flight.
    setScene((previous) => ({ ...previous, ...update, phase }));
    const next = statusLine(fields.current, phase);
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
    if (scene.phase === "done") return;
    const controller = new AbortController();
    const { signal } = controller;
    const nextFields = { ...fields.current };
    const commit = (
      phase: LifetimesPhase,
      update: Partial<Omit<LifetimesScene, "phase">> = {}
    ) => {
      assertActive(signal);
      fields.current = nextFields;
      enterRef.current(phase, update);
    };
    const timer = setTimeout(() => {
      if (signal.aborted) return;
      nextFields.error = "phase-timeout";
      commit("done");
      controller.abort();
    }, 30000);

    void (async () => {
      try {
        if (scene.phase === "await-load") {
          await observe(
            () => Promise.resolve(loaded.current),
            "map load",
            signal,
            30000
          );
          nextFields.loaded = "1";
          commit("vector");
          return;
        }
        const map = requireMap(mapRef);
        if (scene.phase === "vector") {
          await map.jumpTo({
            center: [initialViewState.longitude, initialViewState.latitude],
            zoom: 11,
            bearing: 0,
            pitch: 0,
          });
          await observe(
            async () => {
              const center = await map.getCenter();
              assertActive(signal);
              const zoom = await map.getZoom();
              return (
                Math.abs(center[0] - initialViewState.longitude) < 0.001 &&
                Math.abs(center[1] - initialViewState.latitude) < 0.001 &&
                Math.abs(zoom - 11) < 0.05
              );
            },
            "fixture camera",
            signal
          );
        }
        if (scene.phase === "style") {
          await observe(
            () => Promise.resolve(styleLoaded.current),
            "replacement style load",
            signal,
            20000
          );
        }
        await sourceReady(map, scene, signal);
        const targets = identifiers(scene.family);

        if (scene.phase === "vector") {
          nextFields.vectorQueries = "ok";
          await assertInitialOperations(map, targets[0], signal);
          nextFields.keyRemove = "ok";
          nextFields.wholeRemove = "ok";
          await writeAndVerify(map, targets, signal);
          nextFields.vectorNamespaces = "ok";
          commit("remount", { sourceRevision: scene.sourceRevision + 1 });
        } else {
          // State may persist or disappear with the selected renderer lifetime.
          for (const target of targets) {
            await map.removeFeatureState(target);
            assertActive(signal);
          }
          await assertEmptyState(map, targets, signal);
          if (scene.phase === "remount") {
            nextFields.vectorRemount = "explicitly-cleared";
            await writeAndVerify(map, targets, signal);
            styleLoaded.current = false;
            commit("style", {
              mapStyle: replacementStyle,
            });
          } else if (scene.phase === "style") {
            nextFields.vectorStyle = "explicitly-cleared";
            await writeAndVerify(map, targets, signal);
            commit("to-geojson", {
              family: "geojson",
              sourceRevision: scene.sourceRevision + 1,
            });
          } else if (scene.phase === "to-geojson") {
            await assertInitialOperations(map, targets[0], signal);
            await writeAndVerify(map, targets, signal);
            nextFields.vectorToGeojson = "explicitly-cleared";
            commit("to-vector", {
              family: "vector",
              sourceRevision: scene.sourceRevision + 1,
            });
          } else if (scene.phase === "to-vector") {
            await writeAndVerify(map, targets, signal);
            nextFields.geojsonToVector = "explicitly-cleared";
            commit("final-remount", {
              sourceRevision: scene.sourceRevision + 1,
            });
          } else if (scene.phase === "final-remount") {
            nextFields.finalRemount = "explicitly-cleared";
            commit("done");
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        nextFields.error = errorText(error);
        commit("done");
      }
    })();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scene, mapRef]);

  const onLoad = useCallback(() => {
    if (mounted.current) loaded.current = true;
  }, []);
  const onStyleLoad = useCallback(() => {
    if (mounted.current) styleLoaded.current = true;
  }, []);
  const onError = useCallback((event: { readonly error?: unknown }) => {
    if (!mounted.current || phaseRef.current === "done") return;
    fields.current.error = errorText(event.error);
    enterRef.current("done");
  }, []);

  return { ...scene, status, onLoad, onStyleLoad, onError };
};

const requireMap = (mapRef: { readonly current: MapRef | null }): MapRef => {
  if (!mapRef.current) throw new Error("Lifetime map handle was not attached.");
  return mapRef.current;
};

/** The map-level generation read avoids dispatch to an unpublished native tag. */
const sourceReady = async (
  map: MapRef,
  scene: LifetimesScene,
  signal: AbortSignal
): Promise<void> => {
  await observe(
    async () =>
      hasRevision(
        await map.queryRenderedFeatures(undefined),
        scene.sourceRevision,
        [1]
      ),
    "rendered source readiness",
    signal,
    10000
  );
  const layers =
    scene.family === "vector" ? ["routes", "alternates"] : [undefined];
  for (const sourceLayer of layers) {
    await observe(
      async () => {
        const features = await map.querySourceFeatures(
          "lifetime-routes",
          sourceLayer === undefined ? undefined : { sourceLayer }
        );
        return hasRevision(features, scene.sourceRevision, [1, 2]);
      },
      `source ${sourceLayer ?? "geojson"} readiness`,
      signal,
      10000
    );
  }
};

const hasRevision = (
  features: readonly GeoJsonFeature[],
  revision: number,
  ids: readonly number[]
): boolean =>
  ids.every((id) =>
    features.some(
      (feature) =>
        String(feature.id) === String(id) &&
        feature.properties?.__oneMapSourceRevision === revision
    )
  );

const identifiers = (family: LifetimesScene["family"]): FeatureIdentifier[] => {
  if (family === "geojson")
    return [1, 2].map((id) => ({ source: "lifetime-routes", id }));
  return ["routes", "alternates"].flatMap((sourceLayer) =>
    [1, 2].map((id) => ({ source: "lifetime-routes", sourceLayer, id }))
  );
};

const assertInitialOperations = async (
  map: MapRef,
  target: FeatureIdentifier | undefined,
  signal: AbortSignal
): Promise<void> => {
  if (!target) throw new Error("Fixture has no state target.");
  await map.setFeatureState(target, { selected: true, count: 2 });
  assertActive(signal);
  await assertState(map, target, { selected: true, count: 2 }, signal);
  await map.removeFeatureState(target, "selected");
  await observe(
    async () => {
      const state = await map.getFeatureState(target);
      assertActive(signal);
      if (state.count !== 2) throw new Error("Key removal also removed count.");
      return state.selected === undefined;
    },
    "key state removal",
    signal
  );
  await map.removeFeatureState(target);
  await assertEmptyState(map, [target], signal);
};

const writeAndVerify = async (
  map: MapRef,
  targets: readonly FeatureIdentifier[],
  signal: AbortSignal
): Promise<void> => {
  for (const [index, target] of targets.entries()) {
    const expected = { selected: true, count: index + 2 };
    await map.setFeatureState(target, expected);
    assertActive(signal);
  }
  // Read after all writes so aliasing source layers or ids is observable.
  for (const [index, target] of targets.entries()) {
    await assertState(
      map,
      target,
      { selected: true, count: index + 2 },
      signal
    );
    assertActive(signal);
  }
};

const assertState = async (
  map: MapRef,
  target: FeatureIdentifier,
  expected: FeatureState,
  signal: AbortSignal
): Promise<void> => {
  const state = await map.getFeatureState(target);
  assertActive(signal);
  if (state.selected !== expected.selected || state.count !== expected.count) {
    throw new Error(
      `State mismatch for ${target.sourceLayer ?? "geojson"}/${target.id}: ${JSON.stringify(state)}`
    );
  }
};

const assertEmptyState = async (
  map: MapRef,
  targets: readonly FeatureIdentifier[],
  signal: AbortSignal
): Promise<void> => {
  for (const target of targets) {
    await observe(
      async () => Object.keys(await map.getFeatureState(target)).length === 0,
      `whole state removal ${target.sourceLayer ?? "geojson"}/${target.id}`,
      signal
    );
  }
};

/** Retries successful pending observations; operational errors reject at once. */
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

const assertActive = (signal: AbortSignal): void => {
  if (signal.aborted) throw new Error("Smoke phase cancelled.");
};

const initialFields = (): LifetimeFields => ({
  loaded: "pending",
  vectorQueries: "pending",
  keyRemove: "pending",
  wholeRemove: "pending",
  vectorNamespaces: "pending",
  vectorRemount: "pending",
  vectorStyle: "pending",
  vectorToGeojson: "pending",
  geojsonToVector: "pending",
  finalRemount: "pending",
  error: "none",
});

const errorText = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(/\s+/g, "-").slice(0, 160);
};

const statusLine = (fields: LifetimeFields, phase: LifetimesPhase): string =>
  `TF06L loaded=${fields.loaded} vector-queries=${fields.vectorQueries} key-remove=${fields.keyRemove} whole-remove=${fields.wholeRemove} vector-namespaces=${fields.vectorNamespaces} vector-remount=${fields.vectorRemount} vector-style=${fields.vectorStyle} vector-to-geojson=${fields.vectorToGeojson} geojson-to-vector=${fields.geojsonToVector} final-remount=${fields.finalRemount} error=${fields.error} phase=${phase} done=${phase === "done" ? 1 : 0}`;
