import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, vi, test } from "vite-plus/test";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Source } from "../src/facade/source.js";
import {
  changedOptionKey,
  useStableOptions,
} from "../src/facade/use-stable-options.js";
import { adapter } from "../src/mapbox-web.js";

vi.mock("react-map-gl/mapbox", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");

  return createWebMapMock();
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
    <MapSetup adapter={adapter}>
      <OneMap mapStyle={emptyStyle} initialViewState={initialViewState}>
        {source}
      </OneMap>
    </MapSetup>
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
