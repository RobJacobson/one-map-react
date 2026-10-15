import { Camera, type MapState, MapView } from "@rnmapbox/maps";
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";

import type { MapRef } from "../../contracts/camera-types.js";
import type { MapErrorEvent, MoveEvent } from "../../contracts/event-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import type { ControlPosition } from "../../contracts/ui-types.js";
import { useOptionalMapSession } from "../../facade/map-context.js";
import type { NativeLocationOptions } from "../../mapbox-native.js";
import {
  assertNativeDesktopOptions,
  assertNativeMapOptions,
} from "../native-map-options.js";
import { useMapCapture } from "../shared/map-capture.js";
import { useNativeOrnamentPositions } from "../shared/native-ornament-position.js";
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
import {
  GeoJsonSourceContext,
  GeoJsonSourceRegistry,
} from "./geojson-source-registry.js";
import { useMapboxGestureSettings } from "./gesture-settings.js";
import { createMapboxMapRef, resetMapboxFeatureState } from "./map-ref.js";
import { mergeGestureSettings, toRnmapboxStyleProps } from "./style-props.js";

type RnPressFeature = Parameters<
  NonNullable<ComponentProps<typeof MapView>["onPress"]>
>[0];

/** Mapbox-native map that renders RNMapbox `MapView` with a `Camera` child. */
export const MapboxNativeMap = forwardRef<
  MapRef,
  MapProps & {
    locationOptions?: NativeLocationOptions;
    hostProps?: ViewProps;
    options?: Partial<ComponentProps<typeof MapView>>;
  }
