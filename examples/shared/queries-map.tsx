import {
  Layer,
  type MapErrorEvent,
  type MapLayoutStyle,
  type MapRef,
  type MapStyle,
  Map as OneMap,
  Source,
} from "one-map-react";
import { type ReactNode, type Ref, useMemo } from "react";

import {
  clusteredPoints,
  initialViewState,
  queryRoutes,
} from "../../tests/fixtures/map-fixture.js";

interface QueriesMapProps {
  readonly mapStyle: MapStyle;
  readonly sourceRevision: number;
  readonly style?: MapLayoutStyle;
  readonly ref?: Ref<MapRef>;
  readonly onLoad?: () => void;
  readonly onStyleLoad?: () => void;
  readonly onError?: (event: MapErrorEvent) => void;
  readonly probe?: ReactNode;
}

/**
 * Shared TF06 scene: numeric-id routes under a feature-state paint
 * expression plus a clustered points source. Numeric route ids survive
 * the SDKs' tile encoding and support independent known-feature assertions.
 */
export const QueriesMap = ({
  mapStyle,
  sourceRevision,
  style,
  ref,
  onLoad,
  onStyleLoad,
  onError,
  probe,
}: QueriesMapProps) => {
  const routes = useMemo(
    () => ({
      ...queryRoutes,
      features: queryRoutes.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          __oneMapSourceRevision: sourceRevision,
        },
      })),
    }),
    [sourceRevision]
  );

  return (
    <OneMap
      ref={ref}
      mapStyle={mapStyle}
      initialViewState={initialViewState}
      style={style}
      onLoad={onLoad}
      onStyleLoad={onStyleLoad}
      onError={onError}
    >
      {probe}
      <Source
        key={sourceRevision}
        id="queries-routes"
        type="geojson"
        data={routes}
      >
        <Layer
          id="queries-line"
          type="line"
          paint={{
            "line-color": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              "#dc2626",
              "#2563eb",
            ],
            "line-width": 3,
          }}
        />
      </Source>
      <Source
        id="queries-clusters"
        type="geojson"
        data={clusteredPoints}
        cluster
        clusterRadius={60}
      >
        <Layer
          id="queries-cluster-circles"
          type="circle"
          paint={{
            "circle-color": "#16a34a",
            "circle-radius": 12,
          }}
          filter={["==", ["get", "cluster"], true]}
        />
      </Source>
    </OneMap>
  );
};
