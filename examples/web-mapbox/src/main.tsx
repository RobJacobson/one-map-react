import mapboxgl from "mapbox-gl";
import { createRoot } from "react-dom/client";
import "mapbox-gl/dist/mapbox-gl.css";

import { App } from "./app.js";

// The declaration default export is typed as the module namespace, which does
// not list accessToken. The runtime default export does.
const mapbox = mapboxgl as { accessToken?: string | null };

// Vite injects this from the shell or a .env file. It is not stored in source.
const mapboxAccessToken = import.meta.env.MAPBOX_ACCESS_TOKEN;

if (!mapboxAccessToken) {
  throw new Error("Set MAPBOX_ACCESS_TOKEN in the shell or a .env file.");
}

mapbox.accessToken = mapboxAccessToken;

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(<App />);
