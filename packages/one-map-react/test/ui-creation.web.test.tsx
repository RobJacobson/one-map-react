import { render } from "@testing-library/react";
import { forwardRef, type ReactNode, StrictMode } from "react";
import { describe, expect, test } from "vite-plus/test";

import type { Adapter, Backend } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Control, GeolocateControl, Marker } from "../src/facade/ui.js";

const camera = { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };
const FakeMap = forwardRef<MapRef, MapProps>(({ children }, _ref) => (
  <>{children}</>
));
const Empty = () => null;
const fakeAdapter = (backend: Backend): Adapter => ({
  backend,
  Map: FakeMap,
  Source: Empty,
  Layer: Empty,
  Images: Empty,
  Marker: forwardRef((_props, _ref) => null),
  Control: Empty,

  GeolocateControl: Empty,

  services: {
    location: {
      requestPermission: async () => ({
        status: "granted",
        accuracy: "unknown",
      }),
      getCurrentPosition: async () => ({ lngLat: [0, 0] }),
      watchPosition: () => () => undefined,
    },
  },
});

const genuineChanges = [
  [
    "Marker",
    (changed: boolean) => (
      <Marker longitude={0} latitude={0} anchor={changed ? "bottom" : "top"} />
    ),
  ],
  [
    "Marker id",
    (changed: boolean) => (
      <Marker longitude={0} latitude={0} id={changed ? "other" : "original"} />
    ),
  ],
  [
    "Marker mode",
    (changed: boolean) => (
      <Marker
        longitude={0}
        latitude={0}
        renderMode={changed ? "annotation" : "view"}
      />
    ),
  ],
  [
    "Control",
    (changed: boolean) => (
      <Control position={changed ? "bottom-left" : "top-right"} />
    ),
  ],

  [
    "GeolocateControl",
    (changed: boolean) => (
      <GeolocateControl position={changed ? "bottom-left" : "top-right"} />
    ),
  ],
] as const;

describe.each<Backend>([
  "mapbox-web",
  "maplibre-web",
  "mapbox-native",
  "maplibre-native",
])("%s custom adapter creation contracts", (backend) => {
  const adapter = fakeAdapter(backend);
  const tree = (children: ReactNode) => (
    <StrictMode>
      <MapSetup adapter={adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          {children}
        </OneMap>
      </MapSetup>
    </StrictMode>
  );

  test.each(genuineChanges)(
    "%s rejects a genuine creation change",
    (name, component) => {
      const mounted = render(tree(component(false)));
      expect(() => mounted.rerender(tree(component(true)))).toThrow(
        `${name.split(" ")[0]} changed the creation option`
      );
    }
  );

  test("equivalent defaults work in both directions, and mutable fields remain mutable", () => {
    const controls = (explicit: boolean) => (
      <>
        <Marker
          longitude={explicit ? 1 : 0}
          latitude={0}
          anchor={explicit ? "bottom" : undefined}
          renderMode={explicit ? "view" : undefined}
        />
        <Control position={explicit ? "top-right" : undefined}>
          {explicit ? "updated" : "original"}
        </Control>
        <GeolocateControl
          position={explicit ? "top-right" : undefined}
          zoom={explicit ? 10 : 14}
        />
      </>
    );
    const mounted = render(tree(controls(false)));
    mounted.rerender(tree(controls(true)));
    mounted.rerender(tree(controls(false)));
  });

  test("marker content changes retain the original default", () => {
    const mounted = render(tree(<Marker longitude={0} latitude={0} />));
    mounted.rerender(
      tree(
        <Marker longitude={0} latitude={0}>
          custom
        </Marker>
      )
    );
    mounted.rerender(
      tree(
        <Marker longitude={0} latitude={0} anchor="bottom">
          custom
        </Marker>
      )
    );
    expect(() =>
      mounted.rerender(
        tree(
          <Marker longitude={0} latitude={0} anchor="center">
            custom
          </Marker>
        )
      )
    ).toThrow('creation option "anchor"');
  });
});
