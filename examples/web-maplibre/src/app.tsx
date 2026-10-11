import { type MapRef, MapSetup } from "one-map-react";
import { adapter } from "one-map-react/maplibre-web";
import { useRef, useState } from "react";

import { RouteMap } from "../../shared/route-map.js";

export const App = () => {
  const mapRef = useRef<MapRef>(null);
  const [generation, setGeneration] = useState(0);

  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          <button
            type="button"
            onClick={() => {
              void mapRef.current?.flyTo({
                center: [-122.32, 47.64],
                duration: 1000,
              });
            }}
          >
            Fly north
          </button>
          <button
            type="button"
            onClick={() => {
              setGeneration((current) => current + 1);
            }}
          >
            Remount
          </button>
        </div>
        <RouteMap
          key={generation}
          ref={mapRef}
          style={{ width: "100%", height: "100%", flex: 1 }}
          onMove={(event) => {
            console.log(event.origin, event.viewState);
          }}
        />
      </div>
    </MapSetup>
  );
};
