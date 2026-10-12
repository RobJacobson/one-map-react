/**
 * A style image loaded from a remote URL.
 */
export interface UrlImage {
  /** HTTP(S) URL of the image. */
  readonly url: string;
  /**
   * Register the image as a signed distance field icon, tinted by
   * `icon-color` instead of drawn directly.
   */
  readonly sdf?: boolean;
}

/**
 * One registered image: a URL string or a {@link UrlImage} with options.
 *
 * Bundled native asset handles are host-specific and remain named native
 * extension work; URL entries are the portable core.
 */
export type ImageEntry = string | UrlImage;

/**
 * Props for the shared {@link Images} component.
 */
export interface ImagesProps {
  /**
   * Images registered on the enclosing map's style, keyed by the name symbol
   * layers reference in `icon-image` and pattern properties. Entries may
   * change between renders; removed entries are unregistered.
   */
  readonly images: Readonly<Record<string, ImageEntry>>;
}
