import type { MapRef } from "one-map-react";
import { describe, expect, it, vi } from "vite-plus/test";

import { cameraMatches, initialCamera, readCamera } from "../src/camera.js";
import { publicMapboxToken } from "../src/public-token.js";

describe("shared example camera", () => {
  it("keeps Mapbox Native orientation from movement events without calling unsupported getters", async () => {
    const getBearing = vi.fn().mockRejectedValue(new Error("unsupported"));
    const getPitch = vi.fn().mockRejectedValue(new Error("unsupported"));
    const map = {
      getCenter: async () => [-122.3, 47.7],
      getZoom: async () => 13,
      getBearing,
      getPitch,
    } as unknown as MapRef;
    expect(
      await readCamera(map, "mapbox-native", {
        ...initialCamera,
        bearing: 35,
        pitch: 40,
      })
    ).toEqual({
      longitude: -122.3,
      latitude: 47.7,
      zoom: 13,
      bearing: 35,
      pitch: 40,
    });
    expect(getBearing).not.toHaveBeenCalled();
    expect(getPitch).not.toHaveBeenCalled();
  });

  it("compares wrapped longitudes and bearings without accepting a different view", () => {
    expect(
      cameraMatches(
        {
          ...initialCamera,
          longitude: initialCamera.longitude + 360,
          bearing: 360,
        },
        initialCamera
      )
    ).toBe(true);
    expect(cameraMatches({ ...initialCamera, zoom: 12 }, initialCamera)).toBe(
      false
    );
  });

  it("rejects invalid public camera readback", async () => {
    const map = {
      getCenter: async () => [NaN, 47],
      getZoom: async () => 11,
    } as unknown as MapRef;
    await expect(
      readCamera(map, "mapbox-native", initialCamera)
    ).rejects.toThrow("invalid camera");
  });
});

describe("public Mapbox configuration", () => {
  it("works without a token and trims a public token", () => {
    expect(publicMapboxToken(undefined)).toBe("");
    expect(publicMapboxToken("  pk.public  ")).toBe("pk.public");
  });

  it("rejects secret tokens without including their value in diagnostics", () => {
    expect(() => publicMapboxToken("sk.private-value")).toThrow(
      "Configure a public Mapbox token beginning with pk."
    );
  });
});
