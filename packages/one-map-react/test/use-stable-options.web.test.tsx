import { render, renderHook } from "@testing-library/react";
import { forwardRef, type ReactNode, StrictMode } from "react";
import { describe, expect, test } from "vite-plus/test";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../example-map/src/scenarios/map-fixture.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { NativeMapInputs } from "../src/contracts/native-types.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";
import {
  changedOptionKey,
  useStableOptions,
} from "../src/facade/use-stable-options.js";

const FakeMap = forwardRef<MapRef, NativeMapInputs>(({ children }, _ref) => (
  <>{children}</>
));
const { Map: NativeMap, Source } = createNativeMapBinding(FakeMap, {
  backend: "mapbox-native",
  Source: () => null,
  Layer: () => null,
  Images: () => null,
  Marker: () => null,
});

const Probe = ({
  options,
}: {
  readonly options: Readonly<Record<string, unknown>>;
}) => {
  useStableOptions('Source "routes"', options);

  return null;
};

describe("useStableOptions", () => {
  test("returns its original validated value across equivalent renders", () => {
    const original = { position: "top-right", nested: { enabled: true } };
    const mounted = renderHook(
      ({ options }) => useStableOptions("fixture", options),
      {
        initialProps: { options: original },
        wrapper: StrictMode,
      }
    );
    expect(mounted.result.current).toBe(original);
    mounted.rerender({ options: { ...original, nested: { enabled: true } } });
    expect(mounted.result.current).toBe(original);
    expect(() =>
      mounted.rerender({ options: { ...original, nested: { enabled: false } } })
    ).toThrow('creation option "nested"');
  });
  test("accepts unchanged options across rerenders", () => {
    const rendered = render(
      <Probe options={{ id: "routes", cluster: true }} />
    );

    rendered.rerender(<Probe options={{ id: "routes", cluster: true }} />);
    rendered.rerender(<Probe options={{ id: "routes", cluster: true }} />);
  });

  test("accepts deeply equal array and object values", () => {
    const rendered = render(
      <Probe options={{ tiles: ["a", "b"], nested: { zoom: [1, 2] } }} />
    );

    expect(() =>
      rendered.rerender(
        <Probe options={{ tiles: ["a", "b"], nested: { zoom: [1, 2] } }} />
      )
    ).not.toThrow();
  });

  test("throws the changed key when a value differs", () => {
    const rendered = render(
      <Probe options={{ id: "routes", cluster: false }} />
    );

    expect(() =>
      rendered.rerender(<Probe options={{ id: "routes", cluster: true }} />)
    ).toThrow(
      'Source "routes" changed the creation option "cluster". Remount it with a new React key to recreate the resource.'
    );
  });

  test("throws when an option is added or removed", () => {
    const rendered = render(<Probe options={{ id: "routes", maxzoom: 14 }} />);

    expect(() =>
      rendered.rerender(<Probe options={{ id: "routes" }} />)
    ).toThrow('Source "routes" changed the creation option "maxzoom".');
  });

  test("throws when a nested array element differs", () => {
    const rendered = render(<Probe options={{ tiles: ["a", "b"] }} />);

    expect(() =>
      rendered.rerender(<Probe options={{ tiles: ["a", "c"] }} />)
    ).toThrow('changed the creation option "tiles"');
  });
});

