import {
  Camera,
  LineLayer,
  type MapState,
  MapView,
  ShapeSource,
} from "@rnmapbox/maps";
import {
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { Adapter } from "./adapter.js";
import type { MapRef } from "./camera-types.js";
import {
  toRnmapboxDefaultSettings,
  toRnmapboxFlyToStop,
} from "./convert-camera.js";
import { toRnmapboxLineStyle } from "./convert-line-style.js";
import { toRnmapboxStyleProps } from "./convert-map-style.js";
import { moveEventFromRnmapbox } from "./convert-move-event.js";
import type { MapErrorEvent } from "./event-types.js";
import { invokeWrapper } from "./invoke-wrapper.js";
import type { MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import {
  assertNativeMapOptions,
  nativeResizeError,
} from "./native-map-options.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

const MapboxNativeMap = forwardRef<MapRef, MapProps>(
  (
    {
      mapStyle,
      initialViewState,
      style,
      onMove,
      onLoad,
      onStyleLoad,
      onError,
      reuseMaps,
      gl,
      children,
    },
    ref
  ) => {
    const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
    const frozenViewState = useFrozenValue(initialViewState);
    const reportMove = useActiveCallback(onMove);
    const reportLoad = useActiveCallback(onLoad);
    const reportStyleLoad = useActiveCallback(onStyleLoad);
    const reportError = useActiveCallback(onError);
    const styleProps = toRnmapboxStyleProps(mapStyle);

    useImperativeHandle(ref, () => ({
      flyTo: async (options) => {
        const camera = cameraRef.current;

        if (!camera) {
          throw missingCameraError();
        }

        await invokeWrapper(camera.setCamera(toRnmapboxFlyToStop(options)));
      },
      resize: async () => {
        throw nativeResizeError();
      },
    }));

    assertNativeMapOptions(reuseMaps, gl);

    const reportCamera = (state: MapState) => {
      reportMove(
        moveEventFromRnmapbox(
          state.properties.center,
          state.properties.zoom,
          state.properties.heading,
          state.properties.pitch,
          state.gestures.isGestureActive
        )
      );
    };

    return (
      <MapView
        // MapLayoutStyle.width is any string, not only a native dimension.
        style={style as StyleProp<ViewStyle>}
        {...styleProps}
        onDidFinishLoadingMap={() => {
          reportLoad();
        }}
        onDidFinishLoadingStyle={() => {
          reportStyleLoad();
        }}
        onMapLoadingError={(payload: unknown) => {
          reportError(mapLoadingErrorEvent(payload));
        }}
        onCameraChanged={reportCamera}
        onMapIdle={reportCamera}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={toRnmapboxDefaultSettings(frozenViewState)}
        />
        {children}
      </MapView>
    );
  }
);

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
