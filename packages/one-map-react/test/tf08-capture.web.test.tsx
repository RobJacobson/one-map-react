import { act, render } from "@testing-library/react";
import {
  createRef,
  forwardRef,
  type ReactNode,
  useImperativeHandle,
} from "react";
import { describe, expect, vi, test } from "vite-plus/test";

import type {
  WebMapHandle,
  WebWrapper,
} from "../src/adapters/web/contracts.js";
import { createWebMap } from "../src/adapters/web/map.js";
import type { MapRef } from "../src/contracts/camera-types.js";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=";
const camera = { longitude: 1, latitude: 2, zoom: 3, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };
const fixture = (backend: "mapbox-web" | "maplibre-web", preserved = true) => {
  const events = new Map<string, Set<() => void>>();
  let props: Record<string, unknown> = {};
  const canvas = {
    width: 30,
    height: 40,
    getContext: () => ({
      getContextAttributes: () => ({ preserveDrawingBuffer: preserved }),
    }),
    toDataURL: vi.fn(() => `data:image/png;base64,${png}`),
  };
  const renderer = {
    on: (type: string, callback: () => void) => {
      const listeners = events.get(type) ?? new Set();
      listeners.add(callback);
      events.set(type, listeners);
    },
    off: (type: string, callback: () => void) => {
      events.get(type)?.delete(callback);
    },
    getCanvas: () => canvas,
    isStyleLoaded: () => true,
  };
  const handle = { getMap: () => renderer } as unknown as WebMapHandle;
  const WrapperMap = forwardRef<WebMapHandle, { children?: ReactNode }>(
    (value, ref) => {
      // eslint-disable-next-line react/globals -- Test-only readback captures the mocked render for assertions and event dispatch.
      props = value;
      useImperativeHandle(ref, () => handle, []);
      return <div>{value.children}</div>;
    }
  );
  const MapComponent = createWebMap({
    backend,
    Map: WrapperMap,
  } as unknown as WebWrapper<typeof backend>);
  return {
    MapComponent,
    canvas,
    events,
    props: () => props,
    frame: () => {
      for (const listener of events.get("render") ?? []) listener();
    },
  };
};

describe("TF08 browser capture delegation", () => {
  test.each(["mapbox-web", "maplibre-web"] as const)(
    "%s configures the drawing buffer and waits for a real wrapper frame",
    async (backend) => {
      const selected = fixture(backend);
      const ref = createRef<MapRef>();
      const view = render(
        <selected.MapComponent
          ref={ref}
          mapStyle={style}
          initialViewState={camera}
          captureEnabled
        />
      );
      expect(selected.props()).toMatchObject(
        backend === "mapbox-web"
          ? { preserveDrawingBuffer: true }
          : { canvasContextAttributes: { preserveDrawingBuffer: true } }
      );
      const result = ref.current?.capture({
        output: "data-url",
        scope: "renderer",
      });
      expect(selected.canvas.toDataURL).not.toHaveBeenCalled();
      view.rerender(
        <selected.MapComponent
          ref={ref}
          mapStyle={style}
          initialViewState={camera}
          captureEnabled
          onMove={() => {}}
        />
      );
      act(selected.frame);
      await expect(result).resolves.toMatchObject({
        scope: "renderer",
        uri: `data:image/png;base64,${png}`,
      });
      view.unmount();
      expect(selected.events.get("render")?.size).toBe(0);
    }
  );
  test("a retained incompatible context rejects instead of claiming buffer reconfiguration", async () => {
    const selected = fixture("mapbox-web", false);
    const ref = createRef<MapRef>();
    render(
      <selected.MapComponent
        ref={ref}
        mapStyle={style}
        initialViewState={camera}
        captureEnabled
        reuseMaps
      />
    );
    await expect(
      ref.current?.capture({ output: "data-url", scope: "backend" })
    ).rejects.toThrow("fresh capture-enabled map");
    expect(selected.canvas.toDataURL).not.toHaveBeenCalled();
  });
  test("map errors reject captures that are waiting for a frame", async () => {
    const selected = fixture("mapbox-web");
    const ref = createRef<MapRef>();
    render(
      <selected.MapComponent
        ref={ref}
        mapStyle={style}
        initialViewState={camera}
        captureEnabled
      />
    );
    const result = ref.current?.capture({
      output: "data-url",
      scope: "backend",
    });
    const error = new Error("renderer failure");
    const rejected = expect(result).rejects.toBe(error);
    (selected.props().onError as (event: { error: Error }) => void)({ error });
    await rejected;
  });
});
