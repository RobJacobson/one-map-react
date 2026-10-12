import { Camera, type MapState, MapView } from "@rnmapbox/maps";
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { MapRef } from "../../contracts/camera-types.js";
import type { MapErrorEvent, MoveEvent } from "../../contracts/event-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import {
  assertNativeDesktopOptions,
  assertNativeMapOptions,
} from "../native-map-options.js";
import { useActiveCallback } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import {
  toRnmapboxControlledCamera,
  toRnmapboxCornerBounds,
  toRnmapboxDefaultSettings,
  toRnmapboxPadding,
} from "./convert-camera.js";
import { toRnmapboxGestures } from "./convert-gestures.js";
import {
  clickEventFromRnmapbox,
  moveEventFromRnmapbox,
} from "./convert-move-event.js";
import { useMapboxGestureSettings } from "./gesture-settings.js";
import { createMapboxMapRef } from "./map-ref.js";
import { mergeGestureSettings, toRnmapboxStyleProps } from "./style-props.js";

type RnPressFeature = Parameters<
  NonNullable<ComponentProps<typeof MapView>["onPress"]>
>[0];

/** Mapbox-native map that renders RNMapbox `MapView` with a `Camera` child. */
export const MapboxNativeMap = forwardRef<MapRef, MapProps>((props, ref) => {
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
  const extraGestureSettings = useMapboxGestureSettings();
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
