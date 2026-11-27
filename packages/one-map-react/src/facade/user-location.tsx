import { type JSX, useId } from "react";

import type { UserLocationProps } from "../contracts/location-types.js";
import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
} from "../contracts/source-types.js";
import type { GeolocationPosition } from "../contracts/ui-types.js";
import { validatePosition } from "./location-values.js";
import { useMapSession } from "./map-context.js";

/**
 * Displays supplied coordinates and meter-based accuracy without starting sensors.
 *
 * @param props - Position and accuracy display options.
 * @returns The location source and layers, or null when no position is supplied.
 * @throws When rendered outside Map or supplied an invalid position.
 */
export const UserLocation = ({
  position,
  showAccuracyCircle = false,
}: UserLocationProps): JSX.Element | null => {
  const session = useMapSession("UserLocation");
  const id = `one-map-location-${useId()}`;
  if (!position) return null;

  const data = locationGeometry(position, showAccuracyCircle);
  const { Layer, Source } = session.components;
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-accuracy`}
        type="fill"
        filter={["==", ["get", "kind"], "accuracy"]}
        paint={{ "fill-color": "#2679e8", "fill-opacity": 0.15 }}
      />
      <Layer
        id={`${id}-dot`}
        type="circle"
        filter={["==", ["get", "kind"], "position"]}
        paint={{
          "circle-radius": 6,
          "circle-color": "#2679e8",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        }}
      />
    </Source>
  );
};

const locationGeometry = (
  position: GeolocationPosition,
  accuracy: boolean
): GeoJsonFeatureCollection => {
  const { lngLat, accuracy: radius } = validatePosition(position);
  const dot: GeoJsonFeature = {
    type: "Feature",
    properties: { kind: "position" },
    geometry: { type: "Point", coordinates: lngLat },
  };
  if (!accuracy || radius === undefined || radius === 0)
    return { type: "FeatureCollection", features: [dot] };
  const longitude = (lngLat[0] * Math.PI) / 180;
  const latitude = (lngLat[1] * Math.PI) / 180;
  const distance = Math.min(radius / 6371008.8, Math.PI);
  const ringCoordinate = (_value: unknown, index: number) => {
    const bearing = ((index % 64) * Math.PI) / 32;
    const sinNextLatitude =
      Math.sin(latitude) * Math.cos(distance) +
      Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing);
    // Floating-point rounding can put the sine outside the asin domain.
    const nextLatitude = Math.asin(Math.max(-1, Math.min(1, sinNextLatitude)));
    const nextLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
        Math.cos(distance) - Math.sin(latitude) * Math.sin(nextLatitude)
      );
    return [(nextLongitude * 180) / Math.PI, (nextLatitude * 180) / Math.PI];
  };
  const ring = Array.from({ length: 65 }, ringCoordinate);
  return {
    type: "FeatureCollection",
    features: [
      dot,
      {
        type: "Feature",
        properties: { kind: "accuracy" },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  };
};
