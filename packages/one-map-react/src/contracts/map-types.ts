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
 * Shared inputs used by the native maps.
 */
export interface MapProps {
  /** Terrain override; null disables terrain. Omission leaves SDK style semantics. */
  readonly terrain?: Terrain | null;
  /** Selected projection. MapLibre Native supports mercator only. */
  readonly projection?: "mercator" | "globe";
  /** Legacy extrusion light; omission follows selected SDK reset semantics. */
  readonly light?: LegacyLight;

  /** Optional provider-local ID for useMap()[id]. Changing it requires remounting. */
  readonly id?: string;
  /** Layer ids whose rendered feature hits are included with map clicks. */
  readonly interactiveLayerIds?: readonly string[];
  /** Style URL or a local style document. */
  readonly mapStyle: MapStyle;
  /**
   * Camera applied on first mount only.
   *
   * A later change does not move the camera. Use `viewState` or a command.
   */
  readonly initialViewState: ViewState;
  /**
   * Camera target supplied by React.
   *
   * Native adapters apply changed values through Camera props; movement can leave an unchanged
   * target behind. Use an explicit command to reapply the same native target.
   * Removing this value releases the target. Native location follow cannot own
   * the camera at the same time. The `controlledCamera` capability remains unavailable.
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
   * crosses the antimeridian. MapLibre iOS applies this to user panning;
   * imperative camera commands can bypass the constraint.
   */
  readonly maxBounds?: Bounds;
  /**
   * Padding in logical map-view units. Missing sides become zero.
   * Initial omission preserves the wrapper default.
   */
  readonly padding?: Padding;
  /** Host layout for the map container. */
  readonly style?: MapLayoutStyle;
  /** Native maps remount on replacement. A request to pool a map throws. */
  readonly reuseMaps?: boolean;
  /** Providing an external drawing context throws on native. */
  readonly gl?: ExternalDrawingContext;
  /** Set false to disable native map gestures, including individually enabled gestures. */
  readonly interactive?: boolean;
  /** Enables one-finger panning. RNMapbox receives this as `scrollEnabled`. */
  readonly dragPan?: boolean;
  /** Enables pinch zoom. */
  readonly touchZoom?: boolean;
  /** Enables the native rotation gesture. */
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
  /** Native adapters reject a supplied double-click flag. */
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
   * MapLibre Native uses `onRegionWillChange`.
   * RNMapbox has no separate start event, so this is not called there.
   */
  readonly onMoveStart?: (event: MoveEvent) => void;
  /**
   * Called when the camera settles.
   *
   * This is not map idleness. RNMapbox uses `onMapIdle`
   * for this settled camera and also calls `onIdle`. MapLibre Native uses
   * `onRegionDidChange`.
   */
  readonly onMoveEnd?: (event: MoveEvent) => void;
  /**
   * Called when the map reports that it is idle.
   *
   * RNMapbox uses `onMapIdle`. MapLibre Native has no idle
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
  /** Called when the native wrapper reports a long press. */
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
  /** Called when the native wrapper reports onDidFinishLoadingStyle. */
  readonly onStyleLoad?: () => void;
  /** Called when the wrapper reports a map error. */
  readonly onError?: (event: MapErrorEvent) => void;
  /**
   * Called when the web map resizes. Use `hostProps.onLayout` on native.
   *
   * @throws Error when a callback is supplied to a native map.
   */
  readonly onResize?: () => void;
  /** Sources and layers rendered inside the map. */
  readonly children?: ReactNode;
}

/** Portable terrain using a mounted raster DEM source. */
export interface Terrain {
  /** Raster DEM source id. */
  readonly source: string;
  /** Numeric elevation multiplier, including zero. */
  readonly exaggeration?: number;
}

/** Duration and delay in milliseconds for a style property change. */
export interface StyleTransition {
  /** Transition duration in milliseconds. */
  readonly duration?: number;
  /** Transition delay in milliseconds. */
  readonly delay?: number;
}

/** Legacy light shared by the four selected renderer paths. */
export interface LegacyLight {
  /** Light coordinate frame. */
  readonly anchor?: "map" | "viewport";
  /** Light tint. */
  readonly color?: string;
  /** Light intensity from zero to one. */
  readonly intensity?: number;
  /** Spherical radius, azimuth, and polar angle in degrees. */
  readonly position?: readonly [number, number, number];
  /** Color transition. */
  readonly "color-transition"?: StyleTransition;
  /** Intensity transition. */
  readonly "intensity-transition"?: StyleTransition;
  /** Position transition. */
  readonly "position-transition"?: StyleTransition;
}
