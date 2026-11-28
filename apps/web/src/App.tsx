import {
  ExampleMap,
  publicMapboxToken,
  useExampleMap,
} from "@one-map/example-map";
import {
  acceptanceScenario,
  webAcceptanceScenarios,
  webAcceptanceSelection,
  webAcceptanceUrl,
  type AcceptanceScenario,
} from "@one-map/example-map/acceptance-selection";
import { WebAcceptanceWorkspace } from "@one-map/example-map/acceptance-web";
import { maps, configureMapbox } from "@one-map/example-map/web";
import type { ReactElement } from "react";

const token = publicMapboxToken(
  import.meta.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
);
configureMapbox(token);

/**
 * Selects the Vite development scenario or the standard basemap.
 *
 * @returns The selected map screen and its controls.
 * @throws Error when the development selection is invalid or needs a Mapbox token.
 */
export const App = (): ReactElement => {
  const selection = import.meta.env.DEV
    ? webAcceptanceSelection(window.location.search)
    : undefined;
  if (selection?.scenario) {
    if (selection.engine === "mapbox" && !token) {
      throw new Error(
        "Configure a public Mapbox token before Mapbox acceptance."
      );
    }
    return (
      <WebAcceptanceWorkspace
        engine={selection.engine}
        scenario={selection.scenario}
      />
    );
  }
  return <BasemapApp />;
};

const BasemapApp = () => {
  const model = useExampleMap(Boolean(token));
  const testMode =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("test") === "1";
  const disabled = model.status === "loading" || model.status === "switching";
  return (
    <main>
      <ExampleMap
        model={model}
        maps={maps}
        style={{ width: "100%", height: "100%" }}
      />
      <section className="map-controls" aria-label="Map controls">
        <fieldset className="engine-toggle" aria-label="Map engine">
          <button
            type="button"
            aria-pressed={model.attachment.engine === "maplibre"}
            disabled={disabled}
            onClick={() => {
              void model.selectEngine("maplibre");
            }}
          >
            MapLibre
          </button>
          <button
            type="button"
            aria-pressed={model.attachment.engine === "mapbox"}
            disabled={disabled || !token}
            onClick={() => {
              void model.selectEngine("mapbox");
            }}
          >
            Mapbox
          </button>
        </fieldset>
        {!token && (
          <p>Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to enable Mapbox.</p>
        )}
        {(testMode || model.status !== "ready") && (
          <output data-testid="map-status">{model.status}</output>
        )}
        {model.error && (
          <div role="alert">
            <p>{model.error}</p>
            <button
              type="button"
              onClick={() => {
                void model.selectEngine(model.attachment.engine);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {testMode && (
          <div>
            <label>
              Scenario{" "}
              <select
                aria-label="Scenario"
                defaultValue="basemap"
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  window.location.assign(
                    webAcceptanceUrl(
                      window.location.href,
                      model.attachment.engine,
                      value === "basemap"
                        ? undefined
                        : acceptanceScenario(value)
                    )
                  );
                }}
              >
                <option value="basemap">Basemap and engine switching</option>
                {webAcceptanceScenarios(model.attachment.engine).map(
                  renderScenarioOption
                )}
              </select>
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                void model.inspectCamera();
              }}
            >
              Read camera
            </button>
            <output data-testid="camera-readback">
              {JSON.stringify(model.camera)}
            </output>
            <output data-testid="map-generation">
              {model.attachment.generation}
            </output>
          </div>
        )}
      </section>
    </main>
  );
};

const renderScenarioOption = (scenario: AcceptanceScenario) => (
  <option key={scenario} value={scenario}>
    {scenario}
  </option>
);
