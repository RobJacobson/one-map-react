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
   * Named style images referenced by symbol layers and pattern properties.
   * react-map-gl has no Images component, so web deliberately supplies a small
   * polyfill over renderer image methods. Native adapters delegate to their
   * wrappers. URL/SDF updates and removals
   * affect only the changed entry. Existing web names report a conflict.
   * Reserve distinct names and do not mutate owned entries through raw APIs.
   * Web waits for initial readiness, cancels obsolete loads, and removes its
   * successful registrations on cleanup, including logical unmount with reuse.
   * Download, conflict and registration failures report a credential-safe
   * Map.onError. Style events do not retry failures or replay registrations.
   * Finish Images unmount cleanup before replacing the web style, then mount
   * fresh Images after readiness. A newly keyed Map with reuseMaps=false is an
   * alternative boundary that resets the camera. Keying only Images after
   * onStyleLoad, or hiding Images while changing style in one update, is unsafe.
   * Native wrappers retain their normal restoration and collision behavior.
   */
  readonly images: Readonly<Record<string, ImageEntry>>;
}
