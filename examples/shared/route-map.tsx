import {
  Layer,
  type MapLayoutStyle,
  type MapRef,
  type MoveEvent,
  Map as OneMap,
  Source,
} from "one-map-react";
import { forwardRef } from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../tests/fixtures/map-fixture.js";

interface RouteMapProps {
  readonly style?: MapLayoutStyle;
  readonly onMove?: (event: MoveEvent) => void;
}

/**
 * Shared Seattle route map used by the web and native example shells.
 *
 * Shells own remount, fly-to, tokens, and host layout.
 */
export const RouteMap = forwardRef<MapRef, RouteMapProps>(
  ({ style, onMove }, ref) => (
    <OneMap
      ref={ref}
      mapStyle={emptyStyle}
      initialViewState={initialViewState}
      style={style}
      onMove={onMove}
    >
      <Source id="routes" type="geojson" data={routes}>
        <Layer
          id="route-line"
          type="line"
          paint={{ "line-color": "#2563eb", "line-width": 3 }}
          layout={{ "line-cap": "round" }}
        />
      </Source>
    </OneMap>
  )
);
