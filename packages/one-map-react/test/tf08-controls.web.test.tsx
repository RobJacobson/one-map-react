import { render } from "@testing-library/react";
import { forwardRef, type ReactNode } from "react";
import { expect, vi, test } from "vite-plus/test";

import { acquireLocation } from "../../example-map/src/scenarios/location-acquisition.js";
import type { Adapter } from "../src/contracts/adapter.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { UserLocation } from "../src/native-extensions.js";
const fixture = () => {
  const source = vi.fn(({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ));
  const adapter = {
    backend: "mapbox-native",
    Map: forwardRef(({ children }: { children?: ReactNode }, _ref) => (
      <>{children}</>
    )),
    Source: source,
    Layer: () => null,
  } as unknown as Adapter;
  return { adapter, source };
};
test("setup and supplied location display need no acquisition manager", async () => {
  const selected = fixture();
  const controller = new AbortController();
  const release = vi.fn();
  const request = acquireLocation(() => release, controller.signal);
  const mounted = render(
    <MapSetup adapter={selected.adapter}>
      <OneMap
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
      </OneMap>
    </MapSetup>
  );
  const source = selected.source.mock.calls[0][0] as unknown as {
    data: { features: unknown[] };
  };
  expect(source.data.features).toHaveLength(2);
  expect(source).not.toHaveProperty("onClick");
  mounted.unmount();
  expect(controller.signal.aborted).toBe(false);
  expect(release).not.toHaveBeenCalled();
  const rejected = expect(request).rejects.toThrow("cancelled");
  controller.abort();
  await rejected;
  expect(release).toHaveBeenCalledTimes(1);
});
