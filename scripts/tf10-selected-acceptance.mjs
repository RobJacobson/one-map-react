import assert from "node:assert/strict";

import { modelPixels } from "./tf10-model-fixture.mjs";

/** Verifies supplied light colors on a white extrusion using actual rendered pixels. */
export const runLightColorAcceptance = async ({ action, capture, until }) => {
  const observe = async (color, previousStyleLoads) => {
    await action("light-color", { color });
    let observation;
    await until(async () => {
      const read = await action("light-read");
      const expected = { blue: "#0000ff", green: "#00ff00", white: "#ffffff" }[
        color
      ];
      if (
        !read.enabled ||
        read.color !== expected ||
        (previousStyleLoads !== undefined &&
          read.styleLoads <= previousStyleLoads) ||
        !read.features.some((feature) => Number(feature.id) === 9010)
      )
        return false;
      const image = await capture();
      const pixels = lightPixels(image);
      const minimum = Math.max(
        100,
        Math.floor(image.width * image.height * 0.002)
      );
      assert(
        pixels[color] >= minimum,
        `Light ${color} rendered pixels: ${JSON.stringify(pixels)}`
      );
      if (color !== "blue")
        assert(pixels.blue < minimum / 10, "Old blue light remains rendered");
      if (color !== "green")
        assert(pixels.green < minimum / 10, "Old green light remains rendered");
      observation = {
        pixels,
        styleLoads: read.styleLoads,
        featureIds: read.features.map((feature) => feature.id),
      };
      return true;
    });
    return observation;
  };
  const blue = await observe("blue");
  const green = await observe("green");
  await action("replace-style");
  const replaced = await observe("green", green.styleLoads);
  const white = await observe("white");
  return { blue, green, replaced, white };
};

/** Verifies real model URI, scale, rotation, opacity and removal by captured output. */
export const runModelAcceptance = async ({ action, capture, until }) => {
  await until(async () => {
    const read = await action("read");
    return (
      read.loads > 0 &&
      Math.abs(read.center[0]) < 0.001 &&
      Math.abs(read.center[1]) < 0.001 &&
      Math.abs(read.zoom - 18) < 0.1
    );
  });
  const observe = async (preset, color, predicate) => {
    await action("model", { preset });
    let pixels;
    await until(async () => {
      if ((await action("read")).preset !== preset) return false;
      // The model is centered; exclude SDK ornaments and tolerate capture color-space conversion.
      pixels = modelPixels(await capture(), color, 0.2);
      assert(
        predicate(pixels),
        `Model ${preset} pixel observation: ${JSON.stringify(pixels)}`
      );
      return true;
    });
    return pixels;
  };
  const hidden = await observe(
    "hidden",
    "magenta",
    (pixels) => pixels.count === 0
  );
  const visible = await observe(
    "visible",
    "magenta",
    (pixels) => pixels.count > 100 && pixels.width > 5 && pixels.height > 5
  );
  const scaled = await observe(
    "scaled",
    "magenta",
    (pixels) =>
      pixels.count > visible.count * 2.5 &&
      pixels.width > visible.width * 1.5 &&
      pixels.height > visible.height * 1.5
  );
  assert(
    Math.max(scaled.width, scaled.height) /
      Math.min(scaled.width, scaled.height) >
      1.5,
    "Model must be asymmetric to prove rotation."
  );
  const rotated = await observe(
    "rotated",
    "magenta",
    (pixels) =>
      Math.abs(pixels.width / scaled.height - 1) < 0.25 &&
      Math.abs(pixels.height / scaled.width - 1) < 0.25
  );
  const transparent = await observe(
    "transparent",
    "magenta",
    (pixels) => pixels.count < visible.count * 0.05
  );
  const replaced = await observe(
    "replaced",
    "cyan",
    (pixels) => pixels.count > visible.count * 2.5
  );
  assert.equal(
    modelPixels(await capture(), "magenta", 0.2).count,
    0,
    "Old model URI remains rendered."
  );
  const removed = await observe(
    "hidden",
    "cyan",
    (pixels) => pixels.count === 0
  );
  return { hidden, visible, scaled, rotated, transparent, replaced, removed };
};

/** Checks initial style state, style replacement, updates and null reset with rendered colors. */
export const runGlobalStateAcceptance = async ({ action, capture, until }) => {
  const observe = async (expectedColor, initial) => {
    let read;
    await until(async () => {
      read = await action("read");
      if (!read.loads || read.globalState.color !== expectedColor) return false;
      if (initial && read.globalState.initial !== 6014) return false;
      return (
        modelPixels(
          await capture(),
          expectedColor === "#ff00ff" ? "magenta" : "cyan"
        ).count >= 10000
      );
    });
    return {
      globalState: read.globalState,
      styleName: read.style.name,
      styleLoads: read.styleLoads,
    };
  };
  const initialStyle = await observe("#ff00ff", true);
  await action("set", { color: "#00ffff" });
  const updated = await observe("#00ffff");
  await action("replace-style");
  await until(
    async () => (await action("read")).style.name === "global-state-1"
  );
  await action("set", { color: "#ff00ff" });
  const afterReplacement = await observe("#ff00ff");
  await action("set", { color: null });
  const reset = await observe("#00ffff");
  return { initialStyle, updated, afterReplacement, reset };
};

/** Counts dominant light colors in the central map area, excluding SDK ornaments. */
const lightPixels = (image) => {
  const counts = { blue: 0, green: 0, white: 0 };
  for (let y = Math.floor(image.height * 0.2); y < image.height * 0.8; y += 1) {
    for (let x = Math.floor(image.width * 0.2); x < image.width * 0.8; x += 1) {
      const index = (y * image.width + x) * 4;
      const [red, green, blue] = image.data.subarray(index, index + 3);
      if (blue > 90 && blue - Math.max(red, green) > 70) counts.blue += 1;
      if (green > 90 && green - Math.max(red, blue) > 70) counts.green += 1;
      if (
        Math.min(red, green, blue) > 150 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) < 30
      )
        counts.white += 1;
    }
  }
  return counts;
};
