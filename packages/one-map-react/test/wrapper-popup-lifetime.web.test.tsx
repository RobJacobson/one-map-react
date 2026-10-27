import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import { act, fireEvent, render } from "@testing-library/react";
import {
  type ComponentType,
  type Context,
  createContext,
  type ReactNode,
  StrictMode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { expect, test, vi } from "vite-plus/test";

import {
  Tf07Scene,
  type Tf07Probe,
} from "../../../examples/shared/tf07-scene.js";

type Sdk = Pick<(typeof import("mapbox-gl"))["default"], "Popup" | "Evented">;
type PopupProps = {
  longitude: number;
  latitude: number;
  closeOnClick?: boolean;
  closeOnMove?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  children?: ReactNode;
};
const runtime = vi.hoisted(() => ({
  sdk: undefined as Sdk | undefined,
  context: undefined as
    | Context<{ map: { getMap: () => object }; mapLib: Sdk }>
    | undefined,
  removeMap: true,
}));

// Match react-map-gl Map's passive destroy -> SDK 'remove' before the child
// Popup unsubscribes. No SDK Map, renderer, or GPU is constructed.
const MapBoundary = ({ children }: { children?: ReactNode }) => {
  const sdk = runtime.sdk;
  const Context = runtime.context;
  if (!sdk || !Context) throw new Error("Pinned popup context was not loaded.");
  const map = useMemo(() => {
    const container = document.createElement("div");
    return Object.assign(new sdk.Evented(), {
      transform: { renderWorldCopies: false, width: 400, height: 300 },
      _camera: {
        transform: {
          width: 400,
          height: 300,
          getCoveringTilesDetailsProvider: () => ({
            allowWorldCopies: () => false,
          }),
        },
      },
      _canvasContainer: container,
      getContainer: () => {
        if (!container.isConnected) document.body.appendChild(container);
        return container;
      },
      _getUIString: () => "Close popup",
      _showingGlobe: () => false,
      _requestDomTask: (task: () => void) => task(),
      project: () => ({
        x: 100,
        y: 100,
        add: ({ x, y }: { x: number; y: number }) => ({
          round: () => ({ x: 100 + x, y: 100 + y }),
        }),
      }),
      _addPopup: () => {},
      _removePopup: () => {},
    });
  }, [sdk]);
  const removeMap = runtime.removeMap;
  const [ready, setReady] = useState(false);
  // The pinned Map renders children only after its effect publishes mapInstance.
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      if (removeMap) map.fire("remove");
      map._canvasContainer.remove();
    };
  }, [map, removeMap]);
  return (
    ready && (
      <Context value={{ map: { getMap: () => map }, mapLib: sdk }}>
        {children}
      </Context>
    )
  );
};

vi.mock("one-map-react", async () => {
  const react = await import("react");
  const Empty = () => null;
  const Content = ({ children }: { children?: ReactNode }) => children;
  return {
    Map: react.forwardRef(({ children }: { children?: ReactNode }, _ref) => (
      <MapBoundary>{children}</MapBoundary>
    )),
    Marker: Empty,
    Source: Content,
    Layer: Empty,
    UserLocation: Empty,
  };
});

const loadPopup = async (engine: "mapbox" | "maplibre") => {
  const require = createRequire(import.meta.url);
  const wrapperRequire = createRequire(
    require.resolve(`react-map-gl/${engine}`)
  );
  const source = resolve(
    dirname(wrapperRequire.resolve(`@vis.gl/react-${engine}`)),
    "../src/components"
  );
  const { Popup } = (await import(/* @vite-ignore */ `${source}/popup.ts`)) as {
    Popup: ComponentType<PopupProps>;
  };
  const { MapContext } = (await import(
    /* @vite-ignore */ `${source}/map.tsx`
  )) as { MapContext: NonNullable<typeof runtime.context> };
  runtime.context = MapContext;
  runtime.sdk =
    engine === "mapbox"
      ? require("mapbox-gl")
      : await import(
          /* @vite-ignore */ resolve(
            dirname(require.resolve("maplibre-gl/package.json")),
            "dist/maplibre-gl.mjs"
          )
        );
  return Popup;
};
const closePopup = () => {
  const button = document.querySelector(
    ".mapboxgl-popup-close-button, .maplibregl-popup-close-button"
  );
  if (!button)
    throw new Error("The current SDK popup close button is missing.");
  fireEvent.click(button);
};

