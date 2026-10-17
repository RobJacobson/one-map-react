import { act, renderHook } from "@testing-library/react";
import type { Adapter, MapRef, ViewState } from "one-map-react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { initialCamera } from "../src/camera.js";
import { useExampleMap } from "../src/use-example-map.js";

const adapters = {
  maplibre: { backend: "maplibre-web" } as Adapter,
  mapbox: { backend: "mapbox-web" } as Adapter,
};

const cameraMap = (camera: ViewState = initialCamera): MapRef =>
  ({
    getCenter: vi.fn(async () => [camera.longitude, camera.latitude]),
    getZoom: vi.fn(async () => camera.zoom),
    getBearing: vi.fn(async () => camera.bearing),
    getPitch: vi.fn(async () => camera.pitch),
    jumpTo: vi.fn(async () => undefined),
  }) as unknown as MapRef;

afterEach(() => vi.useRealTimers());

describe("engine handoff", () => {
  it.each(["initial", "switched"] as const)(
    "times out a stalled %s map load and permits retry without reviving the failed attachment",
    async (phase) => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useExampleMap(adapters, true));
      if (phase === "switched") {
        result.current.attachMap(cameraMap());
        await act(async () => result.current.onLoad());
        await act(async () => result.current.selectEngine("mapbox"));
      }
      const map = cameraMap();
      result.current.attachMap(map);
      const lateLoad = result.current.onLoad;

      await act(async () => vi.advanceTimersByTimeAsync(9999));
      expect(result.current.status).toBe(
        phase === "initial" ? "loading" : "switching"
      );
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(result.current.status).toBe("error");
      expect(result.current.error).toContain("retry");
      expect(vi.getTimerCount()).toBe(0);

      await act(async () => lateLoad());
      expect(map.jumpTo).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");

      await act(async () =>
        result.current.selectEngine(result.current.attachment.engine)
      );
      result.current.attachMap(cameraMap());
      await act(async () => result.current.onLoad());
      expect(result.current.status).toBe("ready");
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => vi.advanceTimersByTimeAsync(20000));
      expect(result.current.status).toBe("ready");
    }
  );

  it("releases the loading deadline on StrictMode teardown", () => {
    vi.useFakeTimers();
    const mounted = renderHook(() => useExampleMap(adapters, true), {
      wrapper: StrictMode,
    });
    expect(vi.getTimerCount()).toBe(1);
    mounted.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("requires fresh Mapbox Native orientation observations before declaring restoration complete", async () => {
    vi.useFakeTimers();
    const nativeAdapters = {
      ...adapters,
      mapbox: { backend: "mapbox-native" } as Adapter,
    };
    const { result } = renderHook(() => useExampleMap(nativeAdapters, true));
    const moved = { ...initialCamera, bearing: 45, pitch: 30 };
    result.current.attachMap(cameraMap(moved));
    await act(async () => {
      await result.current.selectEngine("mapbox");
    });
    result.current.attachMap(cameraMap(moved));
    let loading: Promise<void> | undefined;
    await act(async () => {
      loading = result.current.onLoad();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("switching");
    await act(async () => {
      result.current.onMove({ origin: "unknown", viewState: moved });
      await vi.advanceTimersByTimeAsync(50);
      await loading;
    });
    expect(result.current.status).toBe("ready");
  });
  it("starts in Seattle with MapLibre and prevents a missing-token Mapbox switch", async () => {
    const { result } = renderHook(() => useExampleMap(adapters, false));
    await act(async () => {
      await result.current.selectEngine("mapbox");
    });
    expect(result.current.attachment.engine).toBe("maplibre");
    expect(result.current.attachment.camera).toEqual(initialCamera);
    expect(result.current.attachment.generation).toBe(0);
  });

  it("preserves camera readbacks through repeated switches and ignores old callbacks", async () => {
    const { result } = renderHook(() => useExampleMap(adapters, true));
    const moved = {
      ...initialCamera,
      longitude: -122.2,
      zoom: 14,
      bearing: 45,
      pitch: 30,
    };
    result.current.attachMap(cameraMap(moved));
    const old = result.current;
    await act(async () => {
      await result.current.selectEngine("mapbox");
    });
    expect(result.current.attachment.camera).toEqual(moved);
    act(() => {
      old.onMove({ viewState: initialCamera, origin: "unknown" });
      old.onError({ error: new Error("stale") });
    });
    result.current.attachMap(cameraMap(moved));
    await act(async () => {
      await result.current.onLoad();
    });
    expect(result.current.status).toBe("ready");
    await act(async () => {
      await result.current.selectEngine("maplibre");
    });
    expect(result.current.attachment).toEqual({
      engine: "maplibre",
      generation: 2,
      camera: moved,
    });
  });

  it("keeps the current engine and shows safe guidance when camera capture fails", async () => {
    const { result } = renderHook(() => useExampleMap(adapters, true));
    const map = cameraMap();
    vi.mocked(map.getCenter).mockRejectedValue(
      new Error("https://service/?access_token=private")
    );
    result.current.attachMap(map);
    await act(async () => {
      await result.current.selectEngine("mapbox");
    });
    expect(result.current.attachment.engine).toBe("maplibre");
    expect(result.current.status).toBe("error");
    expect(result.current.error).not.toContain("private");
    await act(async () => {
      await result.current.selectEngine("maplibre");
    });
    expect(result.current.attachment.generation).toBe(1);
  });

  it("waits for rendered camera readback rather than command acknowledgement", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useExampleMap(adapters, true));
    const map = cameraMap();
    vi.mocked(map.getZoom).mockResolvedValueOnce(0).mockResolvedValue(11);
    result.current.attachMap(map);
    let loading: Promise<void> | undefined;
    await act(async () => {
      loading = result.current.onLoad();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("loading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      await loading;
    });
    expect(result.current.status).toBe("ready");
  });

  it("reports a camera that never restores without looping forever", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useExampleMap(adapters, true));
    result.current.attachMap(cameraMap({ ...initialCamera, zoom: 0 }));
    await act(async () => {
      const loading = result.current.onLoad();
      await vi.advanceTimersByTimeAsync(10100);
      await loading;
    });
    expect(result.current.status).toBe("error");
  });

  it.each(["jumpTo", "getZoom"] as const)(
    "times out a stalled restoration %s and ignores its late result",
    async (method) => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useExampleMap(adapters, true));
      const map = cameraMap();
      let finish: (zoom: number) => void = () => {};
      const pending = new Promise<number>((resolve) => {
        finish = resolve;
      });
      if (method === "getZoom")
        vi.mocked(map.getZoom).mockReturnValueOnce(pending);
      else
        vi.mocked(map.jumpTo).mockReturnValueOnce(
          pending.then(() => undefined)
        );
      result.current.attachMap(map);
      let loading: Promise<void> | undefined;
      await act(async () => {
        loading = result.current.onLoad();
        await vi.advanceTimersByTimeAsync(9999);
      });
      expect(result.current.status).toBe("loading");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
        await loading;
      });
      expect(result.current.status).toBe("error");
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => finish(11));
      expect(result.current.status).toBe("error");
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => {
        await result.current.selectEngine("maplibre");
      });
      result.current.attachMap(cameraMap());
      await act(async () => {
        await result.current.onLoad();
      });
      expect(result.current.status).toBe("ready");
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("shares one restoration deadline across command dispatch and readback", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useExampleMap(adapters, true));
    const map = cameraMap({ ...initialCamera, zoom: 0 });
    vi.mocked(map.jumpTo).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );
    result.current.attachMap(map);
    await act(async () => {
      const loading = result.current.onLoad();
      await vi.advanceTimersByTimeAsync(10000);
      await loading;
    });
    expect(result.current.status).toBe("error");
  });

  it("times out a stalled switch read and permits retry without a late replacement", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useExampleMap(adapters, true));
    const map = cameraMap();
    result.current.attachMap(map);
    await act(async () => {
      await result.current.onLoad();
    });
    let finish: (zoom: number) => void = () => {};
    vi.mocked(map.getZoom).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    let switching: Promise<void> | undefined;
    await act(async () => {
      switching = result.current.selectEngine("mapbox");
      await vi.advanceTimersByTimeAsync(10000);
      await switching;
    });
    expect(result.current.status).toBe("error");
    expect(result.current.attachment.generation).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      await result.current.selectEngine("mapbox");
      finish(20);
      await switching;
    });
    expect(result.current.attachment).toEqual({
      engine: "mapbox",
      generation: 1,
      camera: initialCamera,
    });
  });

  it("does not replace a map after unmount while capture is pending", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useExampleMap(adapters, true));
    const map = cameraMap();
    let finish: ((zoom: number) => void) | undefined;
    vi.mocked(map.getZoom).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    result.current.attachMap(map);
    let switching: Promise<void> | undefined;
    act(() => {
      switching = result.current.selectEngine("mapbox");
    });
    unmount();
    await act(async () => {
      await switching;
    });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      finish?.(11);
      await switching;
    });
    expect(result.current.attachment.generation).toBe(0);
  });
});
