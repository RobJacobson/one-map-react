import { act, fireEvent, render } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { expect, test, vi } from "vite-plus/test";

import { GlobalStateApp } from "../src/scenarios/global-state-app.js";
import type { NativeLocationButtonProps } from "../src/scenarios/native-location-button.js";
import { Tf07Scene, type Tf07Probe } from "../src/scenarios/tf07-scene.js";
import {
  Tf08AcceptanceScene,
  type Tf08AcceptanceProbe,
} from "../src/scenarios/tf08-acceptance-scene.js";
import { Tf09Scene, type Tf09Probe } from "../src/scenarios/tf09-scene.js";

const fixture = vi.hoisted(() => ({
  markers: [] as Array<Record<string, unknown>>,
  props: {} as {
    children?: ReactNode;
    mapStyle?: { name?: string; state?: Record<string, unknown> };
    options?: Record<string, unknown>;
    terrain?: unknown;
    light?: { color: string; intensity: number };
    onIdle?: () => void;
    onClick?: (event: {
      lngLat: readonly [number, number];
      point: readonly [number, number];
      features: readonly object[];
    }) => void;
  },
}));

vi.mock("one-map-react", async () => {
  const react = await import("react");
  return {
    Map: react.forwardRef((props: { children?: ReactNode }, ref) => {
      fixture.props = props;
      react.useImperativeHandle(ref, () => ({
        getWrapperMap: async () => ({
          getCanvas: () => ({
            toDataURL: () => "data:image/png;base64,fixture",
          }),
        }),
        queryTerrainElevation: async () => null,
        getCenter: async () => [0, 0],
        getZoom: async () => 2,
        queryRenderedFeatures: async () => [{ id: 9009 }],
      }));
      return react.createElement("div", {}, props.children);
    }),
    MapSetup: ({ children }: { children?: ReactNode }) => children,
    Source: ({ children }: { children?: ReactNode }) => children,
    Layer: () => null,
    Marker: (props: Record<string, unknown>) => {
      fixture.markers.push(props);
      return null;
    },
    UserLocation: ({
      position,
    }: {
      position?: { lngLat: readonly [number, number] };
    }) => (
      <output data-testid="supplied-location">
        {position ? JSON.stringify(position.lngLat) : "hidden"}
      </output>
    ),
  };
});

vi.mock("one-map-react/maplibre-web", async () => {
  const portable = await import("one-map-react");
  return { Map: portable.Map, adapter: {} };
});

