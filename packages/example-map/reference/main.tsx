import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  type VesselControlsProps,
  VesselMap,
  type VesselMarkerProps,
} from "./VesselMap.js";

const MarkerContent = ({ highlighted, toggleHighlight }: VesselMarkerProps) => (
  <button type="button" aria-pressed={highlighted} onClick={toggleHighlight}>
    Highlight vessel
  </button>
);

const Controls = ({ flyToVessel, hitFeatureId, zoom }: VesselControlsProps) => (
  <p>
    <button type="button" onClick={flyToVessel}>
      Fly to vessel
    </button>{" "}
    <span>Zoom {zoom.toFixed(2)}</span>{" "}
    <output>
      {hitFeatureId === undefined
        ? "No feature selected"
        : `Selected ${hitFeatureId}`}
    </output>
  </p>
);

const root = document.getElementById("root");
if (!root) throw new Error("Missing vessel map host.");

setWorkerUrl(workerUrl);
createRoot(root).render(
  <>
    <h1>Vessel map</h1>
    <div
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr) auto",
        height: "min(65vh, 32rem)",
      }}
    >
      <VesselMap MarkerContent={MarkerContent} Controls={Controls} />
    </div>
  </>
);
