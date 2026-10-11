import {
  Camera,
  GeoJSONSource,
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import {
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";

import type { Adapter } from "./adapter.js";
import type { MapRef } from "./camera-types.js";
import {
  toMaplibreFlyToOptions,
  toMaplibreInitialViewState,
} from "./convert-camera.js";
import { moveEventFromMaplibreNative } from "./convert-move-event.js";
import { invokeWrapper } from "./invoke-wrapper.js";
import type { MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

const MaplibreNativeMap = forwardRef<MapRef, MapProps>(
  ({ mapStyle, initialViewState, style, onMove, children }, ref) => {
    const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
    // Style load is the public signal that MapLibre will apply an imperative
    // stop. Before that, setStop can resolve after the native map drops it.
    const mapLoaded = useRef(false);
    const frozenViewState = useFrozenValue(initialViewState);
    const reportMove = useActiveCallback(onMove);

    useImperativeHandle(ref, () => ({
      flyTo: async (options) => {
        const camera = cameraRef.current;

        if (!camera || !mapLoaded.current) {
          throw missingCameraError();
        }

        await invokeWrapper(camera.flyTo(toMaplibreFlyToOptions(options)));
      },
    }));

    return (
      <MaplibreMap
        // MapLayoutStyle.width is any string, not only a native dimension.
        style={style as StyleProp<ViewStyle>}
        mapStyle={mapStyle}
        onDidFinishLoadingMap={() => {
          mapLoaded.current = true;
        }}
        onRegionIsChanging={(
          event: NativeSyntheticEvent<ViewStateChangeEvent>
        ) => {
          const nativeEvent = event.nativeEvent;

          reportMove(
            moveEventFromMaplibreNative(
              nativeEvent.center,
              nativeEvent.zoom,
              nativeEvent.bearing,
              nativeEvent.pitch,
              nativeEvent.userInteraction
            )
          );
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={toMaplibreInitialViewState(frozenViewState)}
        />
        {children}
      </MaplibreMap>
    );
  }
);

const MaplibreNativeSource = ({ id, data, children }: SourceProps) => (
  <GeoJSONSource id={id} data={data}>
    {children}
  </GeoJSONSource>
);

const MaplibreNativeLayer = ({ id, paint, layout, source }: LayerProps) => (
  <MaplibreLayer
    id={id}
    type="line"
    source={source}
    paint={paint}
    layout={layout}
  />
);

/** Selects maplibre-native and translates MapLibre React Native components. */
export const adapter: Adapter & { readonly backend: "maplibre-native" } = {
  backend: "maplibre-native",
  Map: MaplibreNativeMap,
  Source: MaplibreNativeSource,
  Layer: MaplibreNativeLayer,
};
