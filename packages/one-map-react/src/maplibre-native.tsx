import { Map as MaplibreMap } from "@maplibre/maplibre-react-native";
import type { Camera as WrapperCamera } from "@maplibre/maplibre-react-native";
import {
  type ComponentProps,
  type ReactElement,
  type ComponentRef,
  forwardRef,
} from "react";
import type { ViewProps } from "react-native";

import {
  adapter,
  MaplibreNativeMap,
} from "./adapters/maplibre-native/index.js";
import type { NativeAdvancedMapRef } from "./adapters/maplibre-native/map-ref.js";
import { assertMaplibreStyleRoots } from "./adapters/maplibre-native/style-roots.js";
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
import { useLayerOptions } from "./facade/layer.js";
import { createNativeMapBinding } from "./facade/native-map.js";
export type {
  NativeMarkerProps,
  NativeMarkerProps as MarkerProps,
} from "./facade/native-map.js";
export type {
  SourceProps,
  SourceProps as NativeSourceProps,
} from "./contracts/source-types.js";

export { adapter } from "./adapters/maplibre-native/index.js";
import {
  MaplibreNativeLayer,
  type NativeLayerProps,
} from "./adapters/maplibre-native/index.js";
export type {
  NativeLayerProps,
  NativeLayerProps as LayerProps,
  NativeMapProps as MapProps,
};
/** Renders a style-spec layer through MapLibre Native. */
export const Layer = (props: NativeLayerProps): ReactElement => {
  useLayerOptions(props, adapter.backend);
  return <MaplibreNativeLayer {...props} />;
};
export type {
  NativeAdvancedMapRef,
  NativeAdvancedMapRef as MapRef,
} from "./adapters/maplibre-native/map-ref.js";

/** Selected native map with typed renderer facilities and host attributes. */
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
  MaplibreNativeMap,
  adapter
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

/** Selected wrapper map with explicit native SDK style-root boundaries. */
export const WrapperMap = forwardRef<
  ComponentRef<typeof MaplibreMap>,
  ComponentProps<typeof MaplibreMap>
>((props, ref) => {
  assertMaplibreStyleRoots(props.mapStyle);
  return <MaplibreMap {...props} ref={ref} />;
});
