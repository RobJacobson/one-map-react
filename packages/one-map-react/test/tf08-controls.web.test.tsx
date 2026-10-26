import { act, render } from "@testing-library/react";
import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { describe, expect, vi, test } from "vite-plus/test";

import type { Adapter, MapServices } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { LocationService } from "../src/contracts/location-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type { GeolocationPosition } from "../src/contracts/ui-types.js";
import { useMapServices } from "../src/facade/map-services.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { UserLocation } from "../src/facade/user-location.js";

const style = { version: 8 as const, sources: {}, layers: [] };
const camera = { longitude: 1, latitude: 2, zoom: 3, bearing: 0, pitch: 0 };
const fixture = () => {
  let props: MapProps | undefined;
  let receive: (position: GeolocationPosition) => void = () => {};
  let failure: (error: unknown) => void = () => {};
  const release = vi.fn();
  const location: LocationService = {
    requestPermission: vi
      .fn<LocationService["requestPermission"]>()
      .mockResolvedValue({ status: "granted", accuracy: "unknown" }),
    getCurrentPosition: vi
      .fn<LocationService["getCurrentPosition"]>()
      .mockResolvedValue({ lngLat: [7, 8], timestamp: Date.now() }),
    watchPosition: vi
      .fn<LocationService["watchPosition"]>()
      .mockImplementation((position, error) => {
        receive = position;
        failure = error;
        return release;
      }),
  };
  const easeTo = vi.fn<MapRef["easeTo"]>().mockResolvedValue(undefined);
  const map = { easeTo } as unknown as MapRef;
  const FakeMap = forwardRef<MapRef, MapProps>((value, ref) => {
    props = value;
    useImperativeHandle(ref, () => map, []);
    useLayoutEffect(() => {
      value.onLoad?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the mock emits load once per attachment
    }, []);
    return <div>{value.children}</div>;
  });
  const source = vi.fn(({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ));
  const adapter = {
    backend: "mapbox-web",
    services: { location },
    Map: FakeMap,
    Source: source,
    Layer: () => null,
  } as unknown as Adapter;
  return {
    adapter,
    location,
    easeTo,
    release,
    source,
    receive: (position: GeolocationPosition) => receive(position),
    fail: (error: unknown) => failure(error),
    move: () => props?.onMove?.({ viewState: camera, origin: "user" }),
  };
};

describe("TF08 retained setup services and location display", () => {
  test("services are usable outside a Map and mounting location display starts no acquisition", () => {
    const selected = fixture();
    let services: MapServices | undefined;
    const Probe = () => {
      // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
      services = useMapServices();
      return null;
    };
    render(
      <MapSetup adapter={selected.adapter}>
        <Probe />
        <OneMap mapStyle={style} initialViewState={camera}>
          <UserLocation
            position={{ lngLat: [7, 8], accuracy: 30 }}
            showAccuracyCircle
          />
        </OneMap>
      </MapSetup>
    );
    expect(services).not.toHaveProperty("offline");
    expect(selected.location.watchPosition).not.toHaveBeenCalled();
    expect(selected.location.getCurrentPosition).not.toHaveBeenCalled();
    const source = selected.source.mock.calls[0][0] as unknown as {
      data: { features: { geometry: { coordinates: unknown } }[] };
    };
    expect(source.data.features).toHaveLength(2);
  });

  test("setup rejects provider replacement and a pending acquisition on teardown", async () => {
    const selected = fixture();
    let services: MapServices | undefined;
    const Probe = () => {
      // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
      services = useMapServices();
      return null;
    };
    const provider = {
      ...selected.location,
      getCurrentPosition: vi
        .fn<LocationService["getCurrentPosition"]>()
        .mockImplementation(() => new Promise(() => {})),
    };
    const view = render(
      <MapSetup adapter={selected.adapter} locationProvider={provider}>
        <Probe />
      </MapSetup>
    );
    const result = services?.location.getCurrentPosition();
    const rejected = expect(result).rejects.toThrow("detached");
    view.unmount();
    await rejected;
    const setup = render(
      <MapSetup adapter={selected.adapter} locationProvider={provider}>
        <Probe />
      </MapSetup>
    );
    expect(() =>
      setup.rerender(
        <MapSetup adapter={selected.adapter} locationProvider={{ ...provider }}>
          <Probe />
        </MapSetup>
      )
    ).toThrow("new key");
  });

  test("scoped services reject cancellation before provider dispatch and suppress disposed callbacks", async () => {
    const selected = fixture();
    let services: MapServices | undefined;
    const Probe = () => {
      // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
      services = useMapServices();
      return null;
    };
    render(
      <MapSetup adapter={selected.adapter}>
        <Probe />
      </MapSetup>
    );
    const update = vi.fn();
    const dispose = services?.location.watchPosition(update, vi.fn());
    dispose?.();
    selected.receive({ lngLat: [1, 2] });
    expect(update).not.toHaveBeenCalled();
    const controller = new AbortController();
    const position = services?.location.getCurrentPosition({
      signal: controller.signal,
    });
    const rejected = expect(position).rejects.toThrow("cancelled");
    controller.abort();
    await rejected;
    expect(selected.location.getCurrentPosition).not.toHaveBeenCalled();
  });
  test.each(["position", "error"] as const)(
    "setup releases a watch when a synchronous %s callback unmounts it",
    (callback) => {
      const selected = fixture();
      let services: MapServices | undefined;
      let receive: (position: GeolocationPosition) => void = () => {};
      let fail: (error: unknown) => void = () => {};
      vi.mocked(selected.location.watchPosition).mockImplementation(
        (position, error) => {
          receive = position;
          fail = error;
          if (callback === "position") position({ lngLat: [7, 8] });
          else error(new Error("synchronous provider failure"));
          return selected.release;
        }
      );
      const Probe = () => {
        // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
        services = useMapServices();
        return null;
      };
      const view = render(
        <MapSetup adapter={selected.adapter}>
          <Probe />
        </MapSetup>
      );
      const onPosition = vi.fn(() => view.unmount());
      const onError = vi.fn(() => view.unmount());
      let dispose: (() => void) | undefined;

      act(() => {
        dispose = services?.location.watchPosition(onPosition, onError);
      });
      expect(selected.release).toHaveBeenCalledTimes(1);
      receive({ lngLat: [9, 10] });
      fail(new Error("retired provider failure"));
      expect(onPosition).toHaveBeenCalledTimes(callback === "position" ? 1 : 0);
      expect(onError).toHaveBeenCalledTimes(callback === "error" ? 1 : 0);
      dispose?.();
      dispose?.();
      expect(selected.release).toHaveBeenCalledTimes(1);
    }
  );
});

const rawControls = vi.hoisted(() => ({
  mapbox: vi.fn(() => null),
  maplibre: vi.fn(() => null),
}));
vi.mock("react-map-gl/mapbox", async (original) => ({
  ...(await original<typeof import("react-map-gl/mapbox")>()),
  GeolocateControl: rawControls.mapbox,
}));
vi.mock("react-map-gl/maplibre", async (original) => ({
  ...(await original<typeof import("react-map-gl/maplibre")>()),
  GeolocateControl: rawControls.maplibre,
}));

// Raw selected exports are upstream components, independent of facade setup policy.
test.each(["mapbox", "maplibre"] as const)(
  "%s selected raw geolocation forwards upstream options and callbacks without setup override interception",
  async (backend) => {
    const selected = fixture();
    const entry =
      backend === "mapbox"
        ? await import("../src/mapbox-web.js")
        : await import("../src/maplibre-web.js");
    const RawControl = entry.WrapperGeolocateControl;
    const delegate = rawControls[backend];
    delegate.mockClear();
    expect(RawControl).toBe(delegate);
    const onGeolocate = vi.fn();
    const onError = vi.fn();
    const positionOptions = { enableHighAccuracy: true, timeout: 1234 };
    const mounted = render(
      <MapSetup adapter={selected.adapter} locationProvider={selected.location}>
        <RawControl
          position="bottom-left"
          positionOptions={positionOptions}
          fitBoundsOptions={{ maxZoom: 13 }}
          trackUserLocation
          onGeolocate={onGeolocate}
          onError={onError}
        />
      </MapSetup>
    );
    expect(delegate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: "bottom-left",
        positionOptions,
        fitBoundsOptions: { maxZoom: 13 },
        trackUserLocation: true,
        onGeolocate,
        onError,
      }),
      undefined
    );
    expect(selected.location.requestPermission).not.toHaveBeenCalled();
    expect(selected.location.getCurrentPosition).not.toHaveBeenCalled();
    expect(selected.location.watchPosition).not.toHaveBeenCalled();
    mounted.unmount();
  }
);
