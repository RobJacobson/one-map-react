import type { ReactNode } from "react";

import type { ViewState } from "./camera-types.js";
import type { MoveEvent } from "./event-types.js";
import type { MapStyle } from "./style-types.js";

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
  /** Called when the wrapper reports camera movement. */
  readonly onMove?: (event: MoveEvent) => void;
  /** Sources and layers rendered inside the map. */
  readonly children?: ReactNode;
}
