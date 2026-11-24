import { Camera, Light, Terrain, type MapState, MapView } from "@rnmapbox/maps";
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import type { MapErrorEvent, MoveEvent } from "../../contracts/event-types.js";
import type { NativeMapProps } from "../../mapbox-native.js";
import {
  type NativeMoveCallbacks,
  type NativeViewportBounds,
  reportSettledMove,
} from "../shared/index.js";
import { nativeCameraTarget } from "../shared/native-camera-inputs.js";
import { NativeMapHost } from "../shared/native-map-host.js";
import {
  useNativeMapPresentation,
  withNativeMapPresentation,
} from "../shared/native-map-presentation.js";
import { nativeBoundsInput } from "../shared/native-values.js";
import { useActiveCallbacks } from "../shared/use-active-callback.js";
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
  createGeoJsonSourceRegistry,
} from "./geojson-source-registry.js";
import { useMapboxGestureSettings } from "./gesture-settings.js";
import { createMapboxMapRef, type NativeAdvancedMapRef } from "./map-ref.js";
import { mergeGestureSettings, toRnmapboxStyleProps } from "./style-props.js";
import { useMapboxScalePosition } from "./use-mapbox-scale-position.js";

type RnPressFeature = Parameters<
  NonNullable<ComponentProps<typeof MapView>["onPress"]>
>[0];

/** Mapbox-native map that renders RNMapbox `MapView` with a `Camera` child. */
const MapboxNativeMapImplementation = forwardRef<
  NativeAdvancedMapRef,
  NativeMapProps & Partial<NativeMoveCallbacks>
>((props, ref) => {
  const session = useNativeMapPresentation();
  const viewState = nativeCameraTarget(props);
  if (viewState && props.locationOptions?.followUserLocation)
    throw new Error("Selected location follow conflicts with viewState.");
  const scaleBarPosition = props.options?.scaleBarPosition;
  const refreshScalePosition = useMapboxScalePosition(
    scaleBarPosition,
    session.nativeLayout?.width,
    session.nativeLayout?.height,
    props.options?.scaleBarEnabled
  );
  const {
    mapStyle,
    initialViewState,
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
    children,
  } = props;
  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  const mapViewRef = useRef<ComponentRef<typeof MapView>>(null);
  const sawMove = useRef(false);
  const [geoJsonSources] = useState(createGeoJsonSourceRegistry);
  const frozenViewState = useFrozenValue(initialViewState ?? viewState);
  const extraGestureSettings = useMapboxGestureSettings();
  // RNMapbox class event handlers read this.props, including props from a suspended render.
  const report = useActiveCallbacks({
    onMove,
    onMoveEnd,
    onIdle,
    onClick,
    onLongPress,
    onLoad,
    onStyleLoad,
    onStyleData: props.onStyleData,
    onError,
  });
  const styleProps = toRnmapboxStyleProps(mapStyle);
  const gestures = toRnmapboxGestures(props);
  const selectedGestureSettings = mergeGestureSettings(
    props.options?.gestureSettings,
    extraGestureSettings
  );
  // Android's scalar zoomEnabled setter also disables both double-tap variants.
  // A temporary lock needs no synthesized map. Removing it would send null to
  // the pinned Android setter, which unconditionally reads a ReadableMap.
  const portableGestureSettings =
    Platform.OS === "android" &&
    props.interactive === false &&
    selectedGestureSettings === undefined &&
    props.doubleTapZoom === undefined
      ? undefined
      : gestures.gestureSettings;
  const gestureSettings = mergeGestureSettings(
    selectedGestureSettings,
    portableGestureSettings
  );

  const mapHandle = useRef<NativeAdvancedMapRef | null>(null);
  useImperativeHandle(ref, () => {
    // Keep the attachment identity when a callback ref changes mid-query.
    if (mapHandle.current === null) {
      mapHandle.current = createMapboxMapRef(
        cameraRef,
        mapViewRef,
        geoJsonSources
      );
    }
    return mapHandle.current;
  }, [geoJsonSources]);

  const reportChanging = (state: MapState) => {
    sawMove.current = true;
    const event = moveFromState(state);
    report.onMove(event, viewportBoundsFromState(state));
  };
  const reportSettled = (state: MapState) => {
    const event = moveFromState(state);
    reportSettledMove(sawMove, event, report, viewportBoundsFromState(state));
    report.onIdle();
  };
  const controlled = viewState
    ? toRnmapboxControlledCamera(viewState)
    : undefined;

  return (
    <NativeMapHost style={style} hostProps={props.hostProps}>
      <GeoJsonSourceContext.Provider value={geoJsonSources}>
        <MapView
          {...props.options}
          projection={props.projection ?? props.options?.projection}
          scaleBarPosition={scaleBarPosition}
          {...(refreshScalePosition ? { scaleBarEnabled: false } : {})}
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
          onDidFinishLoadingMap={() => {
            report.onLoad();
          }}
          onDidFinishLoadingStyle={() => {
            report.onStyleLoad();
            report.onStyleData();
          }}
          onMapLoadingError={(payload: unknown) => {
            const event = mapLoadingErrorEvent(payload);
            report.onError(event);
          }}
          onCameraChanged={reportChanging}
          onMapIdle={reportSettled}
          onPress={
            onClick
              ? (feature: RnPressFeature) => {
                  report.onClick(clickEventFromRnmapbox(feature));
                }
              : undefined
          }
          onLongPress={
            onLongPress
              ? (feature: RnPressFeature) => {
                  report.onLongPress(clickEventFromRnmapbox(feature));
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
                : toRnmapboxCornerBounds(nativeBoundsInput(maxBounds))
            }
            padding={
              padding === undefined ? undefined : toRnmapboxPadding(padding)
            }
            {...props.locationOptions}
            {...(controlled ?? {})}
          />
          {children}
          {props.terrain !== undefined && (
            <Terrain
              key={
                props.terrain === null
                  ? "disabled"
                  : `enabled:${props.terrain.source}`
              }
              sourceID={props.terrain?.source}
              style={{ exaggeration: props.terrain?.exaggeration }}
            />
          )}
          {props.light && (
            <Light
              style={{
                anchor: props.light.anchor,
                color: props.light.color,
                intensity: props.light.intensity,
                position:
                  props.light.position === undefined
                    ? undefined
                    : [...props.light.position],
                colorTransition: props.light["color-transition"],
                intensityTransition: props.light["intensity-transition"],
                positionTransition: props.light["position-transition"],
              }}
            />
          )}
        </MapView>
      </GeoJsonSourceContext.Provider>
    </NativeMapHost>
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

const viewportBoundsFromState = (
  state: MapState
): NativeViewportBounds | undefined => {
  const bounds = state.properties.bounds;
  if (!bounds?.sw || !bounds.ne) return undefined;
  const { sw, ne } = bounds;
  return [sw[0], sw[1], ne[0], ne[1]];
};

/**
 * Copies the error string RNMapbox passes at runtime.
 *
 * The wrapper supplies a structured payload on both platforms. The common
 * event carries the error field.
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

/** Selected native map with adapter-owned presentation. */
export const MapboxNativeMap = withNativeMapPresentation(
  MapboxNativeMapImplementation
);
