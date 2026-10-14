import { describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react";
import {
  forwardRef,
  type ReactNode,
  StrictMode,
  useImperativeHandle,
} from "react";

import type { Adapter } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { ClickEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type { GeoJsonFeature } from "../src/contracts/source-types.js";
import { Map as OneMap, useMap } from "../src/facade/map.js";
import { type MapSession, useMapSession } from "../src/facade/map-context.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Source } from "../src/facade/source.js";

const hit: ClickEvent = { lngLat: [1, 2], point: [3, 4] };
const camera = { longitude: 1, latitude: 2, zoom: 3, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };

const createFixture = () => {
  let mapProps: MapProps | undefined;
  const query = jest.fn<MapRef["queryRenderedFeatures"]>();
  const features: (GeoJsonFeature & { source: string })[] = [
    {
      type: "Feature",
      source: "places",
      geometry: { type: "Point", coordinates: [1, 2] },
      properties: {},
    },
  ];
  query.mockResolvedValue(features);
  const map = {
    queryRenderedFeatures: query,
    getZoom: jest.fn<MapRef["getZoom"]>().mockResolvedValue(3),
  } as unknown as MapRef;
  const FakeMap = forwardRef<MapRef, MapProps>((props, ref) => {
    mapProps = props;
    useImperativeHandle(ref, () => map, []);
    return <div>{props.children}</div>;
  });
  const adapter = {
    backend: "mapbox-web",
    services: {
      location: {
        requestPermission: jest.fn(),
        getCurrentPosition: jest.fn(),
        watchPosition: jest.fn(),
      },
    },
    Map: FakeMap,
    Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  } as unknown as Adapter;
  const click = async () => {
    await act(async () => {
      mapProps?.onClick?.(hit);
    });
  };
  return { adapter, map, query, click, props: () => mapProps };
};

const Probe = ({ capture }: { capture: (map: MapRef) => void }) => {
  capture(useMap());
  return null;
};

describe("TF07 map-local UI lifetime", () => {
  test("enclosing useMap forwards commands after attachment and rejects after teardown", async () => {
    const fixture = createFixture();
    let observed: MapRef | undefined;
    const rendered = render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <Probe
            capture={(map) => {
              observed = map;
            }}
          />
        </OneMap>
      </MapSetup>
    );
    await expect(observed?.getZoom()).resolves.toBe(3);
    rendered.unmount();
    await expect(observed?.getZoom()).rejects.toThrow("not attached");
  });

  test("source propagation stops map callback and permits mutable callbacks in StrictMode", async () => {
    const fixture = createFixture();
    const mapClick = jest.fn();
    const initial = jest.fn((event: { stopPropagation: () => void }) =>
      event.stopPropagation()
    );
    const updated = jest.fn();
    const tree = (onClick: typeof initial | typeof updated) => (
      <StrictMode>
        <MapSetup adapter={fixture.adapter}>
          <OneMap mapStyle={style} initialViewState={camera} onClick={mapClick}>
            <Source
              id="places"
              type="geojson"
              data={{ type: "Point", coordinates: [1, 2] }}
              onClick={onClick}
            />
          </OneMap>
        </MapSetup>
      </StrictMode>
    );
    const rendered = render(tree(initial));
    await fixture.click();
    expect(initial).toHaveBeenCalledTimes(1);
    expect(mapClick).not.toHaveBeenCalled();
    rendered.rerender(tree(updated));
    await fixture.click();
    expect(updated).toHaveBeenCalledTimes(1);
    expect(mapClick).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  test("late query completion does not dispatch source or map callbacks after teardown", async () => {
    const fixture = createFixture();
    let resolve: ((features: readonly GeoJsonFeature[]) => void) | undefined;
    fixture.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const sourceClick = jest.fn();
    const mapClick = jest.fn();
    const rendered = render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap mapStyle={style} initialViewState={camera} onClick={mapClick}>
          <Source
            id="places"
            type="vector"
            url="fixture://places"
            onClick={sourceClick}
          />
        </OneMap>
      </MapSetup>
    );
    await fixture.click();
    rendered.unmount();
    await act(async () => {
      resolve?.([
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [1, 2] },
          properties: {},
        },
      ]);
    });
    expect(sourceClick).not.toHaveBeenCalled();
    expect(mapClick).not.toHaveBeenCalled();
  });

  test("failed hit queries report failures without inventing empty successful hits", async () => {
    const fixture = createFixture();
    const error = new Error("query failed");
    fixture.query.mockRejectedValue(error);
    const report = jest.fn();
    const mapClick = jest.fn();
    render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap
          mapStyle={style}
          initialViewState={camera}
          onError={report}
          onClick={mapClick}
        >
          <Source
            id="places"
            type="vector"
            url="fixture://places"
            onClick={() => {}}
          />
        </OneMap>
      </MapSetup>
    );
    await fixture.click();
    expect(report).toHaveBeenCalledWith({ error });
    expect(mapClick).not.toHaveBeenCalled();
  });
  test("only the topmost registered source activates independently of map layer filtering", async () => {
    const fixture = createFixture();
    const top = jest.fn();
    const lower = jest.fn();
    const mapClick = jest.fn();
    const features = [
      {
        type: "Feature" as const,
        source: "top",
        geometry: { type: "Point", coordinates: [1, 2] },
      },
      {
        type: "Feature" as const,
        source: "lower",
        geometry: { type: "Point", coordinates: [1, 2] },
      },
    ];
    fixture.query.mockResolvedValueOnce(features).mockResolvedValueOnce([]);
    render(
      <MapSetup adapter={fixture.adapter}>
        <OneMap
          mapStyle={style}
          initialViewState={camera}
          interactiveLayerIds={["map-only"]}
          onClick={mapClick}
        >
          <Source
            id="lower"
            type="vector"
            url="fixture://lower"
            onClick={lower}
          />
          <Source id="top" type="vector" url="fixture://top" onClick={top} />
        </OneMap>
      </MapSetup>
    );
    await fixture.click();
    expect(top).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
    expect(fixture.query).toHaveBeenNthCalledWith(1, hit.point);
    expect(fixture.query).toHaveBeenNthCalledWith(2, hit.point, {
      layers: ["map-only"],
    });
    expect(mapClick).toHaveBeenCalledWith({ ...hit, features: [] });
  });

  test("named maps register after mount and release captured commands after teardown", async () => {
    const fixture = createFixture();
    let named: MapRef | undefined;
    const NamedProbe = () => {
      named = useMap("named");
      return null;
    };
    const tree = (probe: boolean) => (
      <MapSetup adapter={fixture.adapter}>
        <OneMap id="named" mapStyle={style} initialViewState={camera} />
        {probe && <NamedProbe />}
      </MapSetup>
    );
    const rendered = render(tree(false));
    rendered.rerender(tree(true));
    await expect(named?.getZoom()).resolves.toBe(3);
    rendered.rerender(tree(false));
    rendered.unmount();
    await expect(named?.getZoom()).rejects.toThrow("not attached");
  });
  test("a pending hit cannot activate a keyed replacement Source with the same id", async () => {
    const fixture = createFixture();
    let resolve: ((features: readonly GeoJsonFeature[]) => void) | undefined;
    fixture.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const original = jest.fn();
    const replacement = jest.fn();
    const mapClick = jest.fn();
    const tree = (generation: number) => (
      <MapSetup adapter={fixture.adapter}>
        <OneMap mapStyle={style} initialViewState={camera} onClick={mapClick}>
          <Source
            key={generation}
            id="places"
            type="vector"
            url="fixture://places"
            onClick={generation === 0 ? original : replacement}
          />
        </OneMap>
      </MapSetup>
    );
    const rendered = render(tree(0));
    await fixture.click();
    rendered.rerender(tree(1));
    await act(async () => {
      resolve?.([
        {
          type: "Feature",
          source: "places",
          geometry: { type: "Point", coordinates: [1, 2] },
        },
      ]);
    });
    expect(original).not.toHaveBeenCalled();
    expect(replacement).not.toHaveBeenCalled();
    expect(mapClick).not.toHaveBeenCalled();
  });

  test("pending hits use the latest callback on the same source attachment", async () => {
    const fixture = createFixture();
    let resolve: ((features: readonly GeoJsonFeature[]) => void) | undefined;
    fixture.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const original = jest.fn();
    const updated = jest.fn();
    const tree = (onClick: typeof original) => (
      <MapSetup adapter={fixture.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <Source
            id="places"
            type="vector"
            url="fixture://places"
            onClick={onClick}
          />
        </OneMap>
      </MapSetup>
    );
    const rendered = render(tree(original));
    await fixture.click();
    rendered.rerender(tree(updated));
    await act(async () => {
      resolve?.([
        {
          type: "Feature",
          source: "places",
          geometry: { type: "Point", coordinates: [1, 2] },
        },
      ]);
    });
    expect(original).not.toHaveBeenCalled();
    expect(updated).toHaveBeenCalledTimes(1);
  });

  test("pending native source propagation is discarded after source replacement", async () => {
    const fixture = createFixture();
    const nativeAdapter = {
      ...fixture.adapter,
      backend: "maplibre-native" as const,
    };
    let session: MapSession | undefined;
    const SessionProbe = () => {
      session = useMapSession();
      return null;
    };
    let resolve: ((features: readonly GeoJsonFeature[]) => void) | undefined;
    fixture.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const mapClick = jest.fn();
    const sourceClick = jest.fn();
    const tree = (generation: number) => (
      <MapSetup adapter={nativeAdapter}>
        <OneMap
          mapStyle={style}
          initialViewState={camera}
          interactiveLayerIds={["places-layer"]}
          onClick={mapClick}
        >
          <SessionProbe />
          <Source
            key={generation}
            id="places"
            type="vector"
            url="fixture://places"
            onClick={sourceClick}
          />
        </OneMap>
      </MapSetup>
    );
    const rendered = render(tree(0));
    await act(async () => {
      session?.dispatchSource("places", { ...hit, features: [] });
    });
    expect(sourceClick).toHaveBeenCalledTimes(1);
    rendered.rerender(tree(1));
    await act(async () => {
      resolve?.([]);
    });
    expect(sourceClick).toHaveBeenCalledTimes(1);
    expect(mapClick).not.toHaveBeenCalled();
  });
});
