import { type ReactNode, useMemo } from "react";
import type { LayerProps } from "react-map-gl/maplibre";

import { clusteredPoints, queryRoutes } from "./map-fixture.js";
interface QuerySourceProps {
  id: string;
  type: "geojson";
  data: GeoJSON.FeatureCollection;
  cluster?: boolean;
  clusterRadius?: number;
  children: ReactNode;
}

const routeLayer = {
  id: "queries-line",
  type: "line",
  paint: {
    "line-color": [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#dc2626",
      "#2563eb",
    ],
    "line-width": 3,
  },
} satisfies LayerProps;

const clusterLayer = {
  id: "queries-cluster-circles",
  type: "circle",
  paint: { "circle-color": "#16a34a", "circle-radius": 12 },
  filter: ["==", ["get", "cluster"], true],
} satisfies LayerProps;

/** Draws the same revision-tagged routes and clustered points on each renderer. */
export const QuerySources = ({
  Source,
  Layer,
  sourceRevision,
}: {
  Source: (props: QuerySourceProps) => ReactNode;
  Layer: (props: typeof routeLayer | typeof clusterLayer) => ReactNode;
  sourceRevision: number;
}) => {
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
    <>
      <Source
        key={sourceRevision}
        id="queries-routes"
        type="geojson"
        data={routes}
      >
        <Layer {...routeLayer} />
      </Source>
      <Source
        id="queries-clusters"
        type="geojson"
        data={clusteredPoints}
        cluster
        clusterRadius={60}
      >
        <Layer {...clusterLayer} />
      </Source>
    </>
  );
};
