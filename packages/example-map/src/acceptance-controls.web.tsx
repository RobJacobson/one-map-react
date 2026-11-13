import {
  acceptanceScenarios,
  acceptanceScenario,
  webAcceptanceUrl,
  type AcceptanceSelection,
} from "./acceptance-selection.js";
import { WebAcceptance } from "./acceptance.web.js";

/**
 * Shared DOM scenario controls for Vite and Metro-powered Expo web.
 * @param props - The explicit engine and scenario selection.
 * @returns The selected development scenario and its controls.
 */
export const WebAcceptanceWorkspace = ({
  engine,
  scenario,
}: AcceptanceSelection) => (
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
          {acceptanceScenarios
            .filter(
              (value) =>
                value !== "tf07-retained" &&
                value !== "tf09-model" &&
                value !== "tf08-storage" &&
                value !== "tf06-lifetimes" &&
                (value !== "global-state" || engine === "maplibre")
            )
            .map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
        </select>
      </label>
    </details>
  </>
);
