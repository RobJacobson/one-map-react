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
  useLayoutEffect,
  useMemo,
  useRef,
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
import type { ControlPosition } from "../../contracts/ui-types.js";
import { useOptionalMapSession } from "../../facade/map-context.js";
import {
  assertNativeDesktopOptions,
  assertNativeMapOptions,
} from "../native-map-options.js";
import { useNativeOrnamentPositions } from "../shared/native-ornament-position.js";
import { useActiveCallback } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import { normalizePadding } from "../shared/wrapper-values.js";
import {
  mutableFlatBounds,
  toMaplibreControlledCamera,
  toMaplibreInitialViewState,
} from "./convert-camera.js";
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

type MaplibrePressEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onPress"]>
>[0];

type MaplibreRegionEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onRegionIsChanging"]>
>[0];

/** Maplibre-native map that renders MapLibre React Native `Map` with a `Camera` child. */
export const MaplibreNativeMap = forwardRef<
  MapRef,
  MapProps & {
    hostProps?: ViewProps;
    options?: Partial<ComponentProps<typeof MaplibreMap>>;
  }
>((props, ref) => {
  const session = useOptionalMapSession();
  const ornaments = useNativeOrnamentPositions();
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
  const sources = useMemo(() => new MaplibreSourceRegistry(), []);
  const styleKey = JSON.stringify(mapStyle);
  const previousStyle = useRef(styleKey);
  useLayoutEffect(() => {
    if (previousStyle.current !== styleKey) {
      previousStyle.current = styleKey;
      sources.featureState.resetStyle();
    }
  }, [sources, styleKey]);
  const frozenViewState = useFrozenValue(initialViewState);
  const reportMove = useActiveCallback(onMove);
  const reportMoveStart = useActiveCallback(onMoveStart);
  const reportMoveEnd = useActiveCallback(onMoveEnd);
  const reportClick = useActiveCallback(onClick);
  const reportLongPress = useActiveCallback(onLongPress);
  const reportLoad = useActiveCallback(onLoad);
  const reportStyleLoad = useActiveCallback(onStyleLoad);
  const reportError = useActiveCallback(onError);
  const flushFeatureState = useActiveCallback(() => {
    void sources.featureState.flush((error) => reportError({ error }));
  });
  const gestures = toMaplibreGestures({
    interactive,
    dragPan,
    touchZoom,
    touchRotate,
    touchPitch,
    doubleTapZoom,
  });

  const mapHandle = useMemo(
    () => createMaplibreMapRef(cameraRef, mapRef, mapLoaded, sources),
    [sources]
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
      reportMoveStart(move);
      return;
    }

    if (phase === "change") {
      sawMove.current = true;
      reportMove(move);
      return;
    }

    if (!sawMove.current) {
      sawMove.current = true;
      reportMove(move);
    }

    reportMoveEnd(move);
  };
  const controlled = viewState
    ? toMaplibreControlledCamera(viewState)
    : undefined;
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
            {...(session?.ornaments.attribution
              ? {
                  attribution: true,
                }
              : {})}
            ref={mapRef}
            style={{ flex: 1 }}
            mapStyle={mapStyle}
            {...gestures}
            onDidFinishRenderingFrameFully={flushFeatureState}
            onDidFinishLoadingMap={() => {
              mapLoaded.current = true;
              reportLoad();
            }}
            onDidFinishLoadingStyle={() => {
              sources.featureState.resetStyle();
              reportStyleLoad();
            }}
            onDidFailLoadingMap={() => {
              reportError({});
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
                    reportClick(pressEvent(event.nativeEvent));
                  }
                : undefined
            }
            onLongPress={
              onLongPress
                ? (event: MaplibrePressEvent) => {
                    reportLongPress(pressEvent(event.nativeEvent));
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
