import type { ReactElement } from "react";

import {
  acceptanceScenario,
  webAcceptanceScenarios,
  webAcceptanceUrl,
  type AcceptanceScenario,
  type AcceptanceSelection,
} from "./acceptance-selection.js";
import { WebAcceptance } from "./acceptance.web.js";

/**
 * Shared DOM scenario controls for Vite and Metro-powered Expo web.
 *
 * @param props - The explicit engine and scenario selection.
 * @returns The selected development scenario and its controls.
 */
export const WebAcceptanceWorkspace = ({
  engine,
  scenario,
}: AcceptanceSelection): ReactElement => (
  <>
    <WebAcceptance engine={engine} scenario={scenario} />
    <details
      style={{
        position: "fixed",
        bottom: 28,
        left: 8,
        zIndex: 20,
        background: "white",
      }}
    >
      <summary>Acceptance scenarios</summary>
      <button
        type="button"
        onClick={() =>
          window.location.assign(
            webAcceptanceUrl(window.location.href, engine, undefined)
          )
        }
      >
        Basemap
      </button>
      <label>
        Engine{" "}
        <select
          aria-label="Acceptance engine"
          value={engine}
          onChange={(event) =>
            window.location.assign(
              webAcceptanceUrl(
                window.location.href,
                event.target.value === "mapbox" ? "mapbox" : "maplibre",
                scenario
              )
            )
          }
        >
          <option value="maplibre">MapLibre</option>
          <option value="mapbox">Mapbox</option>
        </select>
      </label>
      <label>
        Scenario{" "}
        <select
          aria-label="Acceptance scenario"
          value={scenario}
          onChange={(event) =>
            window.location.assign(
              webAcceptanceUrl(
                window.location.href,
                engine,
                acceptanceScenario(event.target.value)
              )
            )
          }
        >
          {webAcceptanceScenarios(engine).map(renderScenarioOption)}
        </select>
      </label>
    </details>
  </>
);

const renderScenarioOption = (scenario: AcceptanceScenario) => (
  <option key={scenario} value={scenario}>
    {scenario}
  </option>
);
