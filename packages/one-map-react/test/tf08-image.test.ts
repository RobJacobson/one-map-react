import { afterEach, describe, expect, vi, test } from "vite-plus/test";

import {
  normalizeImage,
  validateStaticImage,
  withImageDeadline,
} from "../src/adapters/shared/image-output.js";
import { MapCaptureGate } from "../src/adapters/shared/map-capture.js";
import type {
  CaptureOptions,
  StaticMapImageOptions,
} from "../src/contracts/capture-types.js";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=";
const options: CaptureOptions = {
  output: "data-url",
  scope: "backend",
  timeoutMs: 50,
};
afterEach(() => {
  vi.useRealTimers();
});

describe("TF08 map images", () => {
  test("current-map file capture adapts a native absolute path and escapes filename delimiters", async () => {
    const gate = new MapCaptureGate();
    gate.activate(true);
    gate.layout(32, 64);
    gate.frame();
    await expect(
      gate.run(
        { ...options, output: "file" },
        async () => "/tmp/map image?#%.png"
      )
    ).resolves.toMatchObject({
      output: "file",
      uri: "file:///tmp/map%20image%3F%23%25.png",
    });
    gate.dispose();
  });
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
  test("capture waits for both an observed frame and measured size", async () => {
    const gate = new MapCaptureGate();
    gate.activate(true);
    const snapshot = vi.fn<() => Promise<string>>().mockResolvedValue(png);
    const result = gate.run(options, snapshot);
    gate.frame();
    await Promise.resolve();
    expect(snapshot).not.toHaveBeenCalled();
    gate.layout(30, 40);
    await expect(result).resolves.toMatchObject({
      scope: "backend",
      mimeType: "image/png",
    });
    expect(snapshot).toHaveBeenCalledTimes(1);
    gate.dispose();
  });
  test("logical detachment rejects before readiness and suppresses a late image", async () => {
    const gate = new MapCaptureGate();
    gate.activate(true);
    const waiting = gate.run(options, async () => png);
    const rejected = expect(waiting).rejects.toThrow("detached");
    gate.dispose();
    await rejected;
    gate.activate(true);
    gate.layout(30, 40);
    gate.frame();
    let complete: (value: string) => void = () => {};
    const rendering = gate.run(
      options,
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    await Promise.resolve();
    await Promise.resolve();
    const late = expect(rendering).rejects.toThrow("detached");
    gate.dispose();
    complete(png);
    await late;
  });
  test("capture disabled, missing readiness, and backend export errors stay failures", async () => {
    vi.useFakeTimers();
    const gate = new MapCaptureGate();
    gate.activate(false);
    await expect(gate.run(options, async () => png)).rejects.toThrow(
      "captureEnabled"
    );
    gate.activate(true);
    const timed = gate.run(options, async () => png);
    const rejected = expect(timed).rejects.toThrow("timed out");
    vi.advanceTimersByTime(50);
    await rejected;
    gate.layout(30, 40);
    gate.frame();
    await expect(
      gate.run(options, async () => {
        throw new Error("SecurityError");
      })
    ).rejects.toThrow("SecurityError");
    gate.dispose();
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
