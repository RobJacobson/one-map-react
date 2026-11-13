import { act, render } from "@testing-library/react";
import type { Adapter } from "one-map-react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { NativeTf08Screen } from "../src/scenarios/native-tf08-screen.js";

vi.mock("one-map-react", () => ({
  MapSetup: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../src/scenarios/tf08-acceptance-scene.js", () => ({
  Tf08AcceptanceScene: () => null,
}));
vi.mock("react-native", async () => {
  const react = await import("react");
  const View = ({ children }: { children?: ReactNode }) =>
    react.createElement("div", {}, children);
  return { View, SafeAreaView: View, Text: View, Platform: { OS: "android" } };
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each([false, true])(
  "a fetched command executes only while its screen is active (retired=%s)",
  async (retired) => {
    const operation = vi.fn(async () => "completed");
    let resolveRequest: (value: unknown) => void = () => {};
    const request = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") return { ok: true };
      return { json: () => request };
    });
    vi.stubGlobal("fetch", fetchMock);
    // This transport regression only needs the adapter's environment identity.
    const adapter = { backend: "mapbox-native" } as Adapter;
    const mounted = render(
      <NativeTf08Screen
        adapter={adapter}
        requestLocationPermission={async () => undefined}
        getCurrentPosition={async () => ({ lngLat: [0, 0] })}
        offlineOperations={{ clear: operation }}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (retired) mounted.unmount();
    await act(async () => {
      resolveRequest({
        id: "request-1",
        environment: "mapbox-android",
        action: "named-offline",
        value: { operation: "clear" },
      });
    });
    if (retired) {
      expect(operation).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } else {
      expect(operation).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8798/result",
        expect.objectContaining({ method: "POST" })
      );
      mounted.unmount();
    }
  }
);
