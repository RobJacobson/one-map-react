import {
  Camera,
  Map as MaplibreMap,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  useRef,
  useState,
} from "react";
import type { NativeSyntheticEvent } from "react-native";

import type { NativeMapProps } from "../../maplibre-native.js";
import { useNativeMapHandle } from "../index.js";
import {
  type NativeMoveCallbacks,
  moveEventFromNative,
  reportSettledMove,
} from "../shared/index.js";
import { nativeCameraTarget } from "../shared/native-camera-inputs.js";
import { NativeMapHost } from "../shared/native-map-host.js";
import { withNativeMapPresentation } from "../shared/native-map-presentation.js";
import { nativeBoundsInput, nativeClick } from "../shared/native-values.js";
import { useActiveCallbacks } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import { normalizePadding, toFlatBounds } from "../shared/wrapper-values.js";
import {
  toMaplibreInitialViewState,
  toMaplibreViewState,
} from "./convert-camera.js";
import { toMaplibreGestures } from "./convert-gestures.js";
import { createMaplibreMapRef, type NativeAdvancedMapRef } from "./map-ref.js";
import {
  MaplibreSourceContext,
  createMaplibreSourceRegistry,
} from "./source-registry.js";
import { maplibreLightForNative } from "./style-roots.js";
import { useMaplibreMapStyle } from "./use-maplibre-map-style.js";

type MaplibrePressEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onPress"]>
>[0];

type MaplibreRegionEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onRegionIsChanging"]>
>[0];

/** Maplibre-native map that renders MapLibre React Native `Map` with a `Camera` child. */
const MaplibreNativeMapImplementation = forwardRef<
  NativeAdvancedMapRef,
  NativeMapProps & Partial<NativeMoveCallbacks>
>((props, ref) => {
  const mapStyle = useMaplibreMapStyle(props.mapStyle);
  validateMaplibreMapOptions(props);
  const viewState = nativeCameraTarget(props);
  if (viewState && props.locationOptions?.trackUserLocation)
    throw new Error("Selected location follow conflicts with viewState.");
  const {
    initialViewState,
    minZoom,
    maxZoom,
    maxBounds,
    padding,
    style,
    onMove,
    onMoveStart,
    onMoveEnd,
    onClick,
    onLongPress,
    onLoad,
    onStyleLoad,
    onError,
    children,
  } = props;
  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  const mapRef = useRef<ComponentRef<typeof MaplibreMap>>(null);
  // onDidFinishLoadingMap is the signal that MapLibre will apply an
  // imperative stop. Before that, setStop can resolve after the native map
  // drops it. The same callback is the common onLoad event.
  const mapLoaded = useRef(false);
  const sawMove = useRef(false);
  const [sources] = useState(createMaplibreSourceRegistry);
  const frozenViewState = useFrozenValue(initialViewState ?? viewState);
  // One settled native event can report several callbacks; an earlier one may unmount the map.
  const report = useActiveCallbacks({
    onMove,
    onMoveStart,
    onMoveEnd,
    onClick,
    onLongPress,
    onLoad,
    onStyleLoad,
    onStyleData: props.onStyleData,
    onError,
  });
  const gestures = toMaplibreGestures(props);

  useNativeMapHandle(ref, () =>
    createMaplibreMapRef(cameraRef, mapRef, mapLoaded, sources)
  );

  const reportRegion = (
    event: NativeSyntheticEvent<ViewStateChangeEvent>,
    phase: "start" | "change" | "end"
  ) => {
    const nativeEvent = event.nativeEvent;
    const [longitude, latitude] = nativeEvent.center;
    const move = moveEventFromNative(
      longitude,
      latitude,
      nativeEvent.zoom,
      nativeEvent.bearing,
      nativeEvent.pitch,
      nativeEvent.userInteraction
    );

    if (phase === "start") {
      report.onMoveStart(move);
      return;
    }

    if (phase === "change") {
      sawMove.current = true;
      report.onMove(move, nativeEvent.bounds);
      return;
    }

    reportSettledMove(sawMove, move, report, nativeEvent.bounds);
  };
  const controlled = viewState ? toMaplibreViewState(viewState) : undefined;
  const flatMaxBounds =
    maxBounds === undefined
      ? undefined
      : toFlatBounds(nativeBoundsInput(maxBounds));
  const { light: optionLight, ...options } = props.options ?? {};
  const light = maplibreLightForNative(props.light ?? optionLight, {
    omitUndefinedFields: true,
  });

  return (
    <NativeMapHost style={style} hostProps={props.hostProps}>
      <MaplibreSourceContext.Provider value={sources}>
        <MaplibreMap
          {...options}
          light={light}
          ref={mapRef}
          style={{ flex: 1 }}
          mapStyle={mapStyle}
          {...gestures}
          onDidFinishLoadingMap={() => {
            mapLoaded.current = true;
            report.onLoad();
          }}
          onDidFinishLoadingStyle={() => {
            report.onStyleLoad();
            report.onStyleData();
          }}
          onDidFailLoadingMap={() => {
            report.onError({});
          }}
          onRegionWillChange={
            onMoveStart
              ? (event: MaplibreRegionEvent) => {
                  reportRegion(event, "start");
                }
              : undefined
          }
          onRegionIsChanging={(event: MaplibreRegionEvent) => {
            reportRegion(event, "change");
          }}
          onRegionDidChange={(event: MaplibreRegionEvent) => {
            reportRegion(event, "end");
          }}
          onPress={
            onClick
              ? (event: MaplibrePressEvent) => {
                  report.onClick(pressEvent(event.nativeEvent));
                }
              : undefined
          }
          onLongPress={
            onLongPress
              ? (event: MaplibrePressEvent) => {
                  report.onLongPress(pressEvent(event.nativeEvent));
                }
              : undefined
          }
        >
          <Camera
            ref={cameraRef}
            initialViewState={toMaplibreInitialViewState(frozenViewState)}
            minZoom={minZoom}
            maxZoom={maxZoom}
            maxBounds={flatMaxBounds}
            padding={
              padding === undefined ? undefined : normalizePadding(padding)
            }
            {...props.locationOptions}
            {...(controlled ?? {})}
          />
          {children}
        </MaplibreMap>
      </MaplibreSourceContext.Provider>
    </NativeMapHost>
  );
});

/** Rejects portable requests the selected MapLibre native map cannot honor. */
const validateMaplibreMapOptions = (
  props: Pick<NativeMapProps, "terrain" | "projection">
): void => {
  if (props.terrain != null)
    throw new Error("Terrain is unsupported on MapLibre Native.");
  if (props.projection === "globe")
    throw new Error("Globe projection is unsupported on MapLibre Native.");
};

const pressEvent = (nativeEvent: {
  readonly lngLat: readonly [number, number];
  readonly point: readonly [number, number];
  readonly features?: readonly object[];
}) => nativeClick(nativeEvent.lngLat, nativeEvent.point, nativeEvent.features);

/** Selected native map with adapter-owned presentation. */
export const MaplibreNativeMap = withNativeMapPresentation(
  MaplibreNativeMapImplementation
);