describe("source creation option families", () => {
  const tree = (source: ReactNode) => (
    <NativeMap mapStyle={emptyStyle} initialViewState={initialViewState}>
      {source}
    </NativeMap>
  );

  test("geojson data may change without remounting", () => {
    const rendered = render(
      tree(<Source id="routes" type="geojson" data={routes} />)
    );

    expect(() =>
      rendered.rerender(
        tree(
          <Source
            id="routes"
            type="geojson"
            data={{ type: "FeatureCollection", features: [] }}
          />
        )
      )
    ).not.toThrow();
  });

  test("geojson creation options throw when changed", () => {
    const rendered = render(
      tree(<Source id="routes" type="geojson" data={routes} cluster={false} />)
    );

    expect(() =>
      rendered.rerender(
        tree(<Source id="routes" type="geojson" data={routes} cluster />)
      )
    ).toThrow('Source "routes" changed the creation option "cluster".');
  });

  test("geojson clusterMinPoints and promoteId are creation options while data may update", () => {
    const updated = { type: "FeatureCollection", features: [] } as const;
    const minPointsView = render(
      tree(
        <Source
          id="points"
          type="geojson"
          data={routes}
          cluster
          clusterMinPoints={3}
          promoteId="route"
        />
      )
    );

    expect(() =>
      minPointsView.rerender(
        tree(
          <Source
            id="points"
            type="geojson"
            data={updated}
            cluster
            clusterMinPoints={3}
            promoteId="route"
          />
        )
      )
    ).not.toThrow();

    expect(() =>
      minPointsView.rerender(
        tree(
          <Source
            id="points"
            type="geojson"
            data={updated}
            cluster
            clusterMinPoints={4}
            promoteId="route"
          />
        )
      )
    ).toThrow(
      'Source "points" changed the creation option "clusterMinPoints".'
    );

    const promoteView = render(
      tree(
        <Source
          id="promoted"
          type="geojson"
          data={routes}
          cluster
          clusterMinPoints={3}
          promoteId="route"
        />
      )
    );

    expect(() =>
      promoteView.rerender(
        tree(
          <Source
            id="promoted"
            type="geojson"
            data={routes}
            cluster
            clusterMinPoints={3}
            promoteId="other"
          />
        )
      )
    ).toThrow('Source "promoted" changed the creation option "promoteId".');
  });

  test("image url and coordinates may change without remounting", () => {
    const corners = [
      [-122.5, 47.8],
      [-122.1, 47.8],
      [-122.1, 47.4],
      [-122.5, 47.4],
    ] as const;
    const rendered = render(
      tree(
        <Source
          id="overlay"
          type="image"
          url="https://example.com/a.png"
          coordinates={corners}
        />
      )
    );

    expect(() =>
      rendered.rerender(
        tree(
          <Source
            id="overlay"
            type="image"
            url="https://example.com/b.png"
            coordinates={corners}
          />
        )
      )
    ).not.toThrow();
  });

  test("vector creation options throw when changed", () => {
    const rendered = render(
      tree(<Source id="tiles" type="vector" url="https://example.com/t.json" />)
    );

    expect(() =>
      rendered.rerender(
        tree(
          <Source id="tiles" type="vector" url="https://example.com/u.json" />
        )
      )
    ).toThrow('Source "tiles" changed the creation option "url".');
  });
});

describe("changedOptionKey", () => {
  test("compares class instances by identity while plain records compare by value", () => {
    class Provider {
      #longitude: number;

      constructor(longitude: number) {
        this.#longitude = longitude;
      }

      getLongitude(): number {
        return this.#longitude;
      }
    }

    const initial = new Provider(1);
    const replacement = new Provider(2);
    expect(initial.getLongitude()).toBe(1);
    expect(replacement.getLongitude()).toBe(2);
    expect(
      changedOptionKey({ provider: initial }, { provider: initial })
    ).toBeUndefined();
    expect(
      changedOptionKey({ provider: initial }, { provider: replacement })
    ).toBe("provider");
    expect(
      changedOptionKey({ nested: Object.create(null) }, { nested: {} })
    ).toBeUndefined();
  });

  const cases: ReadonlyArray<
    readonly [
      Record<string, unknown>,
      Record<string, unknown>,
      string | undefined,
    ]
  > = [
    [{}, {}, undefined],
    [{ a: 1 }, { a: 1 }, undefined],
    [{ a: 1 }, { a: 2 }, "a"],
    [{ a: 1 }, {}, "a"],
    [{}, { a: 1 }, "a"],
    [{ a: [1, [2]] }, { a: [1, [2]] }, undefined],
    [{ a: [1, [2]] }, { a: [1, [3]] }, "a"],
    [{ a: { b: 1 } }, { a: { b: 1 } }, undefined],
    [{ a: { b: 1 } }, { a: { b: 2 } }, "a"],
    [{ a: null }, { a: null }, undefined],
    [{ a: null }, { a: {} }, "a"],
  ];

  test.each(cases)("compares %o to %o", (previous, next, expected) => {
    expect(changedOptionKey(previous, next)).toBe(expected);
  });
});
