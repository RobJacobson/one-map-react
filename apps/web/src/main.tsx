import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { createRoot } from "react-dom/client";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { App } from "./app.js";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root.");
setWorkerUrl(workerUrl);
createRoot(root).render(<App />);
