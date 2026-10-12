import { adapter } from "one-map-react/mapbox-web";

import { WebCameraApp } from "../../shared/web-camera-app.js";
import { WebLifecycleApp } from "../../shared/web-lifecycle-app.js";
import { WebSourcesApp } from "../../shared/web-sources-app.js";

const cameraSmoke = new URLSearchParams(window.location.search).get("tf04");
const sourcesSmoke = new URLSearchParams(window.location.search).get("tf05");

export const App = () => {
  if (sourcesSmoke === "sources") {
    return <WebSourcesApp adapter={adapter} />;
  }

  if (cameraSmoke === "camera") {
    return <WebCameraApp adapter={adapter} />;
  }

  return <WebLifecycleApp adapter={adapter} />;
};
