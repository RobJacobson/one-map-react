import { act, fireEvent, render } from "@testing-library/react";
import {
  type ComponentType,
  forwardRef,
  type ReactNode,
  StrictMode,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { describe, expect, vi, test } from "vite-plus/test";

import type { WebWrapper } from "../src/adapters/web/contracts.js";
import { createWebUi } from "../src/adapters/web/ui.js";
import type { Adapter, MapServices } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { LocationService } from "../src/contracts/location-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import type {
  GeolocateControlProps,
  GeolocationPosition,
} from "../src/contracts/ui-types.js";
import { useMapServices } from "../src/facade/map-services.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { useGeolocationControl } from "../src/facade/use-geolocation-control.js";
import { UserLocation } from "../src/facade/user-location.js";
import type { WebGeolocateControlProps } from "../src/mapbox-web.js";

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

const ControlProbe = (props: GeolocateControlProps) => {
  const state = useGeolocationControl(props);
  return (
    <button type="button" onClick={state.activate} disabled={state.pending}>
      Locate
    </button>
  );
};

describe("TF08 setup and location control lifetime", () => {
  test("replacing a selected SDK geolocation provider requires a control remount", () => {
    class Provider {
      getCurrentPosition(): void {}
      watchPosition(): number {
        return 1;
      }
      clearWatch(): void {}
    }

    const delegate = vi.fn(() => null);
    const GeolocateControl = createWebUi({
      backend: "mapbox-web",
      GeolocateControl: delegate,
    } as unknown as WebWrapper<"mapbox-web">)
      .GeolocateControl as ComponentType<WebGeolocateControlProps>;
    const provider = new Provider();
    const mounted = render(
      <GeolocateControl options={{ geolocation: provider }} />
    );
    mounted.rerender(<GeolocateControl options={{ geolocation: provider }} />);
    expect(() =>
      mounted.rerender(
        <GeolocateControl options={{ geolocation: new Provider() }} />
      )
    ).toThrow('GeolocateControl changed the creation option "geolocation"');
  });

  test.each(["mapbox-web", "maplibre-web"] as const)(
    "%s default tracking rejects a controlled camera before SDK delegation",
    (backend) => {
      const selected = fixture();
      const delegate = vi.fn(() => null);
      const { GeolocateControl } = createWebUi({
        backend,
        GeolocateControl: delegate,
      } as unknown as WebWrapper<typeof backend>);

      expect(() =>
        render(
          <MapSetup adapter={selected.adapter}>
            <OneMap
              mapStyle={style}
              initialViewState={camera}
              viewState={camera}
            >
              <GeolocateControl trackUserLocation />
            </OneMap>
          </MapSetup>
        )
      ).toThrow("conflicts with viewState");
      expect(delegate).not.toHaveBeenCalled();

      render(
        <MapSetup adapter={selected.adapter}>
          <OneMap mapStyle={style} initialViewState={camera} viewState={camera}>
            <GeolocateControl />
          </OneMap>
        </MapSetup>
      );
      expect(delegate).toHaveBeenCalled();
    }
  );

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
    expect(services?.offline).toBeUndefined();
    expect(selected.location.watchPosition).not.toHaveBeenCalled();
    expect(selected.location.getCurrentPosition).not.toHaveBeenCalled();
    const source = selected.source.mock.calls[0][0] as unknown as {
      data: { features: { geometry: { coordinates: unknown } }[] };
    };
    expect(source.data.features).toHaveLength(2);
  });
  test("explicit tracking follows updates, suspends for gestures, and resumes without a second watch", async () => {
    const selected = fixture();
    const view = render(
      <StrictMode>
        <MapSetup adapter={selected.adapter}>
          <OneMap mapStyle={style} initialViewState={camera}>
            <ControlProbe trackUserLocation />
          </OneMap>
        </MapSetup>
      </StrictMode>
    );
    fireEvent.click(view.getByRole("button"));
    expect(selected.location.watchPosition).toHaveBeenCalledTimes(1);
    await act(async () => selected.receive({ lngLat: [7, 8] }));
    expect(selected.easeTo).toHaveBeenLastCalledWith({
      center: [7, 8],
      zoom: 14,
    });
    act(selected.move);
    await act(async () => selected.receive({ lngLat: [9, 10] }));
    expect(selected.easeTo).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(view.getByRole("button")));
    expect(selected.easeTo).toHaveBeenLastCalledWith({
      center: [9, 10],
      zoom: 14,
    });
    expect(selected.location.watchPosition).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => selected.receive({ lngLat: [11, 12] }));
    expect(selected.release).toHaveBeenCalledTimes(1);
    expect(selected.easeTo).toHaveBeenCalledTimes(2);
  });
  test.each(["abort", "release"] as const)(
    "%s-triggered unmount suppresses the location failure callback",
    async (cleanup) => {
      const selected = fixture();
      const onError = vi.fn();
      let retire = () => {};
      const provider: LocationService = {
        ...selected.location,
        watchPosition: (position, error, options) => {
          if (cleanup === "abort")
            options?.signal?.addEventListener("abort", () => retire());
          return selected.location.watchPosition(position, error, options);
        },
      };
      if (cleanup === "release")
        selected.release.mockImplementationOnce(() => retire());
      const view = render(
        <MapSetup adapter={selected.adapter}>
          <OneMap mapStyle={style} initialViewState={camera}>
            <ControlProbe
              locationProvider={provider}
              trackUserLocation
              onError={onError}
            />
          </OneMap>
        </MapSetup>
      );
      retire = () => view.unmount();
      fireEvent.click(view.getByRole("button"));
      await act(async () => selected.fail(new Error("location failed")));
      expect(view.queryByRole("button")).toBeNull();
      expect(selected.release).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(selected.easeTo).not.toHaveBeenCalled();
    }
  );

  test("callback-triggered unmount prevents subsequent camera dispatch", async () => {
    const selected = fixture();
    let retire = () => {};
    const view = render(
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <ControlProbe trackUserLocation onGeolocate={() => retire()} />
        </OneMap>
      </MapSetup>
    );
    retire = () => view.unmount();
    fireEvent.click(view.getByRole("button"));
    await act(async () => selected.receive({ lngLat: [7, 8] }));
    expect(selected.easeTo).not.toHaveBeenCalled();
    expect(selected.release).toHaveBeenCalledTimes(1);
  });

  test.each(["position", "error"] as const)(
    "control releases a watch exactly once after synchronous %s unmount",
    async (callback) => {
      const selected = fixture();
      let retire = () => {};
      let receive: (position: GeolocationPosition) => void = () => {};
      let fail: (error: unknown) => void = () => {};
      const provider: LocationService = {
        ...selected.location,
        watchPosition: (position, error) => {
          receive = position;
          fail = error;
          if (callback === "position") position({ lngLat: [7, 8] });
          else error(new Error("Synchronous watch failure"));
          return selected.release;
        },
      };
      const onGeolocate = vi.fn(() => retire());
      const onError = vi.fn(() => retire());
      const view = render(
        <MapSetup adapter={selected.adapter}>
          <OneMap mapStyle={style} initialViewState={camera}>
            <ControlProbe
              trackUserLocation
              locationProvider={provider}
              onGeolocate={onGeolocate}
              onError={onError}
            />
          </OneMap>
        </MapSetup>
      );
      retire = () => view.unmount();
      await act(async () => fireEvent.click(view.getByRole("button")));
      expect(selected.release).toHaveBeenCalledTimes(1);
      await act(async () => {
        receive({ lngLat: [9, 10] });
        fail(new Error("Retired watch failure"));
      });
      expect(onGeolocate).toHaveBeenCalledTimes(
        callback === "position" ? 1 : 0
      );
      expect(onError).toHaveBeenCalledTimes(callback === "error" ? 1 : 0);
      expect(selected.easeTo).not.toHaveBeenCalled();
      expect(selected.release).toHaveBeenCalledTimes(1);
    }
  );
  test.each(["provider", "mode", "detach"] as const)(
    "resumed camera errors are suppressed after %s replacement",
    async (replacement) => {
      const selected = fixture();
      const onError = vi.fn();
      let rejectCamera: (error: Error) => void = () => {};
      const tree = (
        provider: LocationService,
        tracking = true,
        attached = true
      ) => (
        <MapSetup adapter={selected.adapter}>
          <OneMap mapStyle={style} initialViewState={camera}>
            {attached && (
              <ControlProbe
                locationProvider={provider}
                trackUserLocation={tracking}
                onError={onError}
              />
            )}
          </OneMap>
        </MapSetup>
      );
      const view = render(tree(selected.location));
      fireEvent.click(view.getByRole("button"));
      await act(async () => selected.receive({ lngLat: [7, 8] }));
      act(selected.move);
      selected.easeTo.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectCamera = reject;
          })
      );
      await act(async () => fireEvent.click(view.getByRole("button")));

      view.rerender(
        tree(
          replacement === "provider"
            ? { ...selected.location }
            : selected.location,
          replacement !== "mode",
          replacement !== "detach"
        )
      );
      await act(async () => rejectCamera(new Error("Retired camera request")));
      expect(onError).not.toHaveBeenCalled();
      expect(selected.release).toHaveBeenCalledTimes(1);
    }
  );

  test("a current resumed camera failure releases tracking and permits a fresh retry", async () => {
    const selected = fixture();
    const onError = vi.fn();
    const view = render(
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <ControlProbe trackUserLocation onError={onError} />
        </OneMap>
      </MapSetup>
    );
    fireEvent.click(view.getByRole("button"));
    await act(async () => selected.receive({ lngLat: [7, 8] }));
    act(selected.move);
    const error = new Error("Camera dispatch failed");
    selected.easeTo.mockRejectedValueOnce(error);
    await act(async () => fireEvent.click(view.getByRole("button")));
    expect(onError).toHaveBeenCalledWith(error);
    expect(selected.release).toHaveBeenCalledTimes(1);

    await act(async () => selected.receive({ lngLat: [9, 10] }));
    expect(selected.easeTo).toHaveBeenCalledTimes(2);
    fireEvent.click(view.getByRole("button"));
    await act(async () => selected.receive({ lngLat: [11, 12] }));
    expect(selected.location.watchPosition).toHaveBeenCalledTimes(2);
    expect(selected.easeTo).toHaveBeenLastCalledWith({
      center: [11, 12],
      zoom: 14,
    });
  });

  test("retrying after a watch failure is not blocked by its pending camera dispatch", async () => {
    const selected = fixture();
    let rejectCamera: (error: Error) => void = () => {};
    selected.easeTo.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectCamera = reject;
        })
    );
    const onError = vi.fn();
    const view = render(
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <ControlProbe trackUserLocation onError={onError} />
        </OneMap>
      </MapSetup>
    );
    fireEvent.click(view.getByRole("button"));
    await act(async () => selected.receive({ lngLat: [7, 8] }));
    act(() => selected.fail(new Error("Watch failed")));
    fireEvent.click(view.getByRole("button"));
    await act(async () => selected.receive({ lngLat: [9, 10] }));
    expect(selected.easeTo).toHaveBeenLastCalledWith({
      center: [9, 10],
      zoom: 14,
    });

    await act(async () => rejectCamera(new Error("Retired camera request")));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("terminal errors release tracking and go to the current error callback", () => {
    const selected = fixture();
    const onError = vi.fn();
    const view = render(
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <ControlProbe trackUserLocation onError={onError} />
        </OneMap>
      </MapSetup>
    );
    fireEvent.click(view.getByRole("button"));
    const error = new Error("acquisition failed");
    act(() => selected.fail(error));
    expect(onError).toHaveBeenCalledWith(error);
    expect(selected.release).toHaveBeenCalledTimes(1);
  });
  test("an immediate one-shot provider failure reports the error and permits retry", async () => {
    const selected = fixture();
    const error = new Error("Provider unavailable");
    vi.mocked(selected.location.getCurrentPosition).mockImplementationOnce(
      () => {
        throw error;
      }
    );
    const onError = vi.fn();
    const view = render(
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <ControlProbe
            locationProvider={selected.location}
            onError={onError}
          />
        </OneMap>
      </MapSetup>
    );
    fireEvent.click(view.getByRole("button"));
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(view.getByRole("button").hasAttribute("disabled")).toBe(false);
    await act(async () => fireEvent.click(view.getByRole("button")));
    expect(selected.easeTo).toHaveBeenCalledExactlyOnceWith({
      center: [7, 8],
      zoom: 14,
    });
    expect(view.getByRole("button").hasAttribute("disabled")).toBe(false);
  });
  test.each([
    ["provider", "resolve"],
    ["provider", "reject"],
    ["injected", "resolve"],
    ["injected", "reject"],
  ] as const)(
    "%s one-shot requests keep centering when an older camera command completes with %s",
    async (acquisition, outcome) => {
      const selected = fixture();
      let finishFirst: () => void = () => {};
      let rejectFirst: (error: Error) => void = () => {};
      let finishSecond: () => void = () => {};
      selected.easeTo
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve, reject) => {
              finishFirst = resolve;
              rejectFirst = reject;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishSecond = resolve;
            })
        );
      const locate = vi
        .fn<NonNullable<GeolocateControlProps["getCurrentPosition"]>>()
        .mockResolvedValueOnce({ lngLat: [1, 2] })
        .mockResolvedValueOnce({ lngLat: [3, 4] })
        .mockResolvedValueOnce({ lngLat: [5, 6] });
      const onError = vi.fn();
      const onGeolocate = vi.fn();
      const props =
        acquisition === "provider"
          ? {
              locationProvider: {
                ...selected.location,
                getCurrentPosition: locate,
              },
            }
          : { getCurrentPosition: locate };
      const view = render(
        <StrictMode>
          <MapSetup adapter={selected.adapter}>
            <OneMap mapStyle={style} initialViewState={camera}>
              <ControlProbe
                {...props}
                onError={onError}
                onGeolocate={onGeolocate}
              />
            </OneMap>
          </MapSetup>
        </StrictMode>
      );
      await act(async () => fireEvent.click(view.getByRole("button")));
      expect(view.getByRole("button").hasAttribute("disabled")).toBe(false);
      await act(async () => fireEvent.click(view.getByRole("button")));
      expect(selected.easeTo).toHaveBeenCalledTimes(2);
      expect(selected.easeTo).toHaveBeenLastCalledWith({
        center: [3, 4],
        zoom: 14,
      });

      await act(async () => {
        if (outcome === "resolve") finishFirst();
        else rejectFirst(new Error("Retired camera command"));
      });
      await act(async () => fireEvent.click(view.getByRole("button")));
      await act(async () => finishSecond());
      expect(selected.easeTo).toHaveBeenCalledTimes(3);
      expect(selected.easeTo).toHaveBeenLastCalledWith({
        center: [5, 6],
        zoom: 14,
      });
      expect(onGeolocate).toHaveBeenCalledTimes(3);
      expect(onError).not.toHaveBeenCalled();
    }
  );

  test("tracking coalesces pending camera updates and resumes without another watch", async () => {
    const selected = fixture();
    let finishCamera: () => void = () => {};
    selected.easeTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCamera = resolve;
        })
    );
    const tree = (zoom: number) => (
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          <ControlProbe trackUserLocation zoom={zoom} />
        </OneMap>
      </MapSetup>
    );
    const view = render(tree(14));
    fireEvent.click(view.getByRole("button"));
    await act(async () => selected.receive({ lngLat: [1, 2] }));
    act(selected.move);
    await act(async () => selected.receive({ lngLat: [3, 4] }));
    await act(async () => fireEvent.click(view.getByRole("button")));
    await act(async () => selected.receive({ lngLat: [5, 6] }));
    expect(selected.easeTo).toHaveBeenCalledTimes(1);
    view.rerender(tree(18));
    await act(async () => finishCamera());
    expect(selected.easeTo).toHaveBeenCalledTimes(2);
    expect(selected.easeTo).toHaveBeenLastCalledWith({
      center: [5, 6],
      zoom: 18,
    });
    expect(selected.location.watchPosition).toHaveBeenCalledTimes(1);
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
  test("unmounting only the control aborts its owned one-shot acquisition", async () => {
    const selected = fixture();
    vi.mocked(selected.location.getCurrentPosition).mockImplementation(
      () => new Promise(() => {})
    );
    const tree = (control: boolean) => (
      <MapSetup adapter={selected.adapter}>
        <OneMap mapStyle={style} initialViewState={camera}>
          {control && <ControlProbe />}
        </OneMap>
      </MapSetup>
    );
    const view = render(tree(true));
    await act(async () => fireEvent.click(view.getByRole("button")));
    const signal = vi.mocked(selected.location.getCurrentPosition).mock
      .calls[0][0]?.signal;
    expect(signal?.aborted).toBe(false);
    view.rerender(tree(false));
    expect(signal?.aborted).toBe(true);
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
