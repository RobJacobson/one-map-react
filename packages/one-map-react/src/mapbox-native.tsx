import * as Rnmapbox from "@rnmapbox/maps";
import { forwardRef } from "react";

import { assertLabelLocalization } from "./adapters/mapbox-native/label-localization.js";
import type { NativeAdvancedMapRef } from "./adapters/mapbox-native/map-ref.js";
export type { NativeAdvancedMapRef } from "./adapters/mapbox-native/map-ref.js";
import { MapView } from "@rnmapbox/maps";
import type { Camera as WrapperCamera } from "@rnmapbox/maps";
import type {
  ComponentProps,
  ComponentRef,
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import type { ViewProps } from "react-native";

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
import { Marker as SharedMarker } from "./facade/ui.js";

export type { GestureSettings } from "./adapters/mapbox-native/index.js";
export {
  adapter,
  CameraGestureObserver,
  MapboxGestureSettings,
} from "./adapters/mapbox-native/index.js";

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
  /** SDK follow facilities; conflicts with an explicit viewState target. */
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
  >;
}
/** Selected map retaining shared map context and named access. */
// eslint-disable-next-line one-map/no-shadow-language-globals -- public Map API
export const Map = SharedMap as ForwardRefExoticComponent<
  NativeMapProps & RefAttributes<NativeAdvancedMapRef>
>;

/** Selected marker content host, including accessibility and layout attributes. */
export interface NativeMarkerProps extends Omit<
  MarkerProps,
  "draggable" | "onDragStart" | "onDrag" | "onDragEnd"
> {
  /** Native shared markers support programmatic coordinates and activation only. */
  readonly draggable?: false;
  /** Attributes composed on the marker's owned native child View. */
  readonly hostProps?: ViewProps;
}
/** Selected marker retaining shared geometry and activation. */
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
} from "@rnmapbox/maps";

/**
 * Sets app-wide Mapbox label languages through RNMapbox 10.3.8 or newer.
 * @param language - Unmodified language tag, ordered tags, or null for the SDK default.
 * @returns Resolves when the wrapper acknowledges the change.
 * @throws When the installed wrapper predates this operation, or the SDK rejects it.
 */
export const setLanguage = async (
  language: string | string[] | null
): Promise<void> => {
  if (
    !("setLanguage" in Rnmapbox) ||
    typeof Rnmapbox.setLanguage !== "function"
  ) {
    throw new Error("setLanguage requires @rnmapbox/maps 10.3.8 or newer.");
  }
  await Rnmapbox.setLanguage(language);
};

/**
 * Normalizes a Mapbox language tag using the installed wrapper's optional helper.
 * @param tag - BCP-47 language tag to normalize; setLanguage itself never rewrites it.
 * @returns The wrapper-normalized tag, including its Chinese-script handling.
 * @throws When the installed wrapper predates this helper.
 */
export const normalizeLanguageTag = (tag: string): string => {
  if (
    !("normalizeLanguageTag" in Rnmapbox) ||
    typeof Rnmapbox.normalizeLanguageTag !== "function"
  ) {
    throw new Error(
      "normalizeLanguageTag requires @rnmapbox/maps 10.3.8 or newer."
    );
  }
  // The minimum peer lacks this declaration; validate the newer wrapper result at this boundary.
  const normalized: unknown = Rnmapbox.normalizeLanguageTag(tag);
  if (typeof normalized !== "string")
    throw new Error("RNMapbox returned an invalid normalized language tag.");
  return normalized;
};

/** Selected wrapper map with v11 localization availability checked before native dispatch. */
export const WrapperMapView = forwardRef<
  ComponentRef<typeof MapView>,
  ComponentProps<typeof MapView>
>((props, ref) => {
  assertLabelLocalization(props.localizeLabels);
  return <MapView {...props} ref={ref} />;
});
