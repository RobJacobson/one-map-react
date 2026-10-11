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
import { invokeWrapper } from "./invoke-wrapper.js";
import type { MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

const MapboxNativeMap = forwardRef<MapRef, MapProps>(
  ({ mapStyle, initialViewState, style, onMove, children }, ref) => {
    const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
    const frozenViewState = useFrozenValue(initialViewState);
    const reportMove = useActiveCallback(onMove);
    const styleProps = toRnmapboxStyleProps(mapStyle);

    useImperativeHandle(ref, () => ({
      flyTo: async (options) => {
        const camera = cameraRef.current;

        if (!camera) {
          throw missingCameraError();
        }

        await invokeWrapper(camera.setCamera(toRnmapboxFlyToStop(options)));
      },
    }));

    return (
      <MapView
        // MapLayoutStyle.width is any string, not only a native dimension.
        style={style as StyleProp<ViewStyle>}
        {...styleProps}
        onCameraChanged={(state: MapState) => {
          reportMove(
            moveEventFromRnmapbox(
              state.properties.center,
              state.properties.zoom,
              state.properties.heading,
              state.properties.pitch,
              state.gestures.isGestureActive
            )
          );
        }}
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
