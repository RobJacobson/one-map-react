import {
  type GeolocationPosition,
  type MapLayoutStyle,
  type MapRef,
  type MapStyle,
  Map as OneMap,
  UserLocation,
} from "one-map-react";
import { forwardRef, type ReactNode } from "react";

/** Shared foreground-location scene; setup and permission UI belong to the shell. */
export interface Tf08MapProps {
  /** Style supplied by the selected application's shell. */
  readonly mapStyle: MapStyle;
  /** Platform host layout. */
  readonly style?: MapLayoutStyle;
  /** Application-supplied location action; display itself acquires nothing. */
  readonly locationAction?: ReactNode;
  /** Explicit external position; displaying it performs no acquisition. */
  readonly position?: GeolocationPosition;
  /** Acquisition/camera failures. */
  readonly onError: (error: unknown) => void;
}

/** Shared scene for all four adapters. */
export const Tf08Map = forwardRef<MapRef, Tf08MapProps>(
  ({ mapStyle, style, locationAction, position, onError }, ref) => (
    <>
      <OneMap
        ref={ref}
        mapStyle={mapStyle}
        style={style}
        onError={onError}
        initialViewState={{
          longitude: -122.34,
          latitude: 47.61,
          zoom: 12,
          bearing: 0,
          pitch: 0,
        }}
      >
        <UserLocation position={position} showAccuracyCircle />
      </OneMap>
      {locationAction}
    </>
  )
);
