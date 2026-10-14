import type { MapView, Camera as WrapperCamera } from "@rnmapbox/maps";
import type {
  ComponentProps,
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import type { ViewProps } from "react-native";

import type {
  NativeControlProps,
  NativePopupProps,
} from "./adapters/shared/native-ui.js";
import type { MapRef } from "./contracts/camera-types.js";
import type { MapProps } from "./contracts/map-types.js";
import type {
  GeoJsonSourceProps,
  SourceProps,
  VectorSourceProps,
} from "./contracts/source-types.js";
import type { MarkerProps, MarkerRef } from "./contracts/ui-types.js";
import { Map as SharedMap } from "./facade/map.js";
import { Source as SharedSource } from "./facade/source.js";
import {
  Control as SharedControl,
  Marker as SharedMarker,
  Popup as SharedPopup,
} from "./facade/ui.js";

export type { GestureSettings } from "./adapters/mapbox-native/index.js";
export {
  adapter,
  CameraGestureObserver,
  MapboxGestureSettings,
} from "./adapters/mapbox-native/index.js";
export type {
  NativeControlProps,
  NativePopupProps,
} from "./adapters/shared/native-ui.js";

/** Selected native map with typed renderer facilities and host attributes. */
/** Selected SDK location follow options, applied to the existing camera. */
export type NativeLocationOptions = Pick<
  ComponentProps<typeof WrapperCamera>,
  | "followUserLocation"
  | "followUserMode"
  | "followZoomLevel"
  | "followPitch"
  | "followHeading"
  | "onUserTrackingModeChange"
>;

export interface NativeMapProps extends MapProps {
  /** SDK follow facilities; conflicts with authoritative viewState/common follow. */
  readonly locationOptions?: NativeLocationOptions;
  /** Attributes on the containing native View. */
  readonly hostProps?: ViewProps;
  /** Selected renderer options; facade-owned fields take precedence. */
  readonly options?: Omit<
    Partial<ComponentProps<typeof MapView>>,
    | "children"
    | "ref"
    | "style"
    | "onPress"
    | "onLongPress"
    | "onCameraChanged"
    | "onRegionIsChanging"
    | "onRegionWillChange"
    | "onRegionDidChange"
    | "onMapIdle"
    | "onDidFinishLoadingMap"
    | "onDidFinishLoadingStyle"
    | "onDidFailLoadingMap"
    | "onMapLoadingError"
    | "onDidFinishRenderingFrameFully"
  >;
}
/** Selected map retaining shared map context and named access. */
// biome-ignore lint/suspicious/noShadowRestrictedNames: public Map API
export const Map = SharedMap as ForwardRefExoticComponent<
  NativeMapProps & RefAttributes<MapRef>
>;

/** Selected marker content host, including accessibility and layout attributes. */
export interface NativeMarkerProps extends MarkerProps {
  /** Attributes composed on the marker's owned native child View. */
  readonly hostProps?: ViewProps;
}
/** Selected marker retaining portable drag and geometry semantics. */
export const Marker = SharedMarker as ForwardRefExoticComponent<
  NativeMarkerProps & RefAttributes<MarkerRef>
>;

/** Source activation hit region with selected native dimensions. */
export type NativeSourceProps =
  | Exclude<SourceProps, GeoJsonSourceProps | VectorSourceProps>
  | ((GeoJsonSourceProps | VectorSourceProps) & {
      readonly hitbox?: { width: number; height: number };
    });
/** Selected source with mutable activation hitbox. */
export const Source = SharedSource as ComponentType<NativeSourceProps>;

export { getAnnotationsLayerID, PointAnnotationManager } from "@rnmapbox/maps";

export {
  Annotation,
  Callout,
  MarkerView,
  PointAnnotation,
} from "./adapters/mapbox-native/ui.js";

/** Popup with owned native bubble host attributes and style. */
export const Popup = SharedPopup as ComponentType<NativePopupProps>;
/** Corner control with owned native host attributes and style. */
export const Control = SharedControl as ComponentType<NativeControlProps>;

export {
  CustomLocationProvider,
  LocationPuck,
  locationManager as WrapperLocationManager,
  NativeUserLocation,
  offlineManager as WrapperOfflineManager,
  offlineManagerLegacy,
  requestAndroidLocationPermissions,
  snapshotManager as WrapperSnapshotManager,
  TileStore,
  UserLocation as WrapperUserLocation,
} from "@rnmapbox/maps";
