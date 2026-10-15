import type { NativeAdvancedMapRef } from "./adapters/mapbox-native/map-ref.js";
export type { NativeAdvancedMapRef } from "./adapters/mapbox-native/map-ref.js";
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
import type { MapProps } from "./contracts/map-types.js";
import type {
  GeoJsonSourceProps,
  SourceProps,
  VectorSourceProps,
} from "./contracts/source-types.js";
import type { StyleDocument } from "./contracts/style-types.js";
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

export interface NativeMapProps extends Omit<MapProps, "mapStyle"> {
  /** Complete selected style document. */
  readonly mapStyle: MapProps["mapStyle"] | NativeStyleDocument;
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
// eslint-disable-next-line one-map/no-shadow-language-globals -- public Map API
export const Map = SharedMap as ForwardRefExoticComponent<
  NativeMapProps & RefAttributes<NativeAdvancedMapRef>
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

/** Native advanced style, animation, viewport and app-level facilities. */
export {
  Animated,
  AnimatedCoordinatesArray,
  AnimatedExtractCoordinateFromArray,
  AnimatedPoint,
  AnimatedRouteCoordinatesArray,
  AnimatedShape,
  __experimental,
  Atmosphere,
  Snow,
  Rain,
  Light,
  Terrain,
  StyleImport,
  Models,
  RasterArraySource,
  SkyLayer,
  ModelLayer,
  RasterParticleLayer,
  HillshadeLayer,
  Viewport,
  Style,
  Logger,
  StyleURL,
  OfflinePackDownloadState,
  LineJoin,
  StyleSource,
  TileServers,
  setAccessToken,
  getAccessToken,
  setWellKnownTileServer,
  setTelemetryEnabled,
  setConnected,
  addCustomHeader,
  removeCustomHeader,
} from "@rnmapbox/maps";
export type {
  StandardStyleConfig,
  TerrainLayerStyle,
  LightLayerStyle,
  AtmosphereLayerStyle,
  SkyLayerStyle,
  ModelLayerStyle,
  RasterParticleLayerStyle,
  HillshadeLayerStyle,
} from "@rnmapbox/maps";

/** Native style roots; sources and layers are validated by the native SDK. */
export interface NativeStyleDocument extends StyleDocument {
  /** Style metadata. */
  readonly metadata?: object;
  /** Initial map center. */
  readonly center?: readonly [number, number];
  /** Initial zoom. */
  readonly zoom?: number;
  /** Initial bearing. */
  readonly bearing?: number;
  /** Initial pitch. */
  readonly pitch?: number;
  /** Glyph URL template. */
  readonly glyphs?: string;
  /** Sprite URL. */
  readonly sprite?: string;
  /** Terrain definition. */
  readonly terrain?: import("./contracts/map-types.js").Terrain;
  /** Legacy light. */
  readonly light?: import("./contracts/map-types.js").LegacyLight;
  /** Native projection. */
  readonly projection?: { readonly name: "mercator" | "globe" };
  /** Modern light definitions. */
  readonly lights?: readonly object[];
  /** Style imports and their configurations. */
  readonly imports?: readonly object[];
  /** Model URLs keyed by id. */
  readonly models?: Readonly<Record<string, string>>;
  /** Atmosphere properties. */
  readonly fog?: object;
  /** Rain properties. */
  readonly rain?: object;
  /** Snow properties. */
  readonly snow?: object;
  /** Theme properties. */
  readonly "color-theme"?: object;
  /** Style configuration schema. */
  readonly schema?: object;
  /** Feature sets. */
  readonly featuresets?: object;
  /** Indoor sources. */
  readonly indoor?: object;
  /** Default property transition. */
  readonly transition?: import("./contracts/map-types.js").StyleTransition;
}
