import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import { act, fireEvent, render } from "@testing-library/react";
import { type Context, Suspense, startTransition, use, useState } from "react";
import type { Marker as MapboxMarker } from "react-map-gl/mapbox";
import { expect, test, vi } from "vite-plus/test";

import type { WebWrapper } from "../src/adapters/web/contracts.js";
import { createWebUi } from "../src/adapters/web/ui.js";

// Real wrapper source uses a fake SDK and map context; no renderer starts.
const sdk = vi.hoisted(() => {
  class Marker {
    static latest: Marker;
    readonly element = document.createElement("div");
    readonly events = new Map<string, (event: object) => void>();
    coordinate = [0, 0];
    constructor() {
      Marker.latest = this;
    }
    getElement = () => this.element;
    setLngLat = (coordinate: number[]) => {
      this.coordinate = coordinate;
      return this;
    };
    getLngLat = () => ({ lng: this.coordinate[0], lat: this.coordinate[1] });
    getOffset = () => ({ x: 0, y: 0 });
    isDraggable = () => false;
    getRotation = () => 0;
    getRotationAlignment = () => "auto";
    getPitchAlignment = () => "auto";
    getPopup = () => null;
    on = (name: string, callback: (event: object) => void) => {
      this.events.set(name, callback);
      return this;
    };
    addTo = () => this;
    remove = () => this.element.remove();
  }
  return { Marker };
});

const Suspend = ({ pending }: { pending: boolean }) => {
  if (pending) use(new Promise<void>(() => {}));
  return null;
};

test.each(["mapbox", "maplibre"] as const)(
  "%s wrapper exposes render-time callbacks; the facade retains the committed handler",
  async (engine) => {
    const require = createRequire(import.meta.url);
    const wrapperRequire = createRequire(
      require.resolve(`react-map-gl/${engine}`)
    );
    const source = resolve(
      dirname(wrapperRequire.resolve(`@vis.gl/react-${engine}`)),
      "../src/components"
    );
    const { Marker: WrapperMarker } = (await import(
      /* @vite-ignore */ `${source}/marker.ts`
    )) as { Marker: typeof MapboxMarker };
    const context = { map: { getMap: () => ({}) }, mapLib: sdk };
    const { MapContext } = (await import(
      /* @vite-ignore */ `${source}/map.tsx`
    )) as { MapContext: Context<typeof context> };
    const { Marker } = createWebUi({
      Marker: WrapperMarker,
    } as unknown as WebWrapper<"mapbox-web">);
    for (const guarded of [false, true]) {
      const committed = vi.fn();
      const pending = vi.fn();
      const Harness = () => {
        const [suspended, setSuspended] = useState(false);
        const Implementation = guarded ? Marker : WrapperMarker;
        return (
          <>
            <button
              type="button"
              onClick={() => startTransition(() => setSuspended(true))}
            >
              Suspend
            </button>
            <Suspense fallback={null}>
              <MapContext.Provider value={context}>
                <Implementation
                  longitude={1}
                  latitude={2}
                  onDrag={suspended ? pending : committed}
                />
                <Suspend pending={suspended} />
              </MapContext.Provider>
            </Suspense>
          </>
        );
      };
      const mounted = render(<Harness />);
      await act(async () => fireEvent.click(mounted.getByRole("button")));
      act(() => sdk.Marker.latest.events.get("drag")?.({}));
      expect(committed).toHaveBeenCalledTimes(guarded ? 1 : 0);
      expect(pending).toHaveBeenCalledTimes(guarded ? 0 : 1);
      mounted.unmount();
    }
  }
);
