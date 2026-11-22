import { render } from "@testing-library/react";
import { forwardRef } from "react";
import { expect, vi, test } from "vite-plus/test";

import { acquireLocation } from "../../example-map/src/scenarios/location-acquisition.js";
import type { MapRef } from "../src/contracts/camera-types.js";
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
