import { useId, useMemo } from "react";

import { validatePosition } from "../adapters/shared/location-values.js";
import type { UserLocationProps } from "../contracts/location-types.js";
import type { GeoJsonFeatureCollection } from "../contracts/source-types.js";
import { Layer } from "./layer.js";
import { Source } from "./source.js";

/** Displays supplied coordinates and meter-based accuracy without starting sensors. */
export const UserLocation = ({
  position,
  showAccuracyCircle = false,
  onPress,
}: UserLocationProps) => {
  const id = `one-map-location-${useId()}`;
  const data = useMemo(
    () => locationGeometry(position, showAccuracyCircle),
    [position, showAccuracyCircle]
  );
  if (!position) return null;
  return (
    <Source id={id} type="geojson" data={data} onClick={onPress}>
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
  position: UserLocationProps["position"],
  accuracy: boolean
): GeoJsonFeatureCollection => {
  if (!position) return { type: "FeatureCollection", features: [] };
  const { lngLat, accuracy: radius } = validatePosition(position);
  const dot = {
    type: "Feature" as const,
    properties: { kind: "position" },
    geometry: { type: "Point", coordinates: lngLat },
  };
  if (!accuracy || radius === undefined || radius === 0)
    return { type: "FeatureCollection", features: [dot] };
  const longitude = (lngLat[0] * Math.PI) / 180;
  const latitude = (lngLat[1] * Math.PI) / 180;
  const distance = Math.min(radius / 6371008.8, Math.PI);
  const ring = Array.from({ length: 65 }, (_value, index) => {
    const bearing = ((index % 64) * Math.PI) / 32;
    const nextLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(distance) +
        Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing)
    );
    const nextLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
        Math.cos(distance) - Math.sin(latitude) * Math.sin(nextLatitude)
      );
    return [(nextLongitude * 180) / Math.PI, (nextLatitude * 180) / Math.PI];
  });
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
