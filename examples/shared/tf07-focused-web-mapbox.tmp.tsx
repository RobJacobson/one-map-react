import {
  Control,
  FullscreenControl,
  GeolocateControl,
  MapSetup,
  NavigationControl,
  Map as OneMap,
} from "one-map-react";
import { adapter } from "one-map-react/mapbox-web";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const Theme = createContext("initial");
const counts = { load: 0, error: 0, location: 0, calls: 0, clicks: 0 };
let read = async () => ({});
let configure = (_action) => {};
let release = () => {};
const Child = () => {
  const theme = useContext(Theme);
  return (
    <button type="button" data-focused-theme onClick={() => counts.clicks++}>
      {theme}
    </button>
  );
};
const App = () => {
  const ref = useRef(null);
  const [mode, setMode] = useState("reject");
  const [mounted, setMounted] = useState(true);
  const [theme, setTheme] = useState("initial");
  useEffect(() => {
    configure = (action) => {
      if (action === "delay") setMode("delay");
      if (action === "remove") setMounted(false);
      if (action === "restore") setMounted(true);
      if (action === "theme") setTheme("updated");
      if (action === "resolve") release();
    };
    read = async () => ({
      ...counts,
      zoom: await ref.current?.getZoom(),
      center: await ref.current?.getCenter(),
    });
  }, []);
  const position = async () => {
    counts.calls++;
    if (mode === "reject") throw new Error("expected test rejection");
    return await new Promise((resolve) => {
      release = () => resolve({ lngLat: [-122.33, 47.62] });
    });
  };
  return (
    <>
      <span
        data-focused-mode
        style={{ position: "fixed", top: 0, left: 100, zIndex: 10000 }}
      >
        {mode}
      </span>
      <Theme.Provider value={theme}>
        <MapSetup adapter={adapter}>
          <OneMap
            ref={ref}
            mapStyle={{
              version: 8,
              sources: {},
              layers: [
                {
                  id: "background",
                  type: "background",
                  paint: { "background-color": "#e2e8f0" },
                },
              ],
            }}
            initialViewState={{ longitude: -122.34, latitude: 47.61, zoom: 11 }}
            style={{ width: "100%", height: "100%" }}
            onLoad={() => counts.load++}
          >
            <NavigationControl />
            <FullscreenControl />
            <Control position="bottom-right">
              <Child />
            </Control>
            {mounted && (
              <GeolocateControl
                getCurrentPosition={position}
                onError={() => counts.error++}
                onGeolocate={() => counts.location++}
              />
            )}
          </OneMap>
        </MapSetup>
      </Theme.Provider>
    </>
  );
};
const container = document.createElement("div");
container.id = "tf07-focused";
Object.assign(container.style, {
  position: "fixed",
  inset: "0",
  zIndex: "9999",
  background: "white",
});
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
window.__tf07Focused = {
  read: () => read(),
  configure: (action) => configure(action),
  dispose: () => {
    root.unmount();
    container.remove();
  },
};
