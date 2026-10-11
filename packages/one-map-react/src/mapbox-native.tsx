import {
  Camera,
  CameraGestureObserver,
  LineLayer,
  type MapState,
  MapView,
  ShapeSource,
} from "@rnmapbox/maps";
import {
  type ComponentProps,
  type ComponentRef,
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useImperativeHandle,
  useRef,
} from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { Adapter } from "./adapter.js";
import type { LngLat, MapRef, Point } from "./camera-types.js";
import {
  boundsFromRnmapboxVisible,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
  toRnmapboxControlledCamera,
  toRnmapboxCornerBounds,
  toRnmapboxDefaultSettings,
  toRnmapboxFitBoundsStop,
  toRnmapboxFlyToStop,
  toRnmapboxPadding,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "./convert-camera.js";
import { toRnmapboxGestures } from "./convert-gestures.js";
import { toRnmapboxLineStyle } from "./convert-line-style.js";
import { toRnmapboxStyleProps } from "./convert-map-style.js";
import {
  clickEventFromRnmapbox,
  moveEventFromRnmapbox,
} from "./convert-move-event.js";
import type { MapErrorEvent, MoveEvent } from "./event-types.js";
import { invokeWrapper } from "./invoke-wrapper.js";
import type { MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import {
  assertNativeDesktopOptions,
  assertNativeMapOptions,
  nativeResizeError,
  nativeStopError,
  unavailableMapMethodError,
} from "./native-map-options.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

/**
 * RNMapbox touch-gesture settings.
 *
 * This is the wrapper's `gestureSettings` object. It is not a common map prop.
 * Supply it with {@link MapboxGestureSettings} around a mapbox-native map.
 */
export type GestureSettings = NonNullable<
  ComponentProps<typeof MapView>["gestureSettings"]
>;

const MapboxGestureSettingsContext = createContext<GestureSettings | undefined>(
  undefined
);

/**
 * Supplies RNMapbox `gestureSettings` to the mapbox-native map inside it.
 *
 * Common `doubleTapZoom` overwrites the double-tap fields from `settings`.
 * Another adapter does not read this context.
 *
 * @param props - Settings and the map tree that should receive them.
 * @returns The children under the settings context.
 */
export const MapboxGestureSettings = ({
  settings,
  children,
}: {
  /** RNMapbox gesture settings applied to the enclosing mapbox-native map. */
  readonly settings: GestureSettings;
  /** Map tree rendered with those settings. */
  readonly children?: ReactNode;
}) => (
  <MapboxGestureSettingsContext.Provider value={settings}>
    {children}
  </MapboxGestureSettingsContext.Provider>
);

export { CameraGestureObserver };

type RnPressFeature = Parameters<
  NonNullable<ComponentProps<typeof MapView>["onPress"]>
>[0];

const MapboxNativeMap = forwardRef<MapRef, MapProps>((props, ref) => {
  const {
    mapStyle,
    initialViewState,
    viewState,
    minZoom,
    maxZoom,
    maxBounds,
    padding,
    style,
    onMove,
    onMoveEnd,
    onIdle,
    onClick,
    onLongPress,
    onLoad,
    onStyleLoad,
    onError,
    reuseMaps,
    gl,
    interactive,
    dragPan,
    touchZoom,
    touchRotate,
    touchPitch,
    doubleTapZoom,
    children,
  } = props;
  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  const mapViewRef = useRef<ComponentRef<typeof MapView>>(null);
  const sawMove = useRef(false);
  const frozenViewState = useFrozenValue(initialViewState);
  const extraGestureSettings = useContext(MapboxGestureSettingsContext);
  const reportMove = useActiveCallback(onMove);
  const reportMoveEnd = useActiveCallback(onMoveEnd);
  const reportIdle = useActiveCallback(onIdle);
  const reportClick = useActiveCallback(onClick);
  const reportLongPress = useActiveCallback(onLongPress);
  const reportLoad = useActiveCallback(onLoad);
  const reportStyleLoad = useActiveCallback(onStyleLoad);
  const reportError = useActiveCallback(onError);
  const styleProps = toRnmapboxStyleProps(mapStyle);
  const gestures = toRnmapboxGestures({
    interactive,
    dragPan,
    touchZoom,
    touchRotate,
    touchPitch,
    doubleTapZoom,
  });
  const gestureSettings = mergeGestureSettings(
    extraGestureSettings,
    gestures.gestureSettings
  );

  useImperativeHandle(ref, () => createMapboxMapRef(cameraRef, mapViewRef));

  assertNativeMapOptions(reuseMaps, gl);
  assertNativeDesktopOptions(props);

  const reportChanging = (state: MapState) => {
    sawMove.current = true;
    reportMove(moveFromState(state));
  };
  const reportSettled = (state: MapState) => {
    const event = moveFromState(state);

    if (!sawMove.current) {
      sawMove.current = true;
      reportMove(event);
    }

    reportMoveEnd(event);
    reportIdle();
  };
  const controlled = viewState
    ? toRnmapboxControlledCamera(viewState)
    : undefined;

  return (
    <MapView
      ref={mapViewRef}
      // MapLayoutStyle.width is any string, not only a native dimension.
      style={style as StyleProp<ViewStyle>}
      {...styleProps}
      {...gestures}
      gestureSettings={gestureSettings}
      onDidFinishLoadingMap={() => {
        reportLoad();
      }}
      onDidFinishLoadingStyle={() => {
        reportStyleLoad();
      }}
      onMapLoadingError={(payload: unknown) => {
        reportError(mapLoadingErrorEvent(payload));
      }}
      onCameraChanged={reportChanging}
      onMapIdle={reportSettled}
      onPress={
        onClick
          ? (feature: RnPressFeature) => {
              reportClick(clickEventFromRnmapbox(feature));
            }
          : undefined
      }
      onLongPress={
        onLongPress
          ? (feature: RnPressFeature) => {
              reportLongPress(clickEventFromRnmapbox(feature));
            }
          : undefined
      }
    >
      <Camera
        ref={cameraRef}
        defaultSettings={toRnmapboxDefaultSettings(frozenViewState)}
        minZoomLevel={minZoom}
        maxZoomLevel={maxZoom}
        maxBounds={
          maxBounds === undefined
            ? undefined
            : toRnmapboxCornerBounds(maxBounds)
        }
        padding={padding === undefined ? undefined : toRnmapboxPadding(padding)}
        {...(controlled ?? {})}
      />
      {children}
    </MapView>
  );
});

const MapboxNativeSource = ({ id, data, children }: SourceProps) => (
  <ShapeSource id={id} shape={data}>
    {children}
  </ShapeSource>
);

const MapboxNativeLayer = ({ id, paint, layout, sourceID }: LayerProps) => (
  <LineLayer
    id={id}
    sourceID={sourceID}
    style={toRnmapboxLineStyle(paint, layout)}
  />
);

/** Selects mapbox-native and translates RNMapbox components. */
export const adapter: Adapter & { readonly backend: "mapbox-native" } = {
  backend: "mapbox-native",
  Map: MapboxNativeMap,
  Source: MapboxNativeSource,
  Layer: MapboxNativeLayer,
};

const createMapboxMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapViewRef: { readonly current: ComponentRef<typeof MapView> | null }
): MapRef => ({
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxStop(options, "none")));
  },
  easeTo: async (options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxStop(options, "easeTo")));
  },
  flyTo: async (options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxFlyToStop(options)));
  },
  fitBounds: async (bounds, options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(
      camera.setCamera(toRnmapboxFitBoundsStop(bounds, options))
    );
  },
  zoomTo: async (zoom, options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxZoomStop(zoom, options)));
  },
  stop: async () => {
    throw nativeStopError();
  },
  getCenter: async () =>
    lngLatFromWrapper(await requireMap(mapViewRef.current).getCenter()),
  getZoom: async () =>
    finiteNumber(await requireMap(mapViewRef.current).getZoom()),
  getBearing: async () => {
    throw unavailableMapMethodError("getBearing", "mapbox-native");
  },
  getPitch: async () => {
    throw unavailableMapMethodError("getPitch", "mapbox-native");
  },
  getPadding: async () => {
    throw unavailableMapMethodError("getPadding", "mapbox-native");
  },
  getBounds: async () =>
    boundsFromRnmapboxVisible(
      await requireMap(mapViewRef.current).getVisibleBounds()
    ),
  getMinZoom: async () => {
    throw unavailableMapMethodError("getMinZoom", "mapbox-native");
  },
  getMaxZoom: async () => {
    throw unavailableMapMethodError("getMaxZoom", "mapbox-native");
  },
  getMaxBounds: async () => {
    throw unavailableMapMethodError("getMaxBounds", "mapbox-native");
  },
  project: async (lngLat) =>
    pointFromWrapper(
      await requireMap(mapViewRef.current).getPointInView(mutablePair(lngLat))
    ),
  unproject: async (point) =>
    lngLatFromWrapper(
      await requireMap(mapViewRef.current).getCoordinateFromView(
        mutablePair(point)
      )
    ),
  resize: async () => {
    throw nativeResizeError();
  },
});