>((props, ref) => {
  const session = useOptionalMapSession();
  if (props.viewState && props.locationOptions?.followUserLocation)
    throw new Error("Selected location follow conflicts with viewState.");
  const capture = useMapCapture(props.captureEnabled);
  const ornaments = useNativeOrnamentPositions();
  const scaleBarPosition =
    props.options?.scaleBarPosition ??
    (ornaments.managed ? ornaments.position("top-left") : undefined);
  const scalePositionKey = JSON.stringify([
    scaleBarPosition,
    session?.nativeLayout?.width,
    session?.nativeLayout?.height,
  ]);
  const [appliedScalePosition, setAppliedScalePosition] =
    useState(scalePositionKey);
  // RNMapbox iOS stores position updates without marking its scale dirty.
  // Native layout can reset the scale. Separate its hide/restore commits by a
  // frame so Fabric cannot merge away the enabled setter's dirty notification.
  const refreshScalePosition =
    Platform.OS === "ios" &&
    appliedScalePosition !== scalePositionKey &&
    props.options?.scaleBarEnabled !== false;
  useEffect(() => {
    if (!refreshScalePosition) {
      setAppliedScalePosition(scalePositionKey);
      return;
    }
    const frame = requestAnimationFrame(() =>
      setAppliedScalePosition(scalePositionKey)
    );
    return () => cancelAnimationFrame(frame);
  }, [scalePositionKey, refreshScalePosition]);
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
  const geoJsonSources = useMemo(
    () =>
      new GeoJsonSourceRegistry((target) =>
        resetMapboxFeatureState(mapViewRef, target)
      ),
    []
  );
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
  const flushFeatureState = useActiveCallback(() => {
    void geoJsonSources.featureState.flush((error) => reportError({ error }));
  });
  const styleProps = toRnmapboxStyleProps(mapStyle);
  const styleKey = JSON.stringify(styleProps);
  const previousStyle = useRef(styleKey);
  useLayoutEffect(() => {
    if (previousStyle.current !== styleKey) {
      previousStyle.current = styleKey;
      geoJsonSources.featureState.resetStyle();
    }
  }, [geoJsonSources, styleKey]);
  const gestures = toRnmapboxGestures({
    interactive,
    dragPan,
    touchZoom,
    touchRotate,
    touchPitch,
    doubleTapZoom,
  });
  const selectedGestureSettings = mergeGestureSettings(
    props.options?.gestureSettings,
    extraGestureSettings
  );
  // Android's scalar zoomEnabled setter also disables both double-tap variants.
  // A temporary lock needs no synthesized map. Removing it would send null to
  // the pinned Android setter, which unconditionally reads a ReadableMap.
  const portableGestureSettings =
    Platform.OS === "android" &&
    interactive === false &&
    selectedGestureSettings === undefined &&
    doubleTapZoom === undefined
      ? undefined
      : gestures.gestureSettings;
  const gestureSettings = mergeGestureSettings(
    selectedGestureSettings,
    portableGestureSettings
  );

  const mapHandle = useMemo(
    () =>
      createMapboxMapRef(
        cameraRef,
        mapViewRef,
        geoJsonSources,
        async (options) => {
          if (options.scope === "renderer" && Platform.OS === "ios")
            throw new Error(
              "Renderer-only capture is unavailable through RNMapbox iOS view capture. Use scope backend."
            );
          return capture.run(options, async () => {
            const map = mapViewRef.current;
            if (!map) throw new Error("Map is not attached.");
            return map.takeSnap(options.output === "file");
          });
        }
      ),
    [geoJsonSources, capture]
  );
  // Descendant control effects must retain the attached ref during prop updates.
  useImperativeHandle(ref, () => mapHandle, [mapHandle]);

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
    <PortalProvider>
      <View
        {...props.hostProps}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          session?.setNativeLayout(width, height);
          capture.layout(width, height);
          props.hostProps?.onLayout?.(event);
        }}
        // Common width strings cross the native host dimension boundary here.
        style={[style as StyleProp<ViewStyle>, props.hostProps?.style]}
      >
        <GeoJsonSourceContext.Provider value={geoJsonSources}>
          <MapView
            {...props.options}
            logoPosition={
              props.options?.logoPosition ??
              (ornaments.managed
                ? ornaments.position("bottom-left")
                : undefined)
            }
            attributionPosition={
              session?.ornaments.attribution
                ? ornaments.position(
                    session.ornaments.attribution.position as ControlPosition
                  )
                : (props.options?.attributionPosition ??
                  (ornaments.managed
                    ? ornaments.position("bottom-right")
                    : undefined))
            }
            compassPosition={
              props.options?.compassPosition ??
              (ornaments.managed ? ornaments.position("top-right") : undefined)
            }
            scaleBarPosition={scaleBarPosition}
            {...(refreshScalePosition ? { scaleBarEnabled: false } : {})}
            {...(session?.ornaments.attribution
              ? {
                  attributionEnabled: true,
                }
              : {})}
            ref={mapViewRef}
            style={{ flex: 1 }}
            {...styleProps}
            {...gestures}
            {...(Platform.OS === "android"
              ? {
                  // Unlike the other flags, the wrapper has no zoom default.
                  // Restore its enabled baseline instead of clearing to null.
                  zoomEnabled:
                    gestures.zoomEnabled ?? props.options?.zoomEnabled ?? true,
                }
              : {})}
            gestureSettings={gestureSettings}
            onDidFinishRenderingFrameFully={() => {
              capture.frame();
              flushFeatureState();
            }}
            onDidFinishLoadingMap={() => {
              reportLoad();
            }}
            onDidFinishLoadingStyle={() => {
              // Native style diffing can retain source state. Invalidate before
              // the callback so writes it makes belong to the loaded style.
              geoJsonSources.featureState.resetStyle();
              reportStyleLoad();
            }}
            onMapLoadingError={(payload: unknown) => {
              const event = mapLoadingErrorEvent(payload);
              capture.fail(event.error);
              reportError(event);
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
              padding={
                padding === undefined ? undefined : toRnmapboxPadding(padding)
              }
              {...props.locationOptions}
              {...(controlled ?? {})}
            />
            {children}
          </MapView>
        </GeoJsonSourceContext.Provider>
        {session && (
          <PortalHost
            name={session.overlayHostName}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
        )}
      </View>
    </PortalProvider>
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
