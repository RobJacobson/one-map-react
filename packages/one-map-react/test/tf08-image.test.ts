import { afterEach, describe, expect, vi, test } from "vite-plus/test";

import {
  normalizeImage,
  validateStaticImage,
  withImageDeadline,
} from "../src/adapters/shared/image-output.js";
import type { StaticMapImageOptions } from "../src/contracts/capture-types.js";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=";
afterEach(() => {
  vi.useRealTimers();
});

describe("TF08 map images", () => {
  test("normalizes exactly one PNG data URL prefix and rejects invalid/empty output", () => {
    const image = normalizeImage(png, "data-url");
    expect(image.uri).toBe(`data:image/png;base64,${png}`);
    expect(normalizeImage(image.uri, "data-url")).toEqual(image);
    for (const value of ["", "fake", `data:image/jpeg;base64,${png}`, null])
      expect(() => normalizeImage(value, "data-url")).toThrow();
    expect(normalizeImage("file:///tmp/map.png", "file").output).toBe("file");
    expect(() =>
      normalizeImage("https://example.test/map.png", "file")
    ).toThrow();
  });
  test("snapshot input preserves zero zoom and rejects ambiguous camera/dimensions", () => {
    const value: StaticMapImageOptions = {
      mapStyle: "https://example.test/style",
      width: 32,
      height: 64,
      output: "data-url",
      center: [0, 0],
      zoom: 0,
    };
    expect(() => validateStaticImage(value)).not.toThrow();
    expect(() => validateStaticImage({ ...value, width: 0 })).toThrow(
      "dimensions"
    );
    expect(() =>
      validateStaticImage({
        ...value,
        bounds: [
          [0, 0],
          [1, 1],
        ],
      } as unknown as StaticMapImageOptions)
    ).toThrow("combined");
  });
  test("independent-image deadline bounds a stalled SDK without claiming cancellation", async () => {
    vi.useFakeTimers();
    const result = withImageDeadline(new Promise(() => {}), 20);
    const rejected = expect(result).rejects.toThrow("timed out");
    vi.advanceTimersByTime(20);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
