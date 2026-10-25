import type { ReactNode } from "react";

import type { LngLat, Point } from "./camera-types.js";

/** Geographic attachment point within the marker or popup content. */
export type Anchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Normalized marker activation or coordinate proposal. */
export interface MarkerEvent {
  /** Proposed coordinate; the longitude and latitude props remain authoritative. */
  readonly lngLat: LngLat;
  /** Logical map-view point when supplied by the wrapper. */
  readonly point?: Point;
}

/** Imperative annotation snapshot refresh. */
export interface MarkerRef {
  /** Refreshes native annotation images; resolves without work for live views and web. */
  refresh(): Promise<void>;
}

/** Shared geographically anchored marker. */
export interface MarkerProps {
  /** Longitude in degrees. */
  readonly longitude: number;
  /** Latitude in degrees. */
  readonly latitude: number;
  /** Stable identity; changing requires a new React key. */
  readonly id?: string;
  /** Creation input; defaults to bottom for the default pin, center for custom content. */
  readonly anchor?: Anchor;
  /** Offset in logical map-view units; clearing resets to zero. */
  readonly offset?: Point;
  /** Live host content, or the shared blue pin when absent. */
  readonly children?: ReactNode;
  /** Native live view by default; annotation explicitly opts into Android bitmap content. */
  readonly renderMode?: "view" | "annotation";
  /** Enables web dragging; native requests fail explicitly. */
  readonly draggable?: boolean;
  /** Called when activated. */
  readonly onClick?: (event: MarkerEvent) => void;
  /** Called when a web drag begins; unsupported on native. */
  readonly onDragStart?: (event: MarkerEvent) => void;
  /** Called with proposed web drag coordinates; unsupported on native. */
  readonly onDrag?: (event: MarkerEvent) => void;
  /** Called with final web drag coordinates; unsupported on native. */
  readonly onDragEnd?: (event: MarkerEvent) => void;
  /** Reports marker projection failures. */
  readonly onError?: (error: unknown) => void;
}

/** Mounted standalone popup; onClose requests application dismissal. */
export interface PopupProps {
  /** Longitude in degrees. */
  readonly longitude: number;
  /** Latitude in degrees. */
  readonly latitude: number;
  /** Geographic attachment point; defaults to bottom. */
  readonly anchor?: Anchor;
  /** Offset in logical map-view units. */
  readonly offset?: Point;
  /** Maximum logical width; defaults to 240. */
  readonly maxWidth?: number | string;
  /** Shows an accessible dismissal button; creation input. */
  readonly closeButton?: boolean;
  /** Dismisses on map click; creation input. */
  readonly closeOnClick?: boolean;
  /** Dismisses on camera movement; creation input. */
  readonly closeOnMove?: boolean;
  /** Browser focus behavior; creation input. */
  readonly focusAfterOpen?: boolean;
  /** Popup host content. */
  readonly children?: ReactNode;
  /** Called when attached. */
  readonly onOpen?: () => void;
  /** Called on requested dismissal, never during component teardown. */
  readonly onClose?: () => void;
}

/** Corner of the map container. */
export type ControlPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Application-supplied host UI anchored to a map corner. */
export interface ControlProps {
  /** Corner selected at creation; defaults to top-right. */
  readonly position?: ControlPosition;
  /** Interactive host content. */
  readonly children?: ReactNode;
}

/** Zoom buttons and camera compass. */
export interface NavigationControlProps extends ControlProps {
  /** Shows zoom buttons; creation input, default true. */
  readonly showZoom?: boolean;
  /** Shows a bearing reset button; creation input, default true. */
  readonly showCompass?: boolean;
  /** Includes pitch in compass presentation; creation input. */
  readonly visualizePitch?: boolean;
  /** Reports camera command failures. */
  readonly onError?: (error: unknown) => void;
}

/** Renderer attribution ornament. */
export interface AttributionControlProps extends ControlProps {
  /** Compact presentation; creation input. */
  readonly compact?: boolean;
  /** Additional attribution; creation input. */
  readonly customAttribution?: string | readonly string[];
}

/** Scale of projected ground distance. */
export interface ScaleControlProps extends ControlProps {
  /** Maximum logical width; creation input, default 100. */
  readonly maxWidth?: number;
  /** Mutable display unit; default metric. */
  readonly unit?: "metric" | "imperial" | "nautical";
  /** Reports projection failures. */
  readonly onError?: (error: unknown) => void;
}

/** Measured location supplied by an application or selected service. */
export interface GeolocationPosition {
  /** Geographic coordinate. */
  readonly lngLat: LngLat;
  /** Accuracy radius in meters when available. */
  readonly accuracy?: number;
  /** Time in milliseconds since Unix epoch when available. */
  readonly timestamp?: number;
  /** Altitude in meters when measured. */
  readonly altitude?: number;
  /** Vertical uncertainty in meters when measured. */
  readonly altitudeAccuracy?: number;
  /** Speed in meters per second when measured. */
  readonly speed?: number;
  /** Direction of travel in degrees clockwise from north; not device heading. */
  readonly course?: number;
}

/** User-triggered acquisition and optional foreground following. */
export interface GeolocateControlProps extends ControlProps {
  /** One-shot override; cannot be combined with locationProvider or tracking. */
  readonly getCurrentPosition?: () => Promise<GeolocationPosition>;
  /** Zoom used when centering a native position; default 14. */
  readonly zoom?: number;
  /** Reports a acquired position. */
  readonly onGeolocate?: (position: GeolocationPosition) => void;
  /** Reports acquisition or centering failure. */
  readonly onError?: (error: unknown) => void;
  /** Follow acquired coordinates; user gestures suspend following until reactivation. */
  readonly trackUserLocation?: boolean;
  /** Streaming override; otherwise uses MapSetup or the selected default. */
  readonly locationProvider?: import("./location-types.js").LocationService;
}

/** Browser fullscreen control; native fails explicitly. */
export interface FullscreenControlProps extends ControlProps {}
