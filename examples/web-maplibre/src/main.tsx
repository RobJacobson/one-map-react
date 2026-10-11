import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";

import { App } from "./app.js";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(<App />);
