/** Removes public tokens and authenticated query values from retained diagnostics. */
export const redactWorkspaceDiagnostic = (value) =>
  String(value)
    .replace(/(access_token=)[^&\s"'<>]+/gi, "$1[redacted]")
    .replace(/(?:pk|sk)\.[A-Za-z0-9._-]+/g, "[redacted]");

/** Measures map detail below the application controls, excluding outer ornaments. */
export const mapPixelSummary = (image) => {
  const colors = new Set();
  let samples = 0;
  for (
    let y = Math.floor(image.height * 0.4);
    y < image.height * 0.85;
    y += 4
  ) {
    for (let x = Math.floor(image.width * 0.1); x < image.width * 0.9; x += 4) {
      const offset = (y * image.width + x) * 4;
      const [red, green, blue, alpha] = image.data.subarray(offset, offset + 4);
      if (alpha < 200) continue;
      colors.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
      samples += 1;
    }
  }
  return {
    colors: colors.size,
    samples,
    width: image.width,
    height: image.height,
  };
};

/** Assigns isolated app, browser debugger and fixture ports to either web shell. */
export const workspaceWebPorts = (kind) => {
  if (kind === "vite") return { app: 5175, debugger: 6175, fixture: 9140 };
  if (kind === "expo-web") return { app: 8182, debugger: 6182, fixture: 9240 };
  throw new Error("Choose vite or expo-web.");
};
/** Identifies the React Native web error caused by raw button label children. */
export const hasInvalidTextChildren = (message) =>
  /Unexpected text node:.*cannot be a child of a <View>/.test(message);

/** Validates observed native lifecycle completion rather than a timeout's done marker. */
export const nativeLifecyclePassed = (line) => {
  const fields = Object.fromEntries(
    String(line)
      .split(/\s+/)
      .map((part) => part.split("="))
      .filter((part) => part.length === 2)
  );
  const camera = fields.remount?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  return (
    camera !== null &&
    camera !== undefined &&
    Math.abs(Number(camera[1]) + 122.34) < 0.015 &&
    Math.abs(Number(camera[2]) - 47.61) < 0.015 &&
    Number(fields.loads) >= 2 &&
    Number(fields.styles) >= 1 &&
    Number(fields.errors) >= 1 &&
    fields.phase === "done" &&
    !/timeout/i.test(fields.error ?? "")
  );
};

/**
 * Observes a fixture background in the actual canvas region after style replacement.
 * @param {object} image - Decoded screenshot pixels at device scale one.
 * @param {object} bounds - Measured canvas x, y, width and height.
 * @param {string} hex - Expected six-digit fixture background color.
 * @returns {boolean} Whether the expected paint covers most sampled canvas pixels.
 */
export const fixtureBackgroundVisible = (image, bounds, hex) => {
  if (
    !/^#[0-9a-f]{6}$/i.test(hex) ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.x + bounds.width > image.width + 1 ||
    bounds.y + bounds.height > image.height + 1
  )
    throw new Error("Invalid fixture canvas/color observation.");
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((value) => Number.parseInt(value, 16));
  let hits = 0,
    total = 0;
  for (
    let y = Math.floor(bounds.y + bounds.height * 0.2);
    y < bounds.y + bounds.height * 0.9;
    y += 13
  )
    for (
      let x = Math.floor(bounds.x + bounds.width * 0.1);
      x < bounds.x + bounds.width * 0.9;
      x += 13
    ) {
      const offset = (y * image.width + x) * 4;
      total += 1;
      if (
        image.data[offset + 3] >= 200 &&
        rgb.every(
          (value, index) => Math.abs(image.data[offset + index] - value) <= 3
        )
      )
        hits += 1;
    }
  return total > 0 && hits > total * 0.5;
};

/** Requires the completed SDK render frame to contain the requested hillshade layer state. */
export const webHillshadeSettled = (previousFrame, observed, enabled) =>
  Number.isInteger(previousFrame) &&
  previousFrame >= 0 &&
  Number.isInteger(observed?.renderedFrames) &&
  observed.renderedFrames > previousFrame &&
  observed.shade === enabled &&
  observed.frameShade === enabled;
