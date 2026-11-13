import type { AcceptanceSelection } from "./acceptance-selection.js";
import { App as MapboxAcceptance } from "./scenarios/mapbox-web.js";
import { App as MaplibreAcceptance } from "./scenarios/maplibre-web.js";

/**
 * Renders the existing DOM scenario with its selected renderer probes.
 * @param props - The explicit engine and scenario selection.
 * @returns The selected development scenario and its controls.
 */
export const WebAcceptance = ({ engine, scenario }: AcceptanceSelection) => {
  if (scenario === "tf07-retained")
    throw new Error("tf07-retained requires a native acceptance host.");
  return engine === "mapbox" ? (
    <MapboxAcceptance key={`${engine}:${scenario}`} scenario={scenario} />
  ) : (
    <MaplibreAcceptance key={`${engine}:${scenario}`} scenario={scenario} />
  );
};
