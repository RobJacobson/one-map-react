import type { FeatureCollection, LineString, Point } from "geojson";

import type { StyleSpecification } from "./maps.js";

/** The local base style has no remote assets. */
export const vesselStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "water",
      type: "background",
      paint: { "background-color": "#e1eef6" },
    },
  ],
};

/** The vessel's location in longitude, latitude order. */
export const vesselPosition: [number, number] = [-122.448, 47.611];

/** Integer IDs survive GeoJSON tiling and identify each rendered hit. */
export const vesselData: FeatureCollection<LineString | Point> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: 1,
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [[-122.49, 47.604], [-122.468, 47.615], vesselPosition],
      },
    },
    {
      type: "Feature",
      id: 2,
      properties: {},
      geometry: { type: "Point", coordinates: vesselPosition },
    },
  ],
};
