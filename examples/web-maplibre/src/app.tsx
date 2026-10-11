import { adapter } from "one-map-react/maplibre-web";

import { WebLifecycleApp } from "../../shared/web-lifecycle-app.js";

export const App = () => <WebLifecycleApp adapter={adapter} />;
