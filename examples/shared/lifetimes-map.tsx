import {
  Layer,
  type MapErrorEvent,
  type MapLayoutStyle,
  type MapRef,
  type MapStyle,
  Map as OneMap,
  Source,
} from "one-map-react";
import { type Ref, useMemo } from "react";

import {
  initialViewState,
  queryRoutes,
} from "../../tests/fixtures/map-fixture.js";
import { tf06Base } from "./tf06-base.js";

interface LifetimesMapProps {
  readonly family: "geojson" | "vector";
  readonly mapStyle: MapStyle;
  readonly sourceRevision: number;
  readonly style?: MapLayoutStyle;
  readonly ref?: Ref<MapRef>;
  readonly onLoad?: () => void;
  readonly onStyleLoad?: () => void;
  readonly onError?: (event: MapErrorEvent) => void;
}

/** Native TF06 lifetime scene with a keyed, same-id source in two families. */
export const LifetimesMap = ({
  family,
  mapStyle,
  sourceRevision,
  style,
  ref,
  onLoad,
  onStyleLoad,
  onError,
}: LifetimesMapProps) => {
  const routes = useMemo(
    () => ({
      ...queryRoutes,
      features: queryRoutes.features.slice(0, 2).map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          __oneMapSourceRevision: sourceRevision,
        },
      })),
    }),
    [sourceRevision]
  );
  const sourceKey = `${family}-${sourceRevision}`;

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
      {family === "vector" ? (
        <Source
          key={sourceKey}
          id="lifetime-routes"
          type="vector"
          tiles={[`${tf06Base}/vt/${sourceRevision}/{z}/{x}/{y}.pbf`]}
          minzoom={11}
          maxzoom={11}
        >
          <Layer
            id="lifetime-line"
            type="line"
            source-layer="routes"
            paint={linePaint}
          />
          <Layer
            id="lifetime-alternate"
            type="line"
            source-layer="alternates"
            paint={linePaint}
          />
        </Source>
      ) : (
        <Source
          key={sourceKey}
          id="lifetime-routes"
          type="geojson"
          data={routes}
        >
          <Layer id="lifetime-line" type="line" paint={linePaint} />
        </Source>
      )}
    </OneMap>
  );
};

const linePaint = {
  "line-color": [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    "#dc2626",
    "#2563eb",
  ],
  "line-width": 4,
} as const;
