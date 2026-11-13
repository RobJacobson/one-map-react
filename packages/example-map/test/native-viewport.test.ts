import { describe, expect, it } from "vite-plus/test";

import { measureNativeViewport } from "../src/scenarios/native-viewport.js";

describe("physical acceptance input calibration", () => {
  it("reads actual native host bounds", async () => {
    await expect(
      measureNativeViewport({
        measureInWindow: (done) => done(12, 48, 320, 400),
      })
    ).resolves.toEqual([12, 48, 320, 400]);
  });
  it("rejects detached hosts", async () => {
    await expect(measureNativeViewport(null)).rejects.toThrow("detached");
  });
  it.each([
    [0, 0, 0, 400],
    [-1, 0, 320, 400],
    [0, 0, 320, -1],
    [0, Number.NaN, 320, 400],
  ])("rejects invalid bounds %s,%s,%s,%s", async (x, y, width, height) => {
    await expect(
      measureNativeViewport({
        measureInWindow: (done) => done(x, y, width, height),
      })
    ).rejects.toThrow("invalid");
  });
});
