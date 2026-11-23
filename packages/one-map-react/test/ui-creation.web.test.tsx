import { render } from "@testing-library/react";
import { forwardRef, type ReactNode, StrictMode } from "react";
import { describe, expect, test } from "vite-plus/test";

import type { NativeBackend } from "../src/contracts/backend.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { NativeMapInputs } from "../src/contracts/native-types.js";
import type { Anchor } from "../src/contracts/ui-types.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";

const camera = { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };
const FakeMap = forwardRef<MapRef, NativeMapInputs>(({ children }, _ref) => (
  <>{children}</>
));
const Empty = () => null;
const createFixture = (backend: NativeBackend) =>
  createNativeMapBinding(FakeMap, {
    backend,
    Source: Empty,
    Layer: Empty,
    Images: Empty,
    Marker: forwardRef((props, _ref) => (
      <div data-testid="marker" data-anchor={props.anchor} />
    )),
  });

const genuineChanges = [
  [
    "Marker",
    (Marker: ReturnType<typeof createFixture>["Marker"], changed: boolean) => (
      <Marker longitude={0} latitude={0} anchor={changed ? "bottom" : "top"} />
    ),
  ],
  [
    "Marker id",
    (Marker: ReturnType<typeof createFixture>["Marker"], changed: boolean) => (
      <Marker longitude={0} latitude={0} id={changed ? "other" : "original"} />
    ),
  ],
  [
    "Marker mode",
    (Marker: ReturnType<typeof createFixture>["Marker"], changed: boolean) => (
      <Marker
        longitude={0}
        latitude={0}
        renderMode={changed ? "annotation" : "view"}
      />
    ),
  ],
] as const;

describe.each<NativeBackend>(["mapbox-native", "maplibre-native"])(
  "%s selected marker creation options",
  (backend) => {
    const { Map: NativeMap, Marker } = createFixture(backend);
    const tree = (children: ReactNode) => (
      <StrictMode>
        <NativeMap mapStyle={style} initialViewState={camera}>
          {children}
        </NativeMap>
      </StrictMode>
    );

    test.each(genuineChanges)(
      "%s rejects a genuine creation change",
      (name, component) => {
        const mounted = render(tree(component(Marker, false)));
        expect(() => mounted.rerender(tree(component(Marker, true)))).toThrow(
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
        </>
      );
      const mounted = render(tree(controls(false)));
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
      );
      mounted.rerender(tree(controls(true)));
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
      );
      mounted.rerender(tree(controls(false)));
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
      );
    });

    test("marker content changes retain the original default", () => {
      const mounted = render(tree(<Marker longitude={0} latitude={0} />));
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
      );
      mounted.rerender(
        tree(
          <Marker longitude={0} latitude={0}>
            custom
          </Marker>
        )
      );
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
      );
      mounted.rerender(
        tree(
          <Marker longitude={0} latitude={0} anchor="bottom">
            custom
          </Marker>
        )
      );
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
      );
      mounted.rerender(
        tree(
          <Marker longitude={0} latitude={0}>
            custom
          </Marker>
        )
      );
      expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
        "bottom"
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

    test.each([false, true])(
      "resolves and retains effective default anchor when initially explicit (custom content: %s)",
      (custom) => {
        const expected: Anchor = custom ? "center" : "bottom";
        const mounted = render(
          tree(
            <Marker longitude={0} latitude={0} anchor={expected}>
              {custom ? "custom" : undefined}
            </Marker>
          )
        );
        expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
          expected
        );
        mounted.rerender(
          tree(
            <Marker longitude={0} latitude={0}>
              {custom ? "custom" : undefined}
            </Marker>
          )
        );
        expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
          expected
        );
        mounted.rerender(
          tree(
            <Marker longitude={0} latitude={0}>
              {custom ? undefined : "custom"}
            </Marker>
          )
        );
        expect(mounted.getByTestId("marker").getAttribute("data-anchor")).toBe(
          expected
        );
      }
    );
  }
);
