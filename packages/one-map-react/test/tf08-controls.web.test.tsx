import { render } from "@testing-library/react";
import { forwardRef } from "react";
import { expect, vi, test } from "vite-plus/test";

import { acquireLocation } from "../../example-map/src/scenarios/location-acquisition.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { UserLocationProps } from "../src/contracts/location-types.js";
import type { NativeMapInputs } from "../src/contracts/native-types.js";
import type { SourceProps } from "../src/contracts/source-types.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";
import { UserLocation } from "../src/native-extensions.js";
const fixture = () => {
  const source = vi.fn((props: SourceProps) => <>{props.children}</>);
  const renderer = forwardRef<MapRef, NativeMapInputs>(({ children }, _ref) => (
    <>{children}</>
  ));
  const { Map: NativeMap } = createNativeMapBinding(renderer, {
    backend: "mapbox-native",
    Source: source,
    Layer: () => null,
    Images: () => null,
    Marker: () => null,
  });
  return { NativeMap, source };
};
test("supplied location display needs no acquisition manager", async () => {
  const { NativeMap, source } = fixture();
  const controller = new AbortController();
  const release = vi.fn();
  const request = acquireLocation(() => release, controller.signal);
  const mounted = render(
    <NativeMap
      initialViewState={{
        longitude: 0,
        latitude: 0,
        zoom: 1,
        bearing: 0,
        pitch: 0,
      }}
      mapStyle={{ version: 8, sources: {}, layers: [] }}
    >
      <UserLocation
        position={{ lngLat: [7, 8], accuracy: 30 }}
        showAccuracyCircle
      />
    </NativeMap>
  );
  const props = source.mock.calls[0][0];
  expect(props).toMatchObject({
    type: "geojson",
    data: { features: [expect.any(Object), expect.any(Object)] },
  });
  expect(props).not.toHaveProperty("onClick");
  mounted.unmount();
  expect(controller.signal.aborted).toBe(false);
  expect(release).not.toHaveBeenCalled();
  const rejected = expect(request).rejects.toThrow("cancelled");
  controller.abort();
  await rejected;
  expect(release).toHaveBeenCalledTimes(1);
});

test.each([
  undefined,
  { lngLat: [7, 8] },
] satisfies UserLocationProps["position"][])(
  "supplied location requires an enclosing map with position %j",
  (position) => {
    expect(() => render(<UserLocation position={position} />)).toThrow(
      "UserLocation must render inside Map."
    );
  }
);

test.each([
  { radius: undefined, showAccuracyCircle: true },
  { radius: 0, showAccuracyCircle: true },
  { radius: 30, showAccuracyCircle: false },
])(
  "draws only the position without an accuracy ring (%j)",
  ({ radius, showAccuracyCircle }) => {
    const { NativeMap, source } = fixture();
    render(
      <NativeMap mapStyle={{ version: 8, sources: {}, layers: [] }}>
        <UserLocation
          position={{ lngLat: [7, 8], accuracy: radius }}
          showAccuracyCircle={showAccuracyCircle}
        />
      </NativeMap>
    );
    expect(source.mock.lastCall?.[0]).toMatchObject({
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            properties: { kind: "position" },
            geometry: { type: "Point", coordinates: [7, 8] },
          },
        ],
      },
    });
  }
);

test.each([
  { latitude: 8, radius: 30 },
  // The geodesic calculation can round past either end of the asin domain.
  { latitude: -88, radius: 19792724.281568855 },
  { latitude: 88, radius: 19792724.281568855 },
  { latitude: -90, radius: 30 },
  { latitude: 90, radius: 30 },
])(
  "draws a finite, closed accuracy ring at latitude $latitude",
  ({ latitude, radius }) => {
    const { NativeMap, source } = fixture();
    const scene = (position?: UserLocationProps["position"]) => (
      <NativeMap mapStyle={{ version: 8, sources: {}, layers: [] }}>
        <UserLocation position={position} showAccuracyCircle />
      </NativeMap>
    );
    const mounted = render(scene());
    expect(source).not.toHaveBeenCalled();

    const accuracy = vi.fn(() => NaN).mockReturnValueOnce(radius);
    mounted.rerender(
      scene({
        lngLat: [7, latitude],
        get accuracy() {
          return accuracy();
        },
      })
    );

    const props = source.mock.lastCall?.[0];
    const data = props?.type === "geojson" ? props.data : undefined;
    if (!data || typeof data === "string" || !("features" in data)) {
      throw new Error("Expected a location feature collection.");
    }
    const polygon = data.features[1]?.geometry;
    expect(polygon?.type).toBe("Polygon");
    const coordinates = polygon?.coordinates;
    const ring: unknown = Array.isArray(coordinates)
      ? coordinates[0]
      : undefined;
    if (!Array.isArray(ring)) throw new Error("Expected an accuracy ring.");

    const isFinitePair = (point: unknown) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every(Number.isFinite);
    expect(ring).toHaveLength(65);
    expect(ring.every(isFinitePair)).toBe(true);
    expect(ring.at(-1)).toStrictEqual(ring[0]);
    expect(accuracy).toHaveBeenCalledTimes(1);
  }
);
