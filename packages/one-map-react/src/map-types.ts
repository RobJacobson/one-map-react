import type { ReactNode } from "react";

import type { Bounds, Padding, ViewState } from "./camera-types.js";
import type { ClickEvent, MapErrorEvent, MoveEvent } from "./event-types.js";
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
  /**
   * Camera applied on first mount only.
   *
   * A later change does not move the camera. Use `viewState` or a command.
   */
  readonly initialViewState: ViewState;
  /**
   * Camera owned by React.
   *
   * When this is set, it replaces later changes from `initialViewState`.
   * Web adapters forward it to react-map-gl. Native adapters write it onto
   * the camera child. That write is not the strict `controlledCamera`
   * capability: a rejected native move is unverified until a renderer check
   * shows the displayed camera return to this value.
   */
  readonly viewState?: ViewState;
  /** Lowest zoom the camera may use. */
  readonly minZoom?: number;
  /** Highest zoom the camera may use. */
  readonly maxZoom?: number;
  /**
   * Limit on where the camera center may pan.
   *
   * The order is southwest then northeast. A west value greater than east
   * crosses the antimeridian.
   */
  readonly maxBounds?: Bounds;
  /** Padding in logical map-view units. Missing sides become zero. */
  readonly padding?: Padding;
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
  /**
   * Turns interaction on or off.
   *
   * On native maps, `false` forces the portable gesture flags off. Omitted
   * leaves each flag to the wrapper unless that flag is set.
   */
  readonly interactive?: boolean;
  /** Enables one-finger panning. RNMapbox receives this as `scrollEnabled`. */
  readonly dragPan?: boolean;
  /** Enables pinch zoom. */
  readonly touchZoom?: boolean;
  /**
   * Enables rotation from the pinch handler.
   *
   * Web pinch zoom and rotation are one handler. When zoom stays on and this
   * is `false`, the adapter leaves zoom enabled and disables rotation on that
   * handler.
   */
  readonly touchRotate?: boolean;
  /** Enables the pitch gesture. */
  readonly touchPitch?: boolean;
  /**
   * Enables a double-tap zoom.
   *
   * MapLibre also receives this as `doubleTapHoldZoom`. iOS keeps that
   * recognizer independent of pinch zoom. Android SDK 13.6.1 still requires
   * zoom gestures, so this does not restore a double tap while `touchZoom`
   * is `false`. RNMapbox receives the double-tap entries of `gestureSettings`.
   */
  readonly doubleTapZoom?: boolean;
  /**
   * Enables the mouse wheel or trackpad zoom.
   *
   * Native adapters throw when this is set. There is no native wheel.
   */
  readonly scrollZoom?: boolean;
  /**
   * Enables double-click zoom.
   *
   * Native adapters throw when this is set.
   */
  readonly doubleClickZoom?: boolean;
  /**
   * Enables right-drag rotation.
   *
   * Native adapters throw when this is set.
   */
  readonly dragRotate?: boolean;
  /**
   * Enables shift-drag box zoom.
   *
   * Native adapters throw when this is set.
   */
  readonly boxZoom?: boolean;
  /**
   * Enables keyboard camera controls.
   *
   * Native adapters throw when this is set.
   */
  readonly keyboard?: boolean;
  /**
   * Requires a modifier key before wheel zoom.
   *
   * Native adapters throw when this is set.
   */
  readonly cooperativeGestures?: boolean;
  /**
   * Pixel distance that still counts as a click.
   *
   * This is a web constructor option. Native adapters throw when it is set.
   */
  readonly clickTolerance?: number;
  /**
   * Reads and writes the camera in the page URL hash.
   *
   * Native adapters throw when this is set. A string is the hash parameter
   * name react-map-gl accepts.
   */
  readonly hash?: boolean | string;
  /** Called when the camera is changing. */
  readonly onMove?: (event: MoveEvent) => void;
  /**
   * Called when a camera movement starts.
   *
   * Web uses `movestart`. MapLibre Native uses `onRegionWillChange`.
   * RNMapbox has no separate start event, so this is not called there.
   */
  readonly onMoveStart?: (event: MoveEvent) => void;
  /**
   * Called when the camera settles.
   *
   * This is not map idleness. Web uses `moveend`. RNMapbox uses `onMapIdle`
   * for this settled camera and also calls `onIdle`. MapLibre Native uses
   * `onRegionDidChange`.
   */
  readonly onMoveEnd?: (event: MoveEvent) => void;
  /**
   * Called when the map reports that it is idle.
   *
   * Web uses `idle`. RNMapbox uses `onMapIdle`. MapLibre Native has no idle
   * callback, so this is not called there. The first native settle can also
   * call `onMove` once when the map never sent a changing event.
   */
  readonly onIdle?: () => void;
  /** Called when the user presses or clicks the map. */
  readonly onClick?: (event: ClickEvent) => void;
  /**
   * Called for a second click in place.
   *
   * Native adapters throw when this is set.
   */
  readonly onDblClick?: (event: ClickEvent) => void;
  /**
   * Called for a long press.
   *
   * Native adapters forward it. Web throws, because react-map-gl has no
   * long-press callback and this package does not add a browser recognizer.
   */
  readonly onLongPress?: (event: ClickEvent) => void;
  /** Called for the web context menu. Native adapters throw when this is set. */
  readonly onContextMenu?: (event: ClickEvent) => void;
  /** Called when a pointer button goes down. Native adapters throw when set. */
  readonly onMouseDown?: (event: ClickEvent) => void;
  /** Called when a pointer button goes up. Native adapters throw when set. */
  readonly onMouseUp?: (event: ClickEvent) => void;
  /** Called when the pointer moves. Native adapters throw when set. */
  readonly onMouseMove?: (event: ClickEvent) => void;
  /** Called when the pointer enters the map. Native adapters throw when set. */
  readonly onMouseEnter?: (event: ClickEvent) => void;
  /** Called when the pointer leaves the map. Native adapters throw when set. */
  readonly onMouseLeave?: (event: ClickEvent) => void;
  /** Called when the pointer is over the map. Native adapters throw when set. */
  readonly onMouseOver?: (event: ClickEvent) => void;
  /** Called when the pointer goes out of the map. Native adapters throw when set. */
  readonly onMouseOut?: (event: ClickEvent) => void;
  /** Called for a wheel event. Native adapters throw when set. */
  readonly onWheel?: (event: ClickEvent) => void;
  /** Called while the user drags. Native adapters throw when set. */
  readonly onDrag?: (event: MoveEvent) => void;
  /** Called when a drag starts. Native adapters throw when set. */
  readonly onDragStart?: (event: MoveEvent) => void;
  /** Called when a drag ends. Native adapters throw when set. */
  readonly onDragEnd?: (event: MoveEvent) => void;
  /** Called when a touch starts. Native adapters throw when set. */
  readonly onTouchStart?: (event: ClickEvent) => void;
  /** Called while a touch moves. Native adapters throw when set. */
  readonly onTouchMove?: (event: ClickEvent) => void;
  /** Called when a touch ends. Native adapters throw when set. */
  readonly onTouchEnd?: (event: ClickEvent) => void;
  /** Called when a touch is cancelled. Native adapters throw when set. */
  readonly onTouchCancel?: (event: ClickEvent) => void;
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
