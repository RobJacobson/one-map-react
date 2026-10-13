import { adapter } from "one-map-react/mapbox-web";
import { useMap } from "react-map-gl/mapbox";

import { WebCameraApp } from "../../shared/web-camera-app.js";
import {
  useWebCorrectionProbe,
  WebCorrectionsApp,
} from "../../shared/web-corrections-app.js";
import { WebLifecycleApp } from "../../shared/web-lifecycle-app.js";
import {
  useWebQueriesProbe,
  WebQueriesApp,
} from "../../shared/web-queries-app.js";
import { WebSourcesApp } from "../../shared/web-sources-app.js";

const cameraSmoke = new URLSearchParams(window.location.search).get("tf04");
const sourcesSmoke = new URLSearchParams(window.location.search).get("tf05");
const queriesSmoke = new URLSearchParams(window.location.search).get("tf06");

export const App = () => {
  if (cameraSmoke === "corrections" || sourcesSmoke === "corrections") {
    return <WebCorrectionsApp adapter={adapter} probe={<CorrectionProbe />} />;
  }

  if (queriesSmoke === "queries") {
    return <WebQueriesApp adapter={adapter} probe={<QueriesProbe />} />;
  }

  if (sourcesSmoke === "sources") {
    return <WebSourcesApp adapter={adapter} />;
  }

  if (cameraSmoke === "camera") {
    return <WebCameraApp adapter={adapter} />;
  }

  return <WebLifecycleApp adapter={adapter} />;
};

const CorrectionProbe = () => {
  useWebCorrectionProbe(useMap().current?.getMap());
  return null;
};

const QueriesProbe = () => {
  useWebQueriesProbe(useMap().current?.getMap());
  return null;
};
