import { lazy, Suspense, useEffect, useState } from "react";
import { Text } from "react-native";

import type { AcceptanceSelection } from "./acceptance-selection.js";
import { observeAcceptanceCamera } from "./scenarios/tf10-camera-observer.js";

const MapboxAcceptance = lazy(() => import("./scenarios/mapbox-native.js"));
const MaplibreAcceptance = lazy(() => import("./scenarios/maplibre-native.js"));

/**
 * Mounts one native scenario at a time inside the shared dual-engine application.
 * @param props - The explicit engine and scenario selection.
 * @returns The selected development scenario and its controls.
 */
export const NativeAcceptance = (props: AcceptanceSelection) => (
  <NativeScenario key={`${props.engine}:${props.scenario}`} {...props} />
);

const NativeScenario = ({
  engine,
  scenario,
}: Parameters<typeof NativeAcceptance>[0]) => {
  const [prepared, setPrepared] = useState(false);
  const [failure, setFailure] = useState<Error>();
  useEffect(() => {
    let active = true;
    let stop = () => {};
    const prepare = async () => {
      try {
        // Match the adapter's import condition to avoid duplicate SDK view registration.
        const cameras =
          scenario === "tf09"
            ? {
                [engine]: (engine === "mapbox"
                  ? await import("@rnmapbox/maps")
                  : await import("@maplibre/maplibre-react-native")
                ).Camera,
              }
            : {};
        if (!active) return;
        stop = observeAcceptanceCamera(scenario, engine, cameras);
        setPrepared(true);
      } catch (error) {
        if (active)
          setFailure(error instanceof Error ? error : new Error(String(error)));
      }
    };
    void prepare();
    return () => {
      active = false;
      stop();
    };
  }, [engine, scenario]);
  if (failure) throw failure;
  if (!prepared) return null;
  if (scenario === "global-state" || scenario === "corrections")
    throw new Error(`${scenario} is a web acceptance scenario.`);
  if (scenario === "tf09-model" && engine !== "mapbox")
    throw new Error("The selected model fixture requires native Mapbox.");
  return (
    <Suspense fallback={<Text>Loading acceptance scenario…</Text>}>
      {engine === "mapbox" ? (
        <MapboxAcceptance scenario={scenario} />
      ) : (
        <MaplibreAcceptance scenario={scenario} />
      )}
    </Suspense>
  );
};
