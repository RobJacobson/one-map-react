import {
  Camera,
  GeoJSONSource,
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";

import type { Adapter } from "./adapter.js";
import type { MapRef } from "./camera-types.js";
import {
  boundsFromFlat,
  lngLatFromWrapper,
  normalizePadding,
  pointFromWrapper,
  rejectJumpTiming,
  toFlatBounds,
  toMaplibreCommand,
  toMaplibreControlledCamera,
  toMaplibreFitBoundsOptions,
  toMaplibreFlyToOptions,
  toMaplibreInitialViewState,
} from "./convert-camera.js";
import { toMaplibreGestures } from "./convert-gestures.js";
import {
  clickEventFromMaplibreNative,
  moveEventFromMaplibreNative,
} from "./convert-move-event.js";
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

type MaplibrePressEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onPress"]>
>[0];

type MaplibreRegionEvent = Parameters<
  NonNullable<ComponentProps<typeof MaplibreMap>["onRegionIsChanging"]>
>[0];

const MaplibreNativeMap = forwardRef<MapRef, MapProps>((props, ref) => {
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
  const frozenViewState = useFrozenValue(initialViewState);
  const reportMove = useActiveCallback(onMove);
  const reportMoveStart = useActiveCallback(onMoveStart);
  const reportMoveEnd = useActiveCallback(onMoveEnd);
  const reportClick = useActiveCallback(onClick);
  const reportLongPress = useActiveCallback(onLongPress);
  const reportLoad = useActiveCallback(onLoad);
  const reportStyleLoad = useActiveCallback(onStyleLoad);
  const reportError = useActiveCallback(onError);
  const gestures = toMaplibreGestures({
    interactive,
    dragPan,
    touchZoom,
    touchRotate,
    touchPitch,
    doubleTapZoom,
  });

  useImperativeHandle(ref, () =>
    createMaplibreMapRef(cameraRef, mapRef, mapLoaded)
  );

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
    <MaplibreMap
      ref={mapRef}
      // MapLayoutStyle.width is any string, not only a native dimension.
      style={style as StyleProp<ViewStyle>}
      mapStyle={mapStyle}
      {...gestures}
      onDidFinishLoadingMap={() => {
        mapLoaded.current = true;
        reportLoad();
      }}
      onDidFinishLoadingStyle={() => {
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
        padding={padding === undefined ? undefined : normalizePadding(padding)}
        {...(controlled ?? {})}
      />
      {children}
    </MaplibreMap>
  );
});

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

const createMaplibreMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapRef: { readonly current: ComponentRef<typeof MaplibreMap> | null },
  mapLoaded: { readonly current: boolean }
): MapRef => ({
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(camera.jumpTo(toMaplibreCommand(options)));
  },
  easeTo: async (options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(camera.easeTo(toMaplibreCommand(options)));
  },
  flyTo: async (options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(camera.flyTo(toMaplibreFlyToOptions(options)));
  },
  fitBounds: async (bounds, options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(
      camera.fitBounds(
        mutableFlatBounds(bounds),
        toMaplibreFitBoundsOptions(options)
      )
    );
  },
  zoomTo: async (zoom, options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(
      camera.zoomTo(zoom, options ? toMaplibreCommand(options) : undefined)
    );
  },
  stop: async () => {
    throw nativeStopError();
  },
  getCenter: async () =>
    lngLatFromWrapper(await requireMap(mapRef.current).getCenter()),
  getZoom: async () => finiteNumber(await requireMap(mapRef.current).getZoom()),
  getBearing: async () =>
    finiteNumber(await requireMap(mapRef.current).getBearing()),
  getPitch: async () =>
    finiteNumber(await requireMap(mapRef.current).getPitch()),
  getPadding: async () => {
    throw unavailableMapMethodError("getPadding", "maplibre-native");
  },
  getBounds: async () =>
    boundsFromFlat(await requireMap(mapRef.current).getBounds()),
  getMinZoom: async () => {
    throw unavailableMapMethodError("getMinZoom", "maplibre-native");
  },
  getMaxZoom: async () => {
    throw unavailableMapMethodError("getMaxZoom", "maplibre-native");
  },
  getMaxBounds: async () => {
    throw unavailableMapMethodError("getMaxBounds", "maplibre-native");
  },
  project: async (lngLat) =>
    pointFromWrapper(
      await requireMap(mapRef.current).project([lngLat[0], lngLat[1]])
    ),
  unproject: async (point) =>
    lngLatFromWrapper(
      await requireMap(mapRef.current).unproject([point[0], point[1]])
    ),
  resize: async () => {
    throw nativeResizeError();
  },
});

const requireCamera = (
  camera: ComponentRef<typeof Camera> | null,
  mapLoaded: boolean
): NonNullable<ComponentRef<typeof Camera>> => {
  if (!camera || !mapLoaded) {
    throw missingCameraError();
  }

  return camera;
};

const requireMap = (
  map: ComponentRef<typeof MaplibreMap> | null
): NonNullable<ComponentRef<typeof MaplibreMap>> => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
};

const finiteNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Map camera value must be a finite number.");
  }

  return value;
};

const mutableFlatBounds = (
  bounds: Parameters<typeof toFlatBounds>[0]
): [number, number, number, number] => {
  const [west, south, east, north] = toFlatBounds(bounds);

  return [west, south, east, north];
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
