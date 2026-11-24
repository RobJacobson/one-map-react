import { Map as MaplibreMap } from "@maplibre/maplibre-react-native";
import type { Camera as WrapperCamera } from "@maplibre/maplibre-react-native";
import { type ComponentProps, type ComponentRef, forwardRef } from "react";
import type { ViewProps } from "react-native";

import {
  maplibreLightForNative,
  nativeComponents,
  MaplibreNativeMap,
  useMaplibreMapStyle,
} from "./adapters/maplibre-native/index.js";
import type { NativeAdvancedMapRef } from "./adapters/maplibre-native/map-ref.js";
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
import { createNativeMapBinding } from "./facade/native-map.js";
export type {
  NativeMarkerProps,
  NativeMarkerProps as MarkerProps,
} from "./facade/native-map.js";
export type {
  SourceProps,
  SourceProps as NativeSourceProps,
} from "./contracts/source-types.js";

export {
  MaplibreNativeLayer as Layer,
  type NativeLayerProps,
  type NativeLayerProps as LayerProps,
} from "./adapters/maplibre-native/index.js";
export type { NativeMapProps as MapProps };
export type {
  NativeAdvancedMapRef,
  NativeAdvancedMapRef as MapRef,
} from "./adapters/maplibre-native/map-ref.js";

/** Selected SDK location follow options, applied to the existing camera. */
export type NativeLocationOptions = Pick<
  ComponentProps<typeof WrapperCamera>,
  "trackUserLocation" | "onTrackUserLocationChange"
>;

export interface NativeMapProps extends Omit<NativeMapInputs, "mapStyle"> {
  /** Complete selected style document. */
  readonly mapStyle:
    | NativeMapInputs["mapStyle"]
    | import("@maplibre/maplibre-react-native").StyleSpecification;
  /** SDK follow facilities; conflicts with an explicit viewState target. */
  readonly locationOptions?: NativeLocationOptions;
  /** Attributes on the containing native View. */
  readonly hostProps?: ViewProps;
  /** Selected renderer options; facade-owned fields take precedence. */
  readonly options?: Omit<
    Partial<ComponentProps<typeof MaplibreMap>>,
    | "children"
    | "ref"
    | "style"
    | "mapStyle"
    | "onPress"
    | "onLongPress"
    | "onRegionWillChange"
    | "onRegionIsChanging"
    | "onRegionDidChange"
    | "onDidFinishLoadingMap"
    | "onDidFinishLoadingStyle"
    | "onDidFailLoadingMap"
  >;
}
const {
  Map: NativeMap,
  Source,
  Marker,
  MapProvider,
  useMap,
} = createNativeMapBinding<NativeAdvancedMapRef, NativeMapProps>(
  MaplibreNativeMap,
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
export {
  Callout,
  LayerAnnotation,
  MarkerView,
  ViewAnnotation,
} from "./adapters/maplibre-native/ui.js";

export {
  LocationManager as WrapperLocationManager,
  NativeUserLocation,
  OfflineManager as WrapperOfflineManager,
  StaticMapImageManager as WrapperStaticMapImageManager,
  UserLocation as WrapperUserLocation,
  useCurrentPosition as useWrapperCurrentPosition,
} from "@maplibre/maplibre-react-native";

/** Native animation, logging, networking and request transformation facilities. */
export {
  Animated,
  LogManager,
  NetworkManager,
  TransformRequestManager,
} from "@maplibre/maplibre-react-native";
export type {
  MapLibrePluginProps,
  StyleSpecification,
  LightSpecification,
  SkySpecification,
  ProjectionSpecification,
  ColorReliefLayerSpecification,
  HillshadeLayerSpecification,
  TransformOptions,
  UrlTransformOptions,
  UrlSearchParamOptions,
  HeaderOptions,
} from "@maplibre/maplibre-react-native";

/** Complete wrapper composition for selected props and imperative refs. Use WrapperCamera inside WrapperMap, which owns its camera context. */
export {
  Camera as WrapperCamera,
  GeoJSONSource as WrapperGeoJSONSource,
  VectorSource as WrapperVectorSource,
  RasterSource as WrapperRasterSource,
  RasterDEMSource as WrapperRasterDEMSource,
  ImageSource as WrapperImageSource,
  Images as WrapperImages,
  Marker as WrapperMarker,
  OfflinePack as WrapperOfflinePack,
} from "@maplibre/maplibre-react-native";

/** Selected wrapper map with explicit native SDK style and light boundaries. */
export const WrapperMap = forwardRef<
  ComponentRef<typeof MaplibreMap>,
  ComponentProps<typeof MaplibreMap>
>((props, ref) => {
  // Read the current light fields even when the caller reuses the object.
  "use no memo";

  const mapStyle = useMaplibreMapStyle(props.mapStyle);
  const { light, ...otherProps } = props;
  const lightProps = Object.hasOwn(props, "light")
    ? { light: maplibreLightForNative(light) }
    : {};

  return (
    <MaplibreMap
      {...otherProps}
      {...lightProps}
      ref={ref}
      mapStyle={mapStyle}
    />
  );
});
