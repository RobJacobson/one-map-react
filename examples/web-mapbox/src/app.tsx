import { adapter } from "one-map-react/mapbox-web";

import { WebLifecycleApp } from "../../shared/web-lifecycle-app.js";

export const App = () => <WebLifecycleApp adapter={adapter} />;
