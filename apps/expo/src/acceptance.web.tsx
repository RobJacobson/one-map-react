import { webAcceptanceSelection } from "@one-map/example-map/acceptance-selection";
import { WebAcceptanceWorkspace } from "@one-map/example-map/acceptance-web";

const selection: ReturnType<typeof webAcceptanceSelection> = __DEV__
  ? webAcceptanceSelection(window.location.search)
  : { engine: "maplibre", scenario: undefined };
/** Browser-only development selection without importing native wrappers. */
export const acceptanceRequested = Boolean(selection.scenario);

/** Metro-powered web uses the same DOM scenes and probes as Vite. */
export const Acceptance = ({
  token,
}: {
  readonly token: string;
  readonly close: () => void;
}) => {
  if (selection.engine === "mapbox" && !token)
    throw new Error(
      "Configure a public Mapbox token before running Mapbox acceptance."
    );
  return (
    <WebAcceptanceWorkspace
      engine={selection.engine}
      scenario={selection.scenario ?? "tf03"}
    />
  );
};
