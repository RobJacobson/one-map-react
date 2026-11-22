import type { GeolocationPosition } from "one-map-react";

import type { WebSceneComponents } from "./scene-components.js";

/** Draws the supplied location fixture on the stock browser map. */
export const WebPosition = ({
  components: { Source, Layer },
  position,
}: {
  readonly components: WebSceneComponents;
  readonly position?: GeolocationPosition;
}) => {
  if (!position) return null;
  const [longitude, latitude] = position.lngLat;
  const circumference = 2 * Math.PI * 6371008.8;
  const metersPerPixel =
    (circumference * Math.cos((latitude * Math.PI) / 180)) / 512;
  const radius = (position.accuracy ?? 0) / metersPerPixel;
  return (
    <Source
      id="fixture-location"
      type="geojson"
      data={{
        type: "Feature",
        geometry: { type: "Point", coordinates: [longitude, latitude] },
        properties: {},
      }}
    >
      {radius > 0 && (
        <Layer
          id="fixture-location-accuracy"
          type="circle"
          paint={{
            "circle-color": "#2679e8",
            "circle-opacity": 0.15,
            "circle-pitch-alignment": "map",
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              0,
              radius,
              22,
              radius * 2 ** 22,
            ],
          }}
        />
      )}
      <Layer
        id="fixture-location-dot"
        type="circle"
        paint={{
          "circle-color": "#2679e8",
          "circle-radius": 6,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        }}
      />
    </Source>
  );
};
