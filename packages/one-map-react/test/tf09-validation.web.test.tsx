import { render } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import type { NativeMapInputs } from "../src/contracts/native-types.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";

const renderer = vi.fn(() => null);
const { Map: NativeMap } = createNativeMapBinding(renderer, {
  backend: "maplibre-native",
  Source: () => null,
  Layer: () => null,
  Images: () => null,
  Marker: () => null,
});
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
  renderer.mockClear();
  expect(() =>
    render(
      <NativeMap
        {...(props as unknown as Partial<NativeMapInputs>)}
        mapStyle={style}
        initialViewState={camera}
      />
    )
  ).toThrow(RangeError);
  expect(renderer).not.toHaveBeenCalled();
});
