import type { Bounds, LngLat } from "./camera-types.js";

/** PNG output selected explicitly by the caller. */
export type ImageOutput = "data-url" | "file";

/** Available PNG image; file URIs refer to OS-managed temporary storage. */
export interface MapImage {
  /** Distinguishes a PNG data URL from a temporary file URI. */
  readonly output: ImageOutput;
  /** Encoding of the returned image. */
  readonly mimeType: "image/png";
  /** Validated PNG data URL or native file URI. */
  readonly uri: string;
}

/** Independent snapshot inputs; mounted map resources are not inherited. */
export type StaticMapImageOptions = {
  /** Style URL; use named SDK facilities for backend style-object support. */
  readonly mapStyle: string;
  /** Requested PNG width in pixels. */
  readonly width: number;
  /** Requested PNG height in pixels. */
  readonly height: number;
  /** PNG data URL or native temporary file. */
  readonly output: ImageOutput;
  /** Finite positive deadline in milliseconds; default 15000. */
  readonly timeoutMs?: number;
} & (
  | {
      /** Camera center, in longitude/latitude degrees. */
      readonly center: LngLat;
      /** Camera zoom, including zero. */
      readonly zoom: number;
      /** Bearing in degrees; default zero. */
      readonly bearing?: number;
      /** Pitch in degrees; default zero. */
      readonly pitch?: number;
      /** Bounds cannot be combined with a center camera. */
      readonly bounds?: never;
    }
  | {
      /** Southwest/northeast geographic corners. */
      readonly bounds: Bounds;
      /** Center camera cannot be combined with bounds. */
      readonly center?: never;
      /** Zoom cannot be combined with bounds. */
      readonly zoom?: never;
      /** Bearing cannot be combined with bounds. */
      readonly bearing?: never;
      /** Pitch cannot be combined with bounds. */
      readonly pitch?: never;
    }
);

/** Independent native rendering without a mounted map. */
export interface StaticMapImageService {
  /**
   * Renders the supplied style and camera. Deadline does not cancel the SDK.
   * @param options - Style, camera, dimensions, and output.
   * @returns PNG output after rendering completes.
   */
  create(options: StaticMapImageOptions): Promise<MapImage>;
}
