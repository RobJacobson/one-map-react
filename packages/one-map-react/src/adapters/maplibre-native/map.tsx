import {
  Camera,
  Map as MaplibreMap,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  type NativeSyntheticEvent,
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";

import type { MapRef } from "../../contracts/camera-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import type { NativeLocationOptions } from "../../maplibre-native.js";
import {
  assertNativeDesktopOptions,
  assertNativeMapOptions,
} from "../native-map-options.js";
import {
  useNativeMapPresentation,
  withNativeMapPresentation,
} from "../shared/native-map-presentation.js";
import { useActiveCallbacks } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import { normalizePadding } from "../shared/wrapper-values.js";
import { mutableFlatBounds, toMaplibreViewState } from "./convert-camera.js";
import { toMaplibreGestures } from "./convert-gestures.js";
import {
  clickEventFromMaplibreNative,
  moveEventFromMaplibreNative,
} from "./convert-move-event.js";
import { createMaplibreMapRef } from "./map-ref.js";
import {
  MaplibreSourceContext,
  MaplibreSourceRegistry,
} from "./source-registry.js";
import { assertMaplibreStyleRoots } from "./style-roots.js";

type MaplibrePressEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onPress"]>
>[0];

type MaplibreRegionEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onRegionIsChanging"]>
>[0];

/** Maplibre-native map that renders MapLibre React Native `Map` with a `Camera` child. */
const MaplibreNativeMapImplementation = forwardRef<
  MapRef,
  MapProps & {
    locationOptions?: NativeLocationOptions;
    hostProps?: ViewProps;
    options?: Partial<ComponentProps<typeof MaplibreMap>>;
  }
>((props, ref) => {
  assertMaplibreStyleRoots(props.mapStyle);
  const session = useNativeMapPresentation();
  validateMaplibreMapOptions(props);
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
    onMoveStart,
    onMoveEnd,
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
  const mapRef = useRef<ComponentRef<typeof MaplibreMap>>(null);
  // onDidFinishLoadingMap is the signal that MapLibre will apply an
  // imperative stop. Before that, setStop can resolve after the native map
  // drops it. The same callback is the common onLoad event.
  const mapLoaded = useRef(false);
  const sawMove = useRef(false);
  const [sources] = useState(() => new MaplibreSourceRegistry());
  const frozenViewState = useFrozenValue(initialViewState);
  // One settled native event can report several callbacks; an earlier one may unmount the map.
  const report = useActiveCallbacks({ onMove, onMoveEnd });
  const gestures = toMaplibreGestures({
    interactive,
    dragPan,
    touchZoom,
    touchRotate,
    touchPitch,
    doubleTapZoom,
  });

  const [mapHandle] = useState(
    // eslint-disable-next-line react/refs -- This lazy initializer only captures refs; commands dereference them after attachment.
    () =>
      createMaplibreMapRef(
        // eslint-disable-next-line react/refs -- The map-handle factory captures refs without reading them; only later imperative commands dereference them.
        cameraRef,
        // eslint-disable-next-line react/refs -- The map-handle factory captures refs without reading them; only later imperative commands dereference them.
        mapRef,
        // eslint-disable-next-line react/refs -- The map-handle factory captures refs without reading them; only later imperative commands dereference them.
        mapLoaded,
        sources
      )
  );
  // Descendant control effects must retain the attached ref during prop updates.
  useImperativeHandle(ref, () => mapHandle, [mapHandle]);

  assertNativeMapOptions(reuseMaps, gl);
  assertNativeDesktopOptions(props);

  const reportRegion = (
    event: NativeSyntheticEvent<ViewStateChangeEvent>,
    phase: "start" | "change" | "end"
  ) => {
    const nativeEvent = event.nativeEvent;
    const move = moveEventFromMaplibreNative(
      nativeEvent.center,
      nativeEvent.zoom,
      nativeEvent.bearing,
      nativeEvent.pitch,
      nativeEvent.userInteraction
    );

    if (phase === "start") {
      onMoveStart?.(move);
      return;
    }

    if (phase === "change") {
      sawMove.current = true;
      report.onMove(move);
      return;
    }

    if (!sawMove.current) {
      sawMove.current = true;
      report.onMove(move);
    }

    report.onMoveEnd(move);
  };
  const controlled = viewState ? toMaplibreViewState(viewState) : undefined;
  const flatMaxBounds =
    maxBounds === undefined ? undefined : mutableFlatBounds(maxBounds);

  return (
    <PortalProvider>
      <View
        {...props.hostProps}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          session?.setNativeLayout(width, height);
          props.hostProps?.onLayout?.(event);
        }}
        // Common width strings cross the native host dimension boundary here.
        style={[style as StyleProp<ViewStyle>, props.hostProps?.style]}
      >
        <MaplibreSourceContext.Provider value={sources}>
          <MaplibreMap
            {...props.options}
            light={
              props.light
                ? {
                    ...props.light,
                    position: props.light.position
                      ? [...props.light.position]
                      : undefined,
                  }
                : props.options?.light
            }
            ref={mapRef}
            style={{ flex: 1 }}
            mapStyle={
              mapStyle as ComponentProps<typeof MaplibreMap>["mapStyle"]
            }
            {...gestures}
            onDidFinishLoadingMap={() => {
              mapLoaded.current = true;
              onLoad?.();
            }}
            onDidFinishLoadingStyle={() => {
              onStyleLoad?.();
            }}
            onDidFailLoadingMap={() => {
              onError?.({});
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
                    onClick?.(pressEvent(event.nativeEvent));
                  }
                : undefined
            }
            onLongPress={
              onLongPress
                ? (event: MaplibrePressEvent) => {
                    onLongPress?.(pressEvent(event.nativeEvent));
                  }
                : undefined
            }
          >
            <Camera
              ref={cameraRef}
              initialViewState={toMaplibreViewState(frozenViewState)}
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

/** Rejects portable requests the selected MapLibre native map cannot honor. */
const validateMaplibreMapOptions = (
  props: MapProps & { readonly locationOptions?: NativeLocationOptions }
): void => {
  if (props.terrain != null)
    throw new Error("Terrain is unsupported on MapLibre Native.");
  if (props.projection === "globe")
    throw new Error("Globe projection is unsupported on MapLibre Native.");
  if (props.viewState && props.locationOptions?.trackUserLocation)
    throw new Error("Selected location follow conflicts with viewState.");
};

const pressEvent = (nativeEvent: {
  readonly lngLat: readonly [number, number];
  readonly point: readonly [number, number];
  readonly features?: readonly object[];
}) =>
  clickEventFromMaplibreNative(
    nativeEvent.lngLat,
    nativeEvent.point,
    nativeEvent.features
  );

/** Selected native map with adapter-owned presentation. */
export const MaplibreNativeMap = withNativeMapPresentation(
  MaplibreNativeMapImplementation
);