test("terrain and camera configuration preserve the style until explicit replacement", async () => {
  let probe: Tf09Probe | null = null;
  const mounted = render(
    <Tf09Scene
      backend="maplibre-web"
      style={{ width: 400, height: 300 }}
      attach={(value) => {
        probe = value;
      }}
    />
  );
  const command = async (action: string, value?: Record<string, unknown>) => {
    const attached = probe;
    if (!attached) throw new Error("Probe is not attached.");
    let result: unknown;
    await act(async () => {
      result = await attached.command(action, value);
    });
    return result;
  };
  const initialStyle = fixture.props.mapStyle;
  expect(fixture.props.options).toEqual({
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  await expect(command("capture")).resolves.toEqual({
    uri: "data:image/png;base64,fixture",
  });

  await command("configure", { dem: true, terrain: true });
  expect(fixture.props.terrain).toEqual({ source: "dem", exaggeration: 2 });
  expect(fixture.props.mapStyle).toBe(initialStyle);
  const read = async () => {
    const attached = probe;
    if (!attached) throw new Error("Probe is not attached.");
    return attached.command("read");
  };
  expect(await read()).toMatchObject({
    idle: 0,
    committed: {
      terrain: true,
      dem: true,
      shade: true,
      projection: "mercator",
    },
  });
  if (!fixture.props.onIdle) throw new Error("Renderer idle is not observed.");
  fixture.props.onIdle();
  expect(await read()).toMatchObject({ idle: 1 });
  await command("configure", { dem: true, terrain: false, shade: false });
  expect(fixture.props.terrain).toBeNull();
  expect(fixture.props.mapStyle).toBe(initialStyle);
  await command("controlled-camera", { enabled: true });
  expect(fixture.props.mapStyle).toBe(initialStyle);

  await command("replace-style");
  const replacement = fixture.props.mapStyle;
  expect(replacement).not.toBe(initialStyle);
  expect(replacement?.name).toBe("rendering-1");
  await command("configure", { dem: true, terrain: true });
  expect(fixture.props.mapStyle).toBe(replacement);
  mounted.unmount();
  expect(probe).toBeNull();
});

test("global state starts from supported style defaults and replacement owns the null-reset default", async () => {
  const mounted = render(<GlobalStateApp />);
  expect(fixture.props.options).not.toHaveProperty("globalState");
  expect(fixture.props.mapStyle?.state).toEqual({
    color: { default: "#ff00ff" },
    initial: { default: 6014 },
  });

  const probe = window.__oneMapTf09;
  if (!probe) throw new Error("Global-state probe is not attached.");
  expect(fixture.props.options).toMatchObject({
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  await expect(probe.command("capture")).resolves.toEqual({
    uri: "data:image/png;base64,fixture",
  });
  await act(async () => {
    await probe.command("replace-style");
  });
  expect(fixture.props.mapStyle?.name).toBe("global-state-1");
  expect(fixture.props.mapStyle?.state).toEqual({
    color: { default: "#00ffff" },
    initial: { default: 6014 },
  });
  mounted.unmount();
  expect(window.__oneMapTf09).toBeUndefined();
  await expect(probe.command("capture")).rejects.toThrow("not attached");
});

test("light fixture changes supplied colors without replacing style and retains them across explicit replacement", async () => {
  let probe: Tf09Probe | null = null;
  const mounted = render(
    <Tf09Scene
      backend="mapbox-native"
      style={{ width: 400, height: 300 }}
      attach={(value) => {
        probe = value;
      }}
    />
  );
  const command = async (action: string, value?: Record<string, unknown>) => {
    const attached = probe;
    if (!attached) throw new Error("Light probe is not attached.");
    let result: unknown;
    await act(async () => {
      result = await attached.command(action, value);
    });
    return result;
  };
  const initialStyle = fixture.props.mapStyle;
  expect(fixture.props.light).toMatchObject({
    color: "#ffffff",
    intensity: 0.5,
  });
  for (const [color, expected] of [
    ["blue", "#0000ff"],
    ["green", "#00ff00"],
    ["white", "#ffffff"],
  ]) {
    await command("light-color", { color });
    expect(fixture.props.light).toMatchObject({
      color: expected,
      intensity: 0.25,
    });
    expect(await command("light-read")).toMatchObject({
      enabled: true,
      color: expected,
    });
    expect(fixture.props.mapStyle).toBe(initialStyle);
  }
  await command("light-color", { color: "green" });
  await command("replace-style");
  expect(fixture.props.mapStyle).not.toBe(initialStyle);
  expect(fixture.props.light?.color).toBe("#00ff00");
  await expect(command("light-color", { color: "invalid" })).rejects.toThrow(
    "known light-color"
  );
  expect(fixture.props.light?.color).toBe("#00ff00");
  mounted.unmount();
});

test.each([false, true])(
  "TF07 native=%s supplies only supported marker interaction props",
  (native) => {
    fixture.markers = [];
    const scale = vi.fn(() => null);
    const nativeOrnaments = { scaleBarEnabled: true };
    const view = render(
      <Tf07Scene
        renderLocation={() => null}
        renderNavigation={() => null}
        native={native}
        nativeOrnaments={nativeOrnaments}
        renderScale={scale}
        style={{ width: 400, height: 300 }}
        renderPopup={() => null}
        markerContent={() => null}
        report={() => undefined}
        attach={() => undefined}
      />
    );
    if (native) {
      expect(fixture.props.options).toBe(nativeOrnaments);
      expect(scale).not.toHaveBeenCalled();
    } else expect(scale).toHaveBeenCalledWith("metric");
    for (const id of ["tf07-live", "tf07-annotation"]) {
      const marker = fixture.markers.find((props) => props.id === id);
      expect(marker?.onClick).toBeTypeOf("function");
      for (const name of ["draggable", "onDragStart", "onDrag", "onDragEnd"]) {
        if (native) expect(marker).not.toHaveProperty(name);
        else
          expect(marker?.[name]).toEqual(
            name === "draggable" ? true : expect.any(Function)
          );
      }
    }
    view.unmount();
  }
);

test("TF07 application popup close removes its content and teardown stays silent", () => {
  const report = vi.fn();
  const popup = (
    children: ReactNode,
    _onOpen: () => void,
    onClose: () => void
  ) => (
    <div>
      <button type="button" onClick={onClose}>
        Close application popup
      </button>
      {children}
    </div>
  );
  const scene = () => (
    <Tf07Scene
      renderLocation={() => null}
      renderNavigation={() => null}
      native
      style={{ width: 400, height: 300 }}
      renderPopup={popup}
      markerContent={(kind) =>
        kind === "popup" ? <span>Popup child</span> : null
      }
      report={report}
      attach={() => undefined}
    />
  );
  const mounted = render(scene());
  expect(mounted.getByText("Popup child")).toBeTruthy();
  fireEvent.click(mounted.getByText("Close application popup"));
  expect(mounted.queryByText("Popup child")).toBeNull();
  expect(report).toHaveBeenCalledWith("popup-close");
  mounted.unmount();
  const closeCount = report.mock.calls.filter(
    ([event]) => event === "popup-close"
  ).length;
  const second = render(scene());
  second.unmount();
  expect(
    report.mock.calls.filter(([event]) => event === "popup-close")
  ).toHaveLength(closeCount);
});

test("TF07 native scene remount retires its screen location action with the map attachment", async () => {
  const mountedLocation = vi.fn();
  const disposedLocation = vi.fn();
  const Location = () => {
    useEffect(() => {
      mountedLocation();
      return disposedLocation;
    }, []);
    return null;
  };
  let probe: Tf07Probe | null = null;
  const mounted = render(
    <Tf07Scene
      native
      renderLocation={Location}
      renderNavigation={() => null}
      renderPopup={() => null}
      markerContent={() => null}
      style={{ width: 400, height: 300 }}
      report={() => undefined}
      attach={(value) => {
        probe = value;
      }}
    />
  );
  expect(mountedLocation).toHaveBeenCalledTimes(1);
  await act(async () => {
    probe?.configure("remount");
  });
  expect(disposedLocation).toHaveBeenCalledTimes(1);
  expect(mountedLocation).toHaveBeenCalledTimes(2);
  mounted.unmount();
  expect(disposedLocation).toHaveBeenCalledTimes(2);
});

test.each(["mapbox-native", "maplibre-native", "mapbox-web", "maplibre-web"])(
  "TF08 %s configuration clears app display and native SDK puck coverage has one owner",
  async (backend) => {
    let probe: Tf08AcceptanceProbe | null = null;
    const Location = ({ onGeolocate }: NativeLocationButtonProps) => (
      <button
        type="button"
        onClick={() => onGeolocate?.({ lngLat: [7, 8], accuracy: 12 })}
      >
        Deliver application fix
      </button>
    );
    const mounted = render(
      <Tf08AcceptanceScene
        requestLocationPermission={async () => ({
          status: "granted",
          accuracy: "unknown",
        })}
        getCurrentPosition={async () => ({ lngLat: [7, 8] })}
        backend={backend}
        style={{ width: 400, height: 300 }}
        overlay={null}
        renderCoveragePopup={() => null}
        renderLocation={Location}
        nativePuck={<span data-testid="raw-sdk-puck">SDK puck</span>}
        attach={(value) => {
          probe = value;
        }}
        fixtureUrl="http://fixture.invalid"
      />
    );
    const configure = async (mode: string) => {
      await act(async () => {
        await probe?.command("configure", { mode });
      });
    };
    fireEvent.click(
      mounted.getByRole("button", { name: "Deliver application fix" })
    );
    expect(mounted.getByTestId("supplied-location").textContent).toBe("[7,8]");
    await configure("coverage-base");
    expect(mounted.getByTestId("supplied-location").textContent).toBe("hidden");
    await configure("coverage-puck");
    fireEvent.click(
      mounted.getByRole("button", { name: "Deliver application fix" })
    );
    if (backend.endsWith("native")) {
      expect(mounted.queryByTestId("supplied-location")).toBeNull();
      expect(mounted.getByTestId("raw-sdk-puck")).toBeTruthy();
    } else {
      expect(mounted.getByTestId("supplied-location").textContent).toBe(
        "[7,8]"
      );
    }
    await configure("coverage-base");
    expect(mounted.getByTestId("supplied-location").textContent).toBe("hidden");
    mounted.unmount();
  }
);

test("TF08 screen owns overlapping position and permission requests until each completes or the scene disposes", async () => {
  let probe: Tf08AcceptanceProbe | null = null;
  const signals: AbortSignal[] = [];
  const completions: (() => void)[] = [];
  const getCurrentPosition = (signal?: AbortSignal) =>
    new Promise<import("one-map-react").GeolocationPosition>(
      (resolve, reject) => {
        if (!signal)
          throw new Error("Expected application-owned cancellation.");
        signals.push(signal);
        completions.push(() => resolve({ lngLat: [1, 2] }));
        signal.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        });
      }
    );
  const mounted = render(
    <Tf08AcceptanceScene
      backend="mapbox-native"
      style={{ width: 400, height: 300 }}
      overlay={null}
      renderCoveragePopup={() => null}
      renderLocation={() => null}
      fixtureUrl="http://fixture.invalid"
      attach={(value) => {
        probe = value;
      }}
      getCurrentPosition={getCurrentPosition}
      requestLocationPermission={getCurrentPosition}
    />
  );
  const command = (action: string) => {
    if (!probe) throw new Error("Missing scene probe.");
    return probe.command(action);
  };
  const first = command("position");
  const second = command("position");
  const permission = command("permission");
  completions[0]();
  await expect(first).resolves.toMatchObject({ lngLat: [1, 2] });
  expect(signals.map((signal) => signal.aborted)).toEqual([
    false,
    false,
    false,
  ]);
  const secondRejected = expect(second).rejects.toThrow("cancelled");
  const permissionRejected = expect(permission).rejects.toThrow("cancelled");
  mounted.unmount();
  await secondRejected;
  await permissionRejected;
  expect(signals.map((signal) => signal.aborted)).toEqual([false, true, true]);
});

test.each(["position", "permission"])(
  "TF08 disposed app owner rejects late %s results from a noncancellable integration",
  async (action) => {
    let probe: Tf08AcceptanceProbe | null = null;
    let complete: (() => void) | undefined;
    const acquire = () =>
      new Promise<import("one-map-react").GeolocationPosition>((resolve) => {
        complete = () => resolve({ lngLat: [1, 2] });
      });
    const mounted = render(
      <Tf08AcceptanceScene
        backend="mapbox-native"
        style={{ width: 400, height: 300 }}
        overlay={null}
        renderCoveragePopup={() => null}
        renderLocation={() => null}
        fixtureUrl="http://fixture.invalid"
        attach={(value) => {
          probe = value;
        }}
        getCurrentPosition={acquire}
        requestLocationPermission={acquire}
      />
    );
    if (!probe) throw new Error("Missing scene probe.");
    const command = probe as Tf08AcceptanceProbe;
    const pending = command.command(action);
    const rejected = expect(pending).rejects.toThrow("owner disposed");
    mounted.unmount();
    complete?.();
    await rejected;
  }
);

test.each([false, true])(
  "TF07 native=%s activates supplied GeoJSON identity without web metadata",
  (native) => {
    const report = vi.fn();
    const view = render(
      <Tf07Scene
        native={native}
        renderLocation={() => null}
        renderNavigation={() => null}
        renderPopup={() => null}
        markerContent={() => null}
        style={{ width: 400, height: 300 }}
        report={report}
        attach={() => undefined}
      />
    );
    act(() =>
      fixture.props.onClick?.({
        lngLat: [1, 2],
        point: [3, 4],
        features: [
          {
            type: "Feature",
            id: "707",
            properties: { fixture: "tf07" },
            geometry: { type: "Point", coordinates: [1, 2] },
          },
        ],
      })
    );
    expect(report).toHaveBeenCalledWith("source-click");
    expect(report).toHaveBeenCalledWith("map-click");
    view.unmount();
  }
);
