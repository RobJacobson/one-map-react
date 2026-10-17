import type { Bounds, LngLat } from "./camera-types.js";

/** PNG output selected explicitly by the caller. */
export type ImageOutput = "data-url" | "file";

/** Current wrapper view contents or strict renderer-only contents. */
export type CaptureScope = "backend" | "renderer";

/** Current-map capture inputs. */
export interface CaptureOptions {
  /** PNG data URL or native temporary file. Browser file output rejects. */
  readonly output: ImageOutput;
  /** Backend scope preserves documented wrapper inclusion differences. */
  readonly scope: CaptureScope;
  /** Finite positive deadline in milliseconds; default 15000. */
  readonly timeoutMs?: number;
}

/** Available PNG image; file URIs refer to OS-managed temporary storage. */
export interface MapImage {
  /** Distinguishes a PNG data URL from a temporary file URI. */
  readonly output: ImageOutput;
  /** Encoding of the returned image. */
  readonly mimeType: "image/png";
  /** Validated PNG data URL or native file URI. */
  readonly uri: string;
}

/** Image from the attached map, with explicitly requested content scope. */
export interface MapCapture extends MapImage {
  /** Content scope honored by this capture. */
  readonly scope: CaptureScope;
}

/** Independent snapshot inputs; mounted map resources are not inherited. */
export type StaticMapImageOptions = {
  /** Style URL; use named SDK facilities for backend style-object support. */
  readonly mapStyle: string;
  /** Requested PNG width in pixels; must be a positive safe integer. */
  readonly width: number;
  /** Requested PNG height in pixels; must be a positive safe integer. */
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
   * Renders the supplied style and camera.
   *
   * @remarks
   * The deadline bounds the returned promise without cancelling SDK work.
   * This service is independent of mounted maps; their detachment does not
   * cancel the snapshot.
   *
   * @param options - Style, camera, dimensions, and output.
   * @returns PNG output after rendering completes.
   * @throws When style, camera, dimensions, output, or deadline inputs are
   * invalid, the SDK fails or exceeds the deadline, or returned PNG output
   * is malformed or has dimensions different from those requested.
   */
  create(options: StaticMapImageOptions): Promise<MapImage>;
}
