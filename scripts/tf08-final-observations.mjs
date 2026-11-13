import assert from "node:assert/strict";

/** Counts distinct fixture pixels without requiring identical color profiles. */
export const observeCoveragePixels = ({ data }) => {
  const result = { green: 0, blue: 0, yellow: 0, bright: 0 };
  for (let offset = 0; offset < data.length; offset += 4) {
    const [r, g, b, a] = data.subarray(offset, offset + 4);
    if (a < 200) continue;
    if (g > 200 && g > r * 2.5 && g > b * 2.5) result.green += 1;
    if (r < 100 && g > 65 && g < 200 && b > 190) result.blue += 1;
    if (r > 200 && g > 200 && b < 90) result.yellow += 1;
    if (r > 180 && g > 180 && b > 180) result.bright += 1;
  }
  return result;
};

/**
 * Counts native map pixels using the host's measured window frame.
 * @param image - Decoded physical screenshot pixels.
 * @param device - Actual pixel scale and logical map-host frame.
 * @returns Coverage counts excluding the OS status bar and application header.
 */
export const observeNativeCoveragePixels = (image, device) => {
  assert(device?.mapFrame && Number.isFinite(device.scale) && device.scale > 0);
  const frame = device.mapFrame;
  const logical = [frame.x, frame.y, frame.width, frame.height];
  assert(
    logical.every(Number.isFinite),
    "Invalid native viewport measurement."
  );
  const [x, y, width, height] = logical.map((value) =>
    Math.round(value * device.scale)
  );
  assert(
    [x, y, width, height].every(Number.isInteger) &&
      x >= 0 &&
      y >= 0 &&
      width > 0 &&
      height > 0 &&
      x + width <= image.width &&
      y + height <= image.height,
    "Measured native viewport is outside the screenshot."
  );
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const offset = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(offset, offset + width * 4), row * width * 4);
  }
  return observeCoveragePixels({ data });
};

/** Inclusion is observed only after independently proving the content is visible. */
export const captureInclusion = (baseline, live, exported, color) => {
  const liveDelta = live[color] - baseline.live[color];
  const exportDelta = exported[color] - baseline.exported[color];
  assert(
    liveDelta > 60,
    `The ${color} test content was not established on screen: ${liveDelta}.`
  );
  return { liveDelta, exportDelta, included: exportDelta > 60 };
};