const requireCamera = (
  camera: ComponentRef<typeof Camera> | null
): NonNullable<ComponentRef<typeof Camera>> => {
  if (!camera) {
    throw missingCameraError();
  }

  return camera;
};

const requireMap = (
  map: ComponentRef<typeof MapView> | null
): NonNullable<ComponentRef<typeof MapView>> => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
};

const finiteNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Map zoom must be a finite number.");
  }

  return value;
};

const mutablePair = (value: LngLat | Point): number[] => [value[0], value[1]];

const mergeGestureSettings = (
  extra: GestureSettings | undefined,
  doubleTap: GestureSettings | undefined
): GestureSettings | undefined => {
  if (extra === undefined && doubleTap === undefined) {
    return undefined;
  }

  return { ...extra, ...doubleTap };
};

const moveFromState = (state: MapState): MoveEvent =>
  moveEventFromRnmapbox(
    state.properties.center,
    state.properties.zoom,
    state.properties.heading,
    state.properties.pitch,
    state.gestures.isGestureActive
  );

/**
 * Copies the error string RNMapbox passes at runtime.
 *
 * The public callback type takes no argument. iOS still delivers
 * `{ error, tileId?, sourceId? }`. Android registers that listener through
 * the pinned v11 compat `MapboxMap.subscribe`, whose body is empty, so a
 * load failure never reaches this helper. Tile and source ids stay out of
 * the common event. Drop the Android sentence when a pinned release both
 * subscribes to `MapLoadingError` and passes `error`.
 *
 * @param payload - Decoded native event, when the bridge included one.
 * @returns The common error event, or an empty event when `error` is absent.
 */
const mapLoadingErrorEvent = (payload: unknown): MapErrorEvent => {
  if (!isRecord(payload) || !("error" in payload)) {
    return {};
  }

  return { error: payload.error };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
