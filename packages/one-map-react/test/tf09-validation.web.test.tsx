import { render } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import { validateTerrainCoordinate } from "../src/adapters/shared/terrain-values.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type { LngLat } from "../src/contracts/camera-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";

const adapter = {
  backend: "maplibre-native",
  services: {
    location: {
      requestPermission: vi.fn(),
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
    },
  },
  Map: vi.fn(() => null),
} as unknown as Adapter;
const camera = { longitude: 0, latitude: 0, zoom: 0, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };

test.each([
  { projection: "albers" },
  { projection: null },
  { terrain: { source: 42 } },
  { terrain: { source: " " } },
  { terrain: { source: "dem", exaggeration: -1 } },
  { terrain: { source: "dem", exaggeration: Infinity } },
])("rejects malformed rendering input before adapter dispatch: %j", (props) => {
  vi.mocked(adapter.Map).mockClear();
  expect(() =>
    render(
      <MapSetup adapter={adapter}>
        <OneMap
          {...(props as unknown as Partial<MapProps>)}
          mapStyle={style}
          initialViewState={camera}
        />
      </MapSetup>
    )
  ).toThrow(RangeError);
  expect(adapter.Map).not.toHaveBeenCalled();
});

// eslint-disable-next-line unicorn/no-new-array -- Sparse coordinates must regress Array.every skipping missing elements.
test.each([null, undefined, {}, [0], new Array(2), [0, "1"], [0, 91]])(
  "rejects malformed terrain coordinates with the public range error: %j",
  (coordinate) => {
    expect(() => validateTerrainCoordinate(coordinate as LngLat)).toThrow(
      RangeError
    );
  }
);
