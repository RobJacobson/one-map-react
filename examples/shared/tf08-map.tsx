import {
  GeolocateControl,
  type GeolocationPosition,
  type LocationService,
  type MapLayoutStyle,
  type MapRef,
  type MapStyle,
  Map as OneMap,
  UserLocation,
} from "one-map-react";
import { forwardRef } from "react";

/** Shared foreground-location/capture scene; setup and permission UI belong to the shell. */
export interface Tf08MapProps {
  /** Style supplied by the selected application's shell. */
  readonly mapStyle: MapStyle;
  /** Platform host layout. */
  readonly style?: MapLayoutStyle;
  /** Optional deterministic provider for a fixture or application service. */
  readonly locationProvider?: LocationService;
  /** Explicit external position; displaying it performs no acquisition. */
  readonly position?: GeolocationPosition;
  /** Acquisition/camera failures. */
  readonly onError: (error: unknown) => void;
}

/** Shared scene for all four adapters, with capture enabled at construction. */
export const Tf08Map = forwardRef<MapRef, Tf08MapProps>(
  ({ mapStyle, style, locationProvider, position, onError }, ref) => (
    <OneMap
      ref={ref}
      mapStyle={mapStyle}
      style={style}
      initialViewState={{
        longitude: -122.34,
        latitude: 47.61,
        zoom: 12,
        bearing: 0,
        pitch: 0,
      }}
      captureEnabled
    >
      <UserLocation position={position} showAccuracyCircle />
      <GeolocateControl
        locationProvider={locationProvider}
        trackUserLocation
        onError={onError}
      />
    </OneMap>
  )
);
