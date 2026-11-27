import {
  type Camera as WrapperCamera,
  MapView as WrapperMapView,
} from "@rnmapbox/maps";
import type { ComponentProps } from "react";
import type { ViewProps } from "react-native";

import {
  nativeComponents,
  MapboxNativeMap,
} from "./adapters/mapbox-native/index.js";
import type { NativeAdvancedMapRef } from "./adapters/mapbox-native/index.js";
import type { LayerProps } from "./contracts/layer-types.js";
import type { NativeMapInputs } from "./contracts/native-types.js";
export type {
  NativeBounds,
  NativeBoundsLike,
  NativeClickEvent,
  NativeGeoJsonSource,
  NativeLngLat,
  NativeLngLatLike,
  NativePoint,
  NativePointLike,
} from "./contracts/native-types.js";
import type { StyleDocument } from "./contracts/style-types.js";
import { createNativeMapBinding } from "./facade/native-map.js";
export type {
  NativeMarkerProps,
  NativeMarkerProps as MarkerProps,
} from "./facade/native-map.js";
export type {
  SourceProps,
  SourceProps as NativeSourceProps,
} from "./contracts/source-types.js";

export type { GestureSettings } from "./adapters/mapbox-native/index.js";
export type {
  NativeAdvancedMapRef,
  NativeAdvancedMapRef as MapRef,
} from "./adapters/mapbox-native/index.js";
export {
  CameraGestureObserver,
  MapboxGestureSettings,
  MapboxNativeLayer as Layer,
} from "./adapters/mapbox-native/index.js";

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

export interface NativeMapProps extends Omit<NativeMapInputs, "mapStyle"> {
  /** Complete selected style document. */
  readonly mapStyle: NativeMapInputs["mapStyle"] | NativeStyleDocument;
  /**
   * SDK location follow. When enabled, a `viewState` target and portable
   * imperative camera commands are unavailable.
   */
  readonly locationOptions?: NativeLocationOptions;
  /** Attributes on the containing native View. */
  readonly hostProps?: ViewProps;
  /** Selected renderer options; facade-owned fields take precedence. */
  readonly options?: Omit<
    Partial<ComponentProps<typeof WrapperMapView>>,
    | "children"
    | "ref"
    | "style"
    | "styleURL"
    | "styleJSON"
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
  >;
}
const {
  Map: NativeMap,
  Source,
  Marker,
  MapProvider,
  useMap,
} = createNativeMapBinding<NativeAdvancedMapRef, NativeMapProps>(
  MapboxNativeMap,
  nativeComponents
);
export {
  NativeMap as default,
  NativeMap as Map,
  MapProvider,
  Marker,
  Source,
  useMap,
};

/** Style-spec options for an RNMapbox layer. */
export type NativeLayerProps = LayerProps;
export type { NativeLayerProps as LayerProps, NativeMapProps as MapProps };

export { getAnnotationsLayerID, PointAnnotationManager } from "@rnmapbox/maps";

export {
  Annotation,
  Callout,
  MarkerView,
  PointAnnotation,
} from "./adapters/mapbox-native/ui.js";

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
  clearData,
  UserTrackingMode,
  UserTrackingModes,
  UserLocationRenderMode,
  AnimatedMapPoint,
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
export type StyleSpecification = NativeStyleDocument;

/** Style document accepted by the pinned RNMapbox wrapper. */
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

export { WrapperMapView };

/** Complete wrapper composition for selected props and imperative refs. Use WrapperCamera inside WrapperMapView, which owns its camera context. */
export {
  Camera as WrapperCamera,
  ShapeSource as WrapperShapeSource,
  VectorSource as WrapperVectorSource,
  RasterSource as WrapperRasterSource,
  RasterDemSource as WrapperRasterDemSource,
  ImageSource as WrapperImageSource,
  Images as WrapperImages,
  Image as WrapperImage,
  FillLayer as WrapperFillLayer,
  FillExtrusionLayer as WrapperFillExtrusionLayer,
  HeatmapLayer as WrapperHeatmapLayer,
  LineLayer as WrapperLineLayer,
  CircleLayer as WrapperCircleLayer,
  SymbolLayer as WrapperSymbolLayer,
  RasterLayer as WrapperRasterLayer,
  BackgroundLayer as WrapperBackgroundLayer,
  setLanguage,
  normalizeLanguageTag,
} from "@rnmapbox/maps";
