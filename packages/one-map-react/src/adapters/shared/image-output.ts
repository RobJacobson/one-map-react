import type {
  CaptureOptions,
  ImageOutput,
  MapImage,
  StaticMapImageOptions,
} from "../../contracts/capture-types.js";
import { assertBounds, lngLatFromWrapper } from "./wrapper-values.js";

/** Rejects invalid image/deadline options before SDK work starts. */
export const imageDeadline = (timeoutMs = 15000): number => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("Image timeout must be finite and positive.");
  return timeoutMs;
};

/** Validates current-map requests without silently weakening scope. */
export const validateCapture = (options: CaptureOptions): void => {
  if (!options || !["backend", "renderer"].includes(options.scope))
    throw new Error("Capture requires an explicit backend or renderer scope.");
  validateOutput(options.output);
  imageDeadline(options.timeoutMs);
};

/** Validates independent style/camera inputs, including legitimate zero zoom. */
export const validateStaticImage = (options: StaticMapImageOptions): void => {
  validateOutput(options.output);
  imageDeadline(options.timeoutMs);
  if (typeof options.mapStyle !== "string" || !options.mapStyle.trim())
    throw new Error("A static image requires a style URL.");
  for (const value of [options.width, options.height]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error("Image dimensions must be positive integer pixels.");
  }
  if (options.bounds !== undefined) {
    if (
      [options.center, options.zoom, options.pitch, options.bearing].some(
        (value) => value !== undefined
      )
    )
      throw new Error(
        "Snapshot bounds cannot be combined with a center camera."
      );
    assertBounds(options.bounds);
  } else {
    lngLatFromWrapper(options.center);
    for (const value of [
      options.zoom,
      options.bearing ?? 0,
      options.pitch ?? 0,
    ]) {
      if (!Number.isFinite(value))
        throw new Error("Snapshot camera fields must be finite.");
    }
  }
};

/** Validates PNG output; a nonempty string alone does not establish an image. */
export const normalizeImage = (
  value: unknown,
  output: ImageOutput
): MapImage => {
  validateOutput(output);
  if (typeof value !== "string" || !value.trim())
    throw new Error("Image renderer returned no output.");
  if (output === "file") {
    // MapLibre React Native 11.5.0 iOS returns a path for both map and independent
    // images. Escape filename segments once; existing Android file URIs stay intact.
    const uri = value.startsWith("/")
      ? `file://${value.split("/").map(encodeURIComponent).join("/")}`
      : value;
    if (!/^file:\/\/.+/.test(uri))
      throw new Error("Image renderer returned an invalid temporary file URI.");
    return { output, mimeType: "image/png", uri };
  }
  const payload = value.startsWith("data:")
    ? value.replace(/^data:image\/png;base64,/, "")
    : value;
  // PNG signature, encoded as base64. Reject data URLs of other MIME types,
  // empty images, and malformed base64 instead of reporting capture success.
  if (
    !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(payload) ||
    payload.length % 4 !== 0
  )
    throw new Error("Image renderer returned invalid PNG data.");
  pngDimensions(payload);
  return {
    output,
    mimeType: "image/png",
    uri: `data:image/png;base64,${payload}`,
  };
};

/** Reads PNG header dimensions without depending on Node Buffer or browser atob. */
export const pngDimensions = (
  payload: string
): { width: number; height: number } => {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const byte = (offset: number): number => {
    const bit = offset * 8;
    const index = Math.floor(bit / 6);
    const shift = bit % 6;
    return (
      (((alphabet.indexOf(payload[index]) << 6) |
        alphabet.indexOf(payload[index + 1])) >>
        (4 - shift)) &
      255
    );
  };
  const length =
    (payload.length / 4) * 3 -
    (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
  if (
    length < 45 ||
    [73, 72, 68, 82].some((value, index) => byte(index + 12) !== value) ||
    [73, 69, 78, 68].some((value, index) => byte(length - 8 + index) !== value)
  )
    throw new Error("Image renderer returned a truncated PNG.");
  const dimension = (offset: number): number =>
    byte(offset) * 16777216 +
    byte(offset + 1) * 65536 +
    byte(offset + 2) * 256 +
    byte(offset + 3);
  const width = dimension(16);
  const height = dimension(20);
  if (!width || !height)
    throw new Error("Image renderer returned empty PNG dimensions.");
  return { width, height };
};

/** Bounded caller wait; this does not claim cancellation of the native SDK. */
export const withImageDeadline = async <T>(
  operation: Promise<T>,
  timeoutMs?: number
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Image operation timed out.")),
          imageDeadline(timeoutMs)
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const validateOutput = (output: ImageOutput): void => {
  if (output !== "data-url" && output !== "file")
    throw new Error("Image output must be data-url or file.");
};

/** Checks independent-image output dimensions as well as PNG encoding. */
export const normalizeStaticImage = (
  value: unknown,
  options: StaticMapImageOptions
): MapImage => {
  const image = normalizeImage(value, options.output);
  if (image.output === "data-url") {
    const size = pngDimensions(
      image.uri.slice("data:image/png;base64,".length)
    );
    if (size.width !== options.width || size.height !== options.height)
      throw new Error(
        "Snapshot output dimensions do not match requested PNG pixels. Check the pinned wrapper patch."
      );
  }
  return image;
};
