import { describe, expect, it, vi } from "vite-plus/test";

import { cameraMatches, initialCamera, readCamera } from "../src/camera.js";
import { publicMapboxToken } from "../src/public-token.js";

describe("shared example camera", () => {
  it("keeps Mapbox Native orientation from movement events without calling unsupported getters", async () => {
    const getBearing = vi.fn().mockRejectedValue(new Error("unsupported"));
    const getPitch = vi.fn().mockRejectedValue(new Error("unsupported"));
    const map = {
      getCenter: async () => ({ lng: -122.3, lat: 47.7 }),
      getZoom: async () => 13,
      getBearing,
      getPitch,
      jumpTo: () => {},
    };
    expect(
      await readCamera(map, true, {
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
      getCenter: async () => ({ lng: NaN, lat: 47 }),
      getZoom: () => 11,
      getBearing: () => 0,
      getPitch: () => 0,
      jumpTo: () => {},
    };
    await expect(readCamera(map, true, initialCamera)).rejects.toThrow(
      "invalid camera"
    );
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
