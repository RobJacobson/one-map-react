import { type Adapter, MapSetup } from "one-map-react";
import { useEffect } from "react";

import { SourcesMap } from "./sources-map.js";
import { useSourcesSmoke } from "./sources-smoke.js";

interface WebSourcesAppProps {
  readonly adapter: Adapter;
}

/** Fixture server started by the TF05 smoke script. */
const fixtureBase = "http://127.0.0.1:8798";

/**
 * Web example shell for the TF05 sources smoke.
 *
 * Open `/?tf05=sources`. The page mounts every source family, removes a
 * paint key, updates GeoJSON data, replaces the style, then removes the
 * vector and image sources.
 */
export const WebSourcesApp = ({ adapter }: WebSourcesAppProps) => {
  const smoke = useSourcesSmoke({});

  useEffect(() => {
    console.log(smoke.status);
  }, [smoke.status]);

  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <p id="tf05-status" style={{ margin: 0, padding: 8 }}>
          {smoke.status}
        </p>
        <SourcesMap
          base={fixtureBase}
          mapStyle={smoke.mapStyle}
          routeData={smoke.routeData}
          lineColor={smoke.lineColor}
          showTransient={smoke.showTransient}
          style={{ width: "100%", height: "100%", flex: 1 }}
          onLoad={smoke.onLoad}
          onStyleLoad={smoke.onStyleLoad}
          onError={smoke.onError}
        />
      </div>
    </MapSetup>
  );
};
