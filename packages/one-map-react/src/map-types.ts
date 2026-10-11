import type { ReactNode } from "react";

import type { ViewState } from "./camera-types.js";
import type { MapErrorEvent, MoveEvent } from "./event-types.js";
import type { MapStyle } from "./style-types.js";

/**
 * Drawing context forwarded to a web map's `gl` option.
 *
 * The fields are the ones react-map-gl installs at construction. This type
 * does not import a browser or Mapbox type. A reused map keeps the context
 * from the construction that created it.
 */
export interface ExternalDrawingContext {
  /** Canvas that owns the context. */
  readonly canvas: object;
  /** Width of the drawing buffer, in pixels. */
  readonly drawingBufferWidth: number;
  /** Height of the drawing buffer, in pixels. */
  readonly drawingBufferHeight: number;
}

/**
 * Host layout for the map container in this example.
 *
 * Web shells pass width and height. Native shells pass `flex`.
 */
export interface MapLayoutStyle {
  /** CSS or layout width. */
  readonly width?: number | string;
  /** CSS or layout height. */
  readonly height?: number | string;
  /** React Native flex grow factor. */
  readonly flex?: number;
}

/**
 * Props for the shared {@link Map} component.
 */
export interface MapProps {
  /** Style URL or a local style document. */
  readonly mapStyle: MapStyle;
  /** Camera applied on first mount only. */
  readonly initialViewState: ViewState;
  /** Host layout for the map container. */
  readonly style?: MapLayoutStyle;
  /**
   * When true, a web remount may adopt a renderer the wrapper kept.
   *
   * Native adapters reject `true` because those wrappers have no reuse
   * facility. Omitted and `false` remount a new native map.
   */
  readonly reuseMaps?: boolean;
  /**
   * Web-only drawing context passed to react-map-gl at construction.
   *
   * Native adapters reject a provided context. Reuse does not move a later
   * context onto a map that was already constructed.
   */
  readonly gl?: ExternalDrawingContext;
  /** Called when the wrapper reports camera movement. */
  readonly onMove?: (event: MoveEvent) => void;
  /**
   * Called when the wrapper reports that the map has loaded.
   *
   * This does not mean every later tile or source has loaded.
   */
  readonly onLoad?: () => void;
  /**
   * Called when the map reports that a style finished loading.
   *
   * Web listens for the map's `style.load` event. If that event already
   * finished and `isStyleLoaded()` is still false, the following map
   * `load` reports this once when the style is loaded. A reused web map
   * can attach after that `load` and still see the style as unloaded;
   * the next `idle` then reports this once. Native uses
   * `onDidFinishLoadingStyle`. This is not react-map-gl `onStyleData`.
   */
  readonly onStyleLoad?: () => void;
  /** Called when the wrapper reports a map error. */
  readonly onError?: (event: MapErrorEvent) => void;
  /**
   * Called when a web map reports a resize.
   *
   * Native adapters do not call this. Native size follows the host `style`.
   */
  readonly onResize?: () => void;
  /** Sources and layers rendered inside the map. */
  readonly children?: ReactNode;
}