test.each(["mapbox", "maplibre"] as const)(
  "%s raw popup distinguishes its own cleanup from parent map removal",
  async (engine) => {
    const Popup = await loadPopup(engine);
    for (const mode of ["popup", "map", "recycle"] as const) {
      runtime.removeMap = mode !== "recycle";
      const closed = vi.fn();
      const Raw = () => {
        const [open, setOpen] = useState(true);
        const [generation, setGeneration] = useState(0);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              reopen raw
            </button>
            <button
              type="button"
              onClick={() =>
                mode === "popup"
                  ? setOpen(false)
                  : setGeneration((current) => current + 1)
              }
            >
              remove raw
            </button>
            <MapBoundary key={generation}>
              {open && (
                <Popup
                  longitude={0}
                  latitude={0}
                  closeOnMove={false}
                  closeOnClick={false}
                  onClose={() => {
                    closed();
                    setOpen(false);
                  }}
                >
                  raw content
                </Popup>
              )}
            </MapBoundary>
          </>
        );
      };
      const view = render(<Raw />);
      await act(async () => {});
      closePopup();
      expect(closed).toHaveBeenCalledTimes(1);
      fireEvent.click(view.getByText("reopen raw"));
      await act(async () => fireEvent.click(view.getByText("remove raw")));
      expect(closed).toHaveBeenCalledTimes(mode === "map" ? 2 : 1);
      view.unmount();
    }
  }
);

const Theme = createContext("first");
const PopupChild = () => {
  const theme = useContext(Theme);
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((current) => current + 1)}>
      {theme}: {count}
    </button>
  );
};

test.each([
  ["mapbox", false],
  ["maplibre", false],
  ["mapbox", true],
  ["maplibre", true],
] as const)(
  "%s application popup owns callbacks across remount, StrictMode=%s",
  async (engine, strict) => {
    const Popup = await loadPopup(engine);
    runtime.removeMap = true;
    const report = vi.fn();
    const callbacks: Array<{ open: () => void; close: () => void }> = [];
    let probe: Tf07Probe | null = null;
    const attach = (value: Tf07Probe | null) => {
      probe = value;
    };
    const configure = (action: "popup" | "remount" | "style") => {
      if (!probe) throw new Error("Scene probe is not attached.");
      probe.configure(action);
    };
    const tree = (theme: string) => {
      const scene = (
        <Theme value={theme}>
          <Tf07Scene
            renderLocation={() => null}
            renderNavigation={() => null}
            style={{ width: 400, height: 300 }}
            report={report}
            attach={attach}
            markerContent={(kind) => (kind === "popup" ? <PopupChild /> : null)}
            renderPopup={(children, onOpen, onClose) => {
              callbacks.push({ open: onOpen, close: onClose });
              return (
                <Popup
                  longitude={0}
                  latitude={0}
                  closeOnMove={false}
                  closeOnClick={false}
                  onOpen={onOpen}
                  onClose={onClose}
                >
                  {children}
                </Popup>
              );
            }}
          />
        </Theme>
      );
      return strict ? <StrictMode>{scene}</StrictMode> : scene;
    };
    const count = (event: string) =>
      report.mock.calls.filter(([name]) => name === event).length;
    const view = render(tree("first"));
    await act(async () => {});
    fireEvent.click(view.getByText("first: 0"));
    view.rerender(tree("updated"));
    act(() => configure("style"));
    expect(view.getByText("updated: 1")).toBeTruthy();
    closePopup();
    expect(count("popup-close")).toBe(1);
    expect(view.queryByText("updated: 1")).toBeNull();
    act(() => configure("popup"));
    const old = callbacks.at(-1);
    if (!old) throw new Error("Old callback capture is missing.");
    await act(async () => configure("remount"));
    expect(count("popup-close")).toBe(1);
    expect(view.getByText("updated: 0")).toBeTruthy();
    const opens = count("popup-open");
    act(() => {
      old.open();
      old.close();
    });
    expect(count("popup-open")).toBe(opens);
    expect(count("popup-close")).toBe(1);
    expect(view.getByText("updated: 0")).toBeTruthy();
    closePopup();
    expect(count("popup-close")).toBe(2);
    act(() => configure("popup"));
    const current = callbacks.at(-1);
    view.unmount();
    expect(count("popup-close")).toBe(2);
    const opensAfterUnmount = count("popup-open");
    act(() => {
      current?.open();
      current?.close();
    });
    expect(count("popup-close")).toBe(2);
    expect(count("popup-open")).toBe(opensAfterUnmount);
  }
);
