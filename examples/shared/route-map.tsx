import {
  type ClickEvent,
  type ExternalDrawingContext,
  Layer,
  type MapErrorEvent,
  type MapLayoutStyle,
  type MapRef,
  type MapStyle,
  type MoveEvent,
  Map as OneMap,
  Source,
  type ViewState,
} from "one-map-react";
import { forwardRef } from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../tests/fixtures/map-fixture.js";

interface RouteMapProps {
  readonly style?: MapLayoutStyle;
  readonly mapStyle?: MapStyle;
  readonly reuseMaps?: boolean;
  readonly gl?: ExternalDrawingContext;
  readonly viewState?: ViewState;
  readonly touchZoom?: false;
  readonly doubleTapZoom?: true;
  readonly onMove?: (event: MoveEvent) => void;
  readonly onMoveEnd?: (event: MoveEvent) => void;
  readonly onClick?: (event: ClickEvent) => void;
  readonly onLoad?: () => void;
  readonly onStyleLoad?: () => void;
  readonly onError?: (event: MapErrorEvent) => void;
}

/**
 * Shared Seattle route map used by the web and native example shells.
 *
 * @remarks
 * Shells own remount, fly-to, tokens, host layout, and the smoke controls.
 * The default map does not opt into reuse.
 */
export const RouteMap = forwardRef<MapRef, RouteMapProps>(
  (
    {
      style,
      mapStyle,
      reuseMaps,
      gl,
      viewState,
      touchZoom,
      doubleTapZoom,
      onMove,
      onMoveEnd,
      onClick,
      onLoad,
      onStyleLoad,
      onError,
    },
    ref
  ) => (
    <OneMap
      ref={ref}
      mapStyle={mapStyle ?? emptyStyle}
      initialViewState={initialViewState}
      viewState={viewState}
      touchZoom={touchZoom}
      doubleTapZoom={doubleTapZoom}
      style={style}
      reuseMaps={reuseMaps}
      gl={gl}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      onClick={onClick}
      onLoad={onLoad}
      onStyleLoad={onStyleLoad}
      onError={onError}
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
