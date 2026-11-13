import type { GeoJsonFeature, MapRef } from "one-map-react";

interface QueryRenderer {
  readonly _listeners?: Readonly<Record<string, readonly unknown[]>>;
  readonly addSource: (
    id: string,
    source: { readonly type: "vector" | "raster"; readonly tiles: string[] }
  ) => void;
  readonly removeSource: (id: string) => void;
  readonly queryRenderedFeatures: (
    target: undefined,
    options?: { readonly layers: readonly string[] }
  ) => readonly GeoJsonFeature[];
}

interface QueryProbeOptions {
  readonly map: MapRef;
  readonly renderer: object;
  readonly expectedErrors: { current: unknown[] | undefined };
}

/**
 * Checks query failures against the selected SDK without replacing its methods.
 * The private listener readback is confined to this acceptance example.
 */
export const runWebQueryRegressions = async ({
  map,
  renderer,
  expectedErrors,
}: QueryProbeOptions): Promise<Readonly<Record<string, "ok">>> => {
  // The selected wrapper supplies an actual SDK map; no facade API exposes it.
  const sdk = renderer as QueryRenderer;
  if (!Array.isArray(sdk._listeners?.error))
    throw new Error(
      "The selected SDK does not expose its error listener list."
    );

  const listeners = () => sdk._listeners?.error?.length ?? 0;
  const baseline = listeners();
  const results: Record<string, "ok"> = {};
  const assertBalanced = () => {
    if (listeners() !== baseline)
      throw new Error("A query retained a temporary renderer error listener.");
  };
  const rejectBeforeDispatch = async (
    name: string,
    query: () => Promise<readonly GeoJsonFeature[]>,
    message: string
  ) => {
    let rejection: unknown;

    try {
      await query();
    } catch (error) {
      rejection = error;
    }

    if (!(rejection instanceof Error) || !rejection.message.includes(message))
      throw new Error(
        `${name} did not reject with the facade preflight error.`
      );

    assertBalanced();
    results[name] = "ok";
  };

  sdk.addSource("query-probe-vector", { type: "vector", tiles: [] });
  sdk.addSource("query-probe-raster", { type: "raster", tiles: [] });

  try {
    await rejectBeforeDispatch(
      "missing-source",
      () => map.querySourceFeatures("query-probe-missing"),
      'Source "query-probe-missing" is not present in the loaded style.'
    );
    await rejectBeforeDispatch(
      "unsupported-source",
      () => map.querySourceFeatures("query-probe-raster"),
      "Source queries require a GeoJSON or vector source."
    );

    for (const sourceLayer of [undefined, "", "   "]) {
      const name =
        sourceLayer === undefined ? "omitted" : `${sourceLayer.length}`;

      await rejectBeforeDispatch(
        `vector-layer-${name}`,
        () => map.querySourceFeatures("query-probe-vector", { sourceLayer }),
        "Vector source queries require a nonempty sourceLayer."
      );
    }

    await rejectBeforeDispatch(
      "missing-rendered-layer",
      () =>
        map.queryRenderedFeatures(undefined, {
          layers: ["queries-line", "query-probe-missing"],
        }),
      'Layer "query-probe-missing" is not present in the loaded style.'
    );

    for (const layers of [undefined, []]) {
      const options = layers === undefined ? undefined : { layers };
      const expected = sdk.queryRenderedFeatures(undefined, options);
      const observed = await map.queryRenderedFeatures(undefined, options);

      if (featureIds(observed) !== featureIds(expected))
        throw new Error(
          "An omitted or empty layer list changed SDK semantics."
        );
      if (layers === undefined && observed.length === 0)
        throw new Error(
          "The omitted-layer query did not find the known scene."
        );

      assertBalanced();
      results[layers === undefined ? "omitted-layers" : "empty-layers"] = "ok";
    }

    // Legacy geometry validation emits an SDK error while its filter still
    // compiles. This distinguishes emitted failures from directly thrown ones.
    const invalidFilter = ["==", "$type", "InvalidGeometry"];
    const emittedQueries = [
      {
        name: "rendered-emitted-error",
        query: () =>
          map.queryRenderedFeatures(undefined, {
            layers: ["queries-line"],
            filter: invalidFilter,
          }),
      },
      {
        name: "source-emitted-error",
        query: () =>
          map.querySourceFeatures("queries-routes", { filter: invalidFilter }),
      },
    ];

    for (const { name, query } of emittedQueries) {
      const errors: unknown[] = [];
      let pending: Promise<readonly GeoJsonFeature[]>;
      let rejection: unknown;

      expectedErrors.current = errors;
      try {
        pending = query();
      } finally {
        // Only synchronous notices from this dispatch are expected. Later or
        // unrelated map errors still reach the regular smoke failure handler.
        expectedErrors.current = undefined;
      }

      try {
        await pending;
      } catch (error) {
        rejection = error;
      }

      if (errors.length === 0 || rejection !== errors[0])
        throw new Error(`${name} did not preserve the normal callback error.`);

      assertBalanced();
      results[name] = "ok";
    }

    const empty = await map.queryRenderedFeatures(undefined, {
      layers: ["queries-line"],
      filter: ["==", ["id"], "query-probe-not-present"],
    });
    if (empty.length !== 0) throw new Error("A genuine empty query failed.");

    const subsequent = await map.queryRenderedFeatures(undefined, {
      layers: ["queries-line"],
    });
    if (subsequent.length === 0)
      throw new Error("A valid query after emitted failures found no route.");

    assertBalanced();
    results["empty-result"] = "ok";
    results["subsequent-query"] = "ok";
    results["listener-cleanup"] = "ok";

    return results;
  } finally {
    expectedErrors.current = undefined;
    sdk.removeSource("query-probe-vector");
    sdk.removeSource("query-probe-raster");
  }
};

const featureIds = (features: readonly GeoJsonFeature[]): string =>
  JSON.stringify(features.map((feature) => feature.id ?? null).sort());
