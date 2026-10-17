import { type Adapter, type MapRef, MapSetup } from "one-map-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { QueriesMap } from "./queries-map.js";
import { useQueriesSmoke } from "./queries-smoke.js";
import { runWebQueryRegressions } from "./web-query-regressions.js";

interface WebQueriesAppProps {
  readonly adapter: Adapter;
  readonly probe: ReactNode;
}

declare global {
  interface Window {
    /** Actual selected SDK map, used only by the TF06 acceptance example. */
    __oneMapQueryRenderer?: object;
    /** Runs negative query checks after the ordinary TF06 hook completes. */
    __oneMapQueryRegressions?: () => Promise<Readonly<Record<string, "ok">>>;
  }
}

/** Publishes the selected wrapper's renderer without adding a facade API. */
export const useWebQueriesProbe = (map: object | undefined): void => {
  useLayoutEffect(() => {
    window.__oneMapQueryRenderer = map;

    return () => {
      if (window.__oneMapQueryRenderer === map)
        delete window.__oneMapQueryRenderer;
    };
  }, [map]);
};

/**
 * Web example shell for the TF06 queries smoke.
 *
 * @remarks
 * Open `/?tf06=queries`. The page runs rendered point, bounds, and
 * viewport queries, an empty off-screen query, a source query, cluster
 * expansion, leaves, and children, then feature-state set/get/remove and
 * the style-reset clearing.
 */
export const WebQueriesApp = ({ adapter, probe }: WebQueriesAppProps) => {
  const mapRef = useRef<MapRef>(null);
  const expectedErrors = useRef<unknown[] | undefined>(undefined);
  const smoke = useQueriesSmoke({ mapRef });

  useEffect(() => {
    console.log(smoke.status);
  }, [smoke.status]);

  useEffect(() => {
    window.__oneMapQueryRegressions = async () => {
      const map = mapRef.current;
      const renderer = window.__oneMapQueryRenderer;

      if (!map || !renderer)
        throw new Error("The TF06 renderer probe is not attached.");

      return runWebQueryRegressions({ map, renderer, expectedErrors });
    };

    return () => {
      delete window.__oneMapQueryRegressions;
    };
  }, []);

  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <p id="tf06-status" style={{ margin: 0, padding: 8 }}>
          {smoke.status}
        </p>
        <QueriesMap
          ref={mapRef}
          probe={probe}
          mapStyle={smoke.mapStyle}
          sourceRevision={smoke.sourceRevision}
          style={{ width: "100%", height: "100%", flex: 1 }}
          onLoad={smoke.onLoad}
          onStyleLoad={smoke.onStyleLoad}
          onError={(event) => {
            if (expectedErrors.current)
              expectedErrors.current.push(event.error);
            else smoke.onError(event);
          }}
        />
      </div>
    </MapSetup>
  );
};
