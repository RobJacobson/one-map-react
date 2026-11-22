import {
  useRef,
  type ComponentType,
  type ComponentProps,
  type Ref,
  type ReactNode,
} from "react";

import { initialViewState } from "./map-fixture.js";
import { useQueriesSmoke } from "./queries-smoke.js";
import { QuerySources } from "./query-sources.js";
import type { SceneStyle } from "./scene-components.js";

type BrowserMap =
  | import("react-map-gl/mapbox").MapRef
  | import("react-map-gl/maplibre").MapRef;
type QueryMapProps = {
  ref: Ref<BrowserMap>;
  mapStyle: SceneStyle;
  style: { width: string; height: string; flex: number };
  initialViewState: typeof initialViewState;
  onLoad: () => void;
  onIdle: () => void;
  onError: (event: { error: unknown }) => void;
  children: ReactNode;
};

/** Exercises stock renderer query, cluster, and feature-state operations. */
export const WebQueriesApp = ({
  Map: QueryMap,
  Source,
  Layer,
}: Pick<ComponentProps<typeof QuerySources>, "Source" | "Layer"> & {
  Map: ComponentType<QueryMapProps>;
}) => {
  const mapRef = useRef<BrowserMap | null>(null);
  const smoke = useQueriesSmoke({ mapRef });
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <p id="tf06-status" style={{ margin: 0, padding: 8 }}>
        {smoke.status}
      </p>
      <QueryMap
        ref={mapRef}
        mapStyle={smoke.mapStyle}
        initialViewState={initialViewState}
        onLoad={smoke.onLoad}
        onIdle={() => {
          if (
            smoke.phase === "reset" &&
            mapRef.current?.isStyleLoaded() &&
            mapRef.current.getLayer("replacement-background")
          )
            smoke.onStyleLoad();
        }}
        onError={smoke.onError}
        style={{ width: "100%", height: "100%", flex: 1 }}
      >
        <QuerySources
          Source={Source}
          Layer={Layer}
          sourceRevision={smoke.sourceRevision}
        />
      </QueryMap>
    </div>
  );
};
