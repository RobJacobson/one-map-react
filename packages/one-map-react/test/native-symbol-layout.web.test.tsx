import { render } from "@testing-library/react";
import { expect, test } from "vite-plus/test";

import type { Adapter } from "../src/contracts/adapter.js";
import { Layer } from "../src/facade/layer.js";
import { MapSetup } from "../src/facade/map-setup.js";

for (const backend of ["mapbox-native", "maplibre-native"] as const) {
  for (const layout of [
    { "icon-overlap": "always" as const },
    { "text-overlap": "always" as const },
    { "text-variable-anchor-offset": [["top", [0, 1]]] as const },
  ]) {
    const key = Object.keys(layout)[0];
    test(`${backend} rejects common symbol layout ${key}`, () => {
      // Only selection and Layer participate; unrelated adapter operations deliberately fail.
      const adapter = {
        backend,
        Layer: () => null,
      } as unknown as Adapter;
      expect(() =>
        render(
          <MapSetup adapter={adapter}>
            <Layer id="symbol" type="symbol" layout={layout} />
          </MapSetup>
        )
      ).toThrow(`${key} is not available on ${backend}.`);
    });
  }
}
