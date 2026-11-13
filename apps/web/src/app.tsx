import {
  ExampleMap,
  publicMapboxToken,
  useExampleMap,
} from "@one-map/example-map";
import {
  webAcceptanceSelection,
  acceptanceScenarios,
} from "@one-map/example-map/acceptance-selection";
import { WebAcceptanceWorkspace } from "@one-map/example-map/acceptance-web";
import { adapters, configureMapbox } from "@one-map/example-map/web";

const token = publicMapboxToken(
  import.meta.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
);
configureMapbox(token);

/** Conventional DOM shell around the shared map and behavior. */
export const App = () => {
  const selection = import.meta.env.DEV
    ? webAcceptanceSelection(window.location.search)
    : undefined;
  if (selection?.scenario) {
    if (selection.engine === "mapbox" && !token)
      throw new Error(
        "Configure a public Mapbox token before Mapbox acceptance."
      );
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
  const model = useExampleMap(adapters, Boolean(token));
  const testMode =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("test") === "1";
  const disabled = model.status === "loading" || model.status === "switching";
  return (
    <main>
      <ExampleMap model={model} style={{ width: "100%", height: "100%" }} />
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
                  const url = new URL(window.location.href);
                  url.searchParams.set("scenario", event.target.value);
                  url.searchParams.set("engine", model.attachment.engine);
                  window.location.assign(url);
                }}
              >
                <option value="basemap">Basemap and engine switching</option>
                {acceptanceScenarios
                  .filter(
                    (value) =>
                      value !== "tf08-storage" &&
                      value !== "tf06-lifetimes" &&
                      value !== "tf09-model" &&
                      (value !== "global-state" ||
                        model.attachment.engine === "maplibre")
                  )
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
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
