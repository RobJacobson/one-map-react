import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import type { MapRef } from "../src/contracts/camera-types.js";
import type { ClickEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import { useMapInteractions } from "../src/facade/use-map-interactions.js";

const event: ClickEvent = { lngLat: [1, 2], point: [3, 4] };
const props: MapProps = {
  initialViewState: {
    longitude: 1,
    latitude: 2,
    zoom: 3,
    bearing: 0,
    pitch: 0,
  },
  mapStyle: { version: 8, sources: {}, layers: [] },
};
const mountInteractions = () =>
  renderHook(() =>
    useMapInteractions(props, "mapbox-native", { current: null })
  );

test.each(["click", "move"] as const)(
  "%s delivery snapshots registrations and respects disposal",
  (type) => {
    const mounted = mountInteractions();
    const interactions = mounted.result.current;
    const deliveries: string[] = [];
    const added = vi.fn(() => deliveries.push("added"));
    let releaseSelf = () => {};
    let releaseOther = () => {};
    const self = () => {
      deliveries.push("self");
      releaseSelf();
      releaseOther();
      // Bound re-registration so a broken live iterator fails instead of hanging.
      if (deliveries.length < 3)
        releaseSelf = interactions.subscribe(type, self);
      interactions.subscribe(type, added);
    };
    releaseSelf = interactions.subscribe(type, self);
    releaseOther = interactions.subscribe(type, () =>
      deliveries.push("removed")
    );
    interactions.subscribe(type, () => deliveries.push("last"));

    act(() => interactions.emit(type, event));
    expect(deliveries).toEqual(["self", "last"]);
    expect(added).not.toHaveBeenCalled();
    act(() => interactions.emit(type, event));
    expect(deliveries).toEqual(["self", "last", "last", "self", "added"]);
  }
);

test("unmount during delivery suppresses the rest of the snapshot and retained publishers", () => {
  const mounted = mountInteractions();
  const interactions = mounted.result.current;
  const later = vi.fn();
  interactions.subscribe("click", () => mounted.unmount());
  interactions.subscribe("click", later);

  act(() => interactions.emit("click", event));
  act(() => interactions.emit("click", event));
  expect(later).not.toHaveBeenCalled();
});

test.each(["mapbox-web", "mapbox-native", "maplibre-native"] as const)(
  "%s source unmount suppresses subsequent map click delivery",
  async (backend) => {
    const mapClick = vi.fn();
    const query = vi.fn<MapRef["queryRenderedFeatures"]>().mockResolvedValue([
      {
        type: "Feature",
        source: "routes",
        geometry: { type: "Point", coordinates: [1, 2] },
      },
    ]);
    const map = { queryRenderedFeatures: query } as unknown as MapRef;
    const mounted = renderHook(() =>
      useMapInteractions({ ...props, onClick: mapClick }, backend, {
        current: map,
      })
    );
    const interactions = mounted.result.current;
    interactions.registerSource("routes", () => mounted.unmount(), {});

    await act(async () => {
      if (backend === "mapbox-web") await interactions.click(event);
      else interactions.dispatchSource("routes", event);
    });
    expect(mapClick).not.toHaveBeenCalled();
  }
);

test.each(["map", "source"] as const)(
  "%s click subscriber unmount suppresses the map callback",
  async (origin) => {
    const mapClick = vi.fn();
    const mounted = renderHook(() =>
      useMapInteractions({ ...props, onClick: mapClick }, "mapbox-native", {
        current: null,
      })
    );
    const interactions = mounted.result.current;
    interactions.registerSource("routes", () => {}, {});
    interactions.subscribe("click", () => mounted.unmount());

    await act(async () => {
      if (origin === "map") await interactions.click(event);
      else interactions.dispatchSource("routes", event);
    });
    expect(mapClick).not.toHaveBeenCalled();
  }
);

test("duplicate callbacks have independently disposable registrations", () => {
  const mounted = mountInteractions();
  const interactions = mounted.result.current;
  const callback = vi.fn();
  const release = interactions.subscribe("move", callback);
  interactions.subscribe("move", callback);
  release();
  release();
  act(() => interactions.emit("move", event));
  expect(callback).toHaveBeenCalledTimes(1);
});

test("custom forwarding proxies retain common queries", async () => {
  const query = vi.fn<MapRef["queryRenderedFeatures"]>().mockResolvedValue([]);
  const unknownMethod = vi.fn();
  const map = new Proxy(
    { queryRenderedFeatures: query },
    {
      get: (target, key) =>
        (target as Record<PropertyKey, unknown>)[key] ?? unknownMethod,
    }
  ) as unknown as MapRef;
  const mounted = renderHook(() =>
    useMapInteractions(
      { ...props, interactiveLayerIds: ["route-line"] },
      "mapbox-web",
      { current: map }
    )
  );
  mounted.result.current.registerSource("routes", () => {}, {});
  await act(async () => mounted.result.current.click(event));
  expect(unknownMethod).not.toHaveBeenCalled();
  expect(query).toHaveBeenCalledTimes(2);
  expect(query).toHaveBeenLastCalledWith(event.point, {
    layers: ["route-line"],
  });
});
