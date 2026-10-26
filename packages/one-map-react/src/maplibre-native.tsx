import { forwardRef } from "react";

import type { NativeAdvancedMapRef } from "./adapters/maplibre-native/map-ref.js";
import {
  assertMaplibreLayerStyle,
  assertMaplibreStyleRoots,
} from "./adapters/maplibre-native/style-roots.js";
export type { NativeAdvancedMapRef } from "./adapters/maplibre-native/map-ref.js";
import {
  Map as MaplibreMap,
  Layer as MaplibreLayer,
} from "@maplibre/maplibre-react-native";
import type { Camera as WrapperCamera } from "@maplibre/maplibre-react-native";
import type {
  ComponentProps,
  ComponentRef,
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import type { ViewProps } from "react-native";

import type { NativeControlProps } from "./adapters/shared/native-ui.js";
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
} from "./facade/ui.js";

export { adapter } from "./adapters/maplibre-native/index.js";
export type { NativeControlProps } from "./adapters/shared/native-ui.js";

/** Selected native map with typed renderer facilities and host attributes. */
/** Selected SDK location follow options, applied to the existing camera. */
export type NativeLocationOptions = Pick<
  ComponentProps<typeof WrapperCamera>,
  "trackUserLocation" | "onTrackUserLocationChange"
>;

export interface NativeMapProps extends Omit<MapProps, "mapStyle"> {
  /** Complete selected style document. */
  readonly mapStyle:
    | MapProps["mapStyle"]
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
      readonly hitbox?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
    });
/** Selected source with mutable activation hitbox. */
export const Source = SharedSource as ComponentType<NativeSourceProps>;
export {
  Callout,
  LayerAnnotation,
  MarkerView,
  ViewAnnotation,
} from "./adapters/maplibre-native/ui.js";

/** Corner control with owned native host attributes and style. */
export const Control = SharedControl as ComponentType<NativeControlProps>;

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

/** Selected complete wrapper layer with explicit pinned-native expression boundaries. */
export const Layer = (props: ComponentProps<typeof MaplibreLayer>) => {
  assertMaplibreLayerStyle(props);
  return <MaplibreLayer {...props} />;
};
