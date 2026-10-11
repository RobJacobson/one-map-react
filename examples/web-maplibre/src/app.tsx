import { adapter } from "one-map-react/maplibre-web";

import { WebCameraApp } from "../../shared/web-camera-app.js";
import { WebLifecycleApp } from "../../shared/web-lifecycle-app.js";

const cameraSmoke = new URLSearchParams(window.location.search).get("tf04");

export const App = () =>
  cameraSmoke === "camera" ? (
    <WebCameraApp adapter={adapter} />
  ) : (
    <WebLifecycleApp adapter={adapter} />
  );
