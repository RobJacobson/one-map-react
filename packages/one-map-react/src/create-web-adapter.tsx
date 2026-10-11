import {
  type ComponentType,
  type CSSProperties,
  forwardRef,
  type ReactNode,
  type Ref,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { Adapter, Backend } from "./adapter.js";
import type {
  Bounds,
  LngLat,
  MapRef,
  Padding,
  Point,
  ViewState,
} from "./camera-types.js";
import {
  assertBounds,
  boundsFromGeographic,
  lngLatFromWrapper,
  normalizePadding,
  paddingFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
  toFlatBounds,
  toWebCommandOptions,
  toWebFitBoundsOptions,
  toWebFlyToOptions,
  toWebInitialViewState,
  toWebZoomToOptions,
} from "./convert-camera.js";
import { toWebGestureProps } from "./convert-gestures.js";
import { clickEventFromWeb, moveEventFromWeb } from "./convert-move-event.js";
import type { ClickEvent, MoveEvent } from "./event-types.js";
import { invokeWrapper } from "./invoke-wrapper.js";
import type { ExternalDrawingContext, MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

interface TouchZoomRotateHandler {
  disableRotation: () => void;
  enableRotation: () => void;
}

interface StyleLoadTarget {
  on: (type: "style.load" | "load" | "idle", listener: () => void) => void;
  off: (type: "style.load" | "load" | "idle", listener: () => void) => void;
  isStyleLoaded: () => boolean;
  touchZoomRotate?: TouchZoomRotateHandler;
}

interface WebMapHandle {
  jumpTo: (options: object) => unknown;
  easeTo: (options: object) => unknown;
  flyTo: (options: object) => unknown;
  fitBounds: (bounds: Bounds, options?: object) => unknown;
  zoomTo: (zoom: number, options?: object) => unknown;
  stop: () => unknown;
  resize: () => unknown;
  getCenter: () => unknown;
  getZoom: () => unknown;
  getBearing: () => unknown;
  getPitch: () => unknown;
  getPadding: () => unknown;
  getBounds: () => unknown;
  getMinZoom: () => unknown;
  getMaxZoom: () => unknown;
  getMaxBounds: () => unknown;
  project: (lngLat: LngLat) => unknown;
  unproject: (point: Point) => unknown;
  getMap: () => StyleLoadTarget;
}

interface WebMoveNotice {
  readonly viewState: ViewState;
  readonly originalEvent?: unknown;
}

interface WebPointerNotice {
  readonly lngLat?: unknown;
  readonly point?: unknown;
  readonly features?: readonly object[];
}

interface WebErrorNotice {
  readonly error?: unknown;
}

interface WebViewState extends ViewState {
  readonly padding?: Required<Padding>;
}

interface WebMapProps {
  readonly mapStyle: MapProps["mapStyle"];
  readonly initialViewState: WebViewState;
  readonly viewState?: WebViewState;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly maxBounds?: readonly [number, number, number, number];
  readonly style?: CSSProperties;
  readonly reuseMaps?: boolean;
  readonly gl?: ExternalDrawingContext;
  readonly interactive?: boolean;
  readonly dragPan?: boolean;
  readonly scrollZoom?: boolean;
  readonly doubleClickZoom?: boolean;
  readonly dragRotate?: boolean;
  readonly boxZoom?: boolean;
  readonly keyboard?: boolean;
  readonly cooperativeGestures?: boolean;
  readonly clickTolerance?: number;
  readonly hash?: boolean | string;
  readonly touchPitch?: boolean;
  readonly touchZoomRotate?: boolean;
  readonly onMove?: (event: WebMoveNotice) => void;
  readonly onMoveStart?: (event: WebMoveNotice) => void;
  readonly onMoveEnd?: (event: WebMoveNotice) => void;
  readonly onIdle?: () => void;
  readonly onClick?: (event: WebPointerNotice) => void;
  readonly onDblClick?: (event: WebPointerNotice) => void;
  readonly onContextMenu?: (event: WebPointerNotice) => void;
  readonly onMouseDown?: (event: WebPointerNotice) => void;
  readonly onMouseUp?: (event: WebPointerNotice) => void;
  readonly onMouseMove?: (event: WebPointerNotice) => void;
  readonly onMouseEnter?: (event: WebPointerNotice) => void;
  readonly onMouseLeave?: (event: WebPointerNotice) => void;
  readonly onMouseOver?: (event: WebPointerNotice) => void;
  readonly onMouseOut?: (event: WebPointerNotice) => void;
  readonly onWheel?: (event: WebPointerNotice) => void;
  readonly onDrag?: (event: WebMoveNotice) => void;
  readonly onDragStart?: (event: WebMoveNotice) => void;
  readonly onDragEnd?: (event: WebMoveNotice) => void;
  readonly onTouchStart?: (event: WebPointerNotice) => void;
  readonly onTouchMove?: (event: WebPointerNotice) => void;
  readonly onTouchEnd?: (event: WebPointerNotice) => void;
  readonly onTouchCancel?: (event: WebPointerNotice) => void;
  readonly onLoad?: () => void;
  readonly onError?: (event: WebErrorNotice) => void;
  readonly onResize?: () => void;
  readonly children?: ReactNode;
  readonly ref?: Ref<WebMapHandle>;
}

interface WebSourceProps {
  readonly id: string;
  readonly type: "geojson";
  readonly data: SourceProps["data"];
  readonly children?: ReactNode;
}

interface WebLayerProps {
  readonly id: string;
  readonly type: "line";
  readonly source?: string;
  readonly paint: LayerProps["paint"];
  readonly layout?: LayerProps["layout"];
}

interface WebWrapper<
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
> {
  readonly backend: Name;
  readonly Map: ComponentType<WebMapProps>;
  readonly Source: ComponentType<WebSourceProps>;
  readonly Layer: ComponentType<WebLayerProps>;
}

/**
 * Builds a web adapter that delegates to a react-map-gl Map, Source, and Layer.
 *
 * @param wrapper - Selected react-map-gl entry components and backend name.
 * @returns An adapter for {@link MapSetup}.
 */
export const createWebAdapter = <
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
>(
  wrapper: WebWrapper<Name>
): Adapter & { readonly backend: Name } => {
  const WebMap = forwardRef<MapRef, MapProps>(
    (
      {
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
        onIdle,
        onClick,
        onDblClick,
        onContextMenu,
        onMouseDown,
        onMouseUp,
        onMouseMove,
        onMouseEnter,
        onMouseLeave,
        onMouseOver,
        onMouseOut,
        onWheel,
        onDrag,
        onDragStart,
        onDragEnd,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel,
        onLoad,
        onStyleLoad,
        onError,
        onResize,
        onLongPress,
        reuseMaps,
        gl,
        interactive,
        dragPan,
        touchZoom,
        touchRotate,
        touchPitch,
        scrollZoom,
        doubleClickZoom,
        dragRotate,
        boxZoom,
        keyboard,
        cooperativeGestures,
        clickTolerance,
        hash,
        children,
      },
      ref
    ) => {
      const mapRef = useRef<WebMapHandle | null>(null);
      const [styleMap, setStyleMap] = useState<StyleLoadTarget | null>(null);
      const frozenViewState = useFrozenValue(initialViewState);
      const reportMove = useActiveCallback(onMove);
      const reportMoveStart = useActiveCallback(onMoveStart);
      const reportMoveEnd = useActiveCallback(onMoveEnd);
      const reportIdle = useActiveCallback(onIdle);
      const reportClick = useActiveCallback(onClick);
      const reportDblClick = useActiveCallback(onDblClick);
      const reportContextMenu = useActiveCallback(onContextMenu);
      const reportMouseDown = useActiveCallback(onMouseDown);
      const reportMouseUp = useActiveCallback(onMouseUp);
      const reportMouseMove = useActiveCallback(onMouseMove);
      const reportMouseEnter = useActiveCallback(onMouseEnter);
      const reportMouseLeave = useActiveCallback(onMouseLeave);
      const reportMouseOver = useActiveCallback(onMouseOver);
      const reportMouseOut = useActiveCallback(onMouseOut);
      const reportWheel = useActiveCallback(onWheel);
      const reportDrag = useActiveCallback(onDrag);
      const reportDragStart = useActiveCallback(onDragStart);
      const reportDragEnd = useActiveCallback(onDragEnd);
      const reportTouchStart = useActiveCallback(onTouchStart);
      const reportTouchMove = useActiveCallback(onTouchMove);
      const reportTouchEnd = useActiveCallback(onTouchEnd);
      const reportTouchCancel = useActiveCallback(onTouchCancel);
      const reportLoad = useActiveCallback(onLoad);
      const reportStyleLoad = useActiveCallback(onStyleLoad);
      const reportError = useActiveCallback(onError);
      const reportResize = useActiveCallback(onResize);
      const reportStyleLoadRef = useRef(reportStyleLoad);
      const setMapHandle = useCallback((handle: WebMapHandle | null) => {
        mapRef.current = handle;
        const next = handle?.getMap() ?? null;

        setStyleMap((current) => (current === next ? current : next));
      }, []);

      useImperativeHandle(ref, () => createWebMapRef(mapRef));

      useLayoutEffect(() => {
        reportStyleLoadRef.current = reportStyleLoad;
      });

      // style.load is style completion. react-map-gl onStyleData is activity
      // and is not this callback. A fresh map can finish style.load before
      // this commit, while isStyleLoaded() is still false; the map load that
      // follows then reports once. reuse() can fire that load before this
      // listener exists and still leave isStyleLoaded() false, so the next
      // idle reports once when the style is loaded. The listener is
      // facade-owned, so logical unmount removes it even when reuseMaps
      // keeps the renderer.
      useLayoutEffect(() => {
        if (!styleMap) {
          return;
        }

        let sawStyleLoad = false;
        const onStyleLoadEvent = () => {
          sawStyleLoad = true;
          reportStyleLoadRef.current();
        };
        const reportMissedStyleLoad = () => {
          if (sawStyleLoad || !styleMap.isStyleLoaded()) {
            return;
          }

          sawStyleLoad = true;
          reportStyleLoadRef.current();
        };

        styleMap.on("style.load", onStyleLoadEvent);

        if (styleMap.isStyleLoaded()) {
          sawStyleLoad = true;
          reportStyleLoadRef.current();
        } else {
          styleMap.on("load", reportMissedStyleLoad);
          styleMap.on("idle", reportMissedStyleLoad);
        }

        return () => {
          styleMap.off("style.load", onStyleLoadEvent);
          styleMap.off("load", reportMissedStyleLoad);
          styleMap.off("idle", reportMissedStyleLoad);
        };
      }, [styleMap]);

      // Pinch zoom and rotation are one handler. Disabling the handler would
      // also disable zoom, so rotation is turned off on the handler itself.
      useLayoutEffect(() => {
        const handler = styleMap?.touchZoomRotate;

        if (!handler || touchRotate === undefined || touchZoom === false) {
          return;
        }

        if (touchRotate) {
          handler.enableRotation();
          return;
        }

        handler.disableRotation();
      }, [styleMap, touchRotate, touchZoom]);

      assertWebLongPress(onLongPress);

      const paddingValue =
        padding === undefined ? undefined : normalizePadding(padding);
      const initialCamera = {
        ...toWebInitialViewState(frozenViewState),
        ...(paddingValue === undefined ? {} : { padding: paddingValue }),
      };
      const controlledCamera =
        viewState === undefined
          ? undefined
          : {
              ...viewState,
              ...(paddingValue === undefined ? {} : { padding: paddingValue }),
            };

      return (
        <wrapper.Map
          ref={setMapHandle}
          mapStyle={mapStyle}
          initialViewState={initialCamera}
          viewState={controlledCamera}
          minZoom={minZoom}
          maxZoom={maxZoom}
          maxBounds={
            maxBounds === undefined ? undefined : toFlatBounds(maxBounds)
          }
          style={style}
          reuseMaps={reuseMaps}
          gl={gl}
          {...toWebGestureProps({
            interactive,
            dragPan,
            touchZoom,
            touchRotate,
            touchPitch,
            scrollZoom,
            doubleClickZoom,
            dragRotate,
            boxZoom,
            keyboard,
            cooperativeGestures,
            clickTolerance,
            hash,
          })}
          onLoad={() => {
            reportLoad();
          }}
          onError={(event) => {
            reportError({ error: event.error });
          }}
          onResize={() => {
            reportResize();
          }}
          onMove={bindMove(onMove, reportMove)}
          onMoveStart={bindMove(onMoveStart, reportMoveStart)}
          onMoveEnd={bindMove(onMoveEnd, reportMoveEnd)}
          onIdle={
            onIdle
              ? () => {
                  reportIdle();
                }
              : undefined
          }
          onClick={bindPointer(onClick, reportClick)}
          onDblClick={bindPointer(onDblClick, reportDblClick)}
          onContextMenu={bindPointer(onContextMenu, reportContextMenu)}
          onMouseDown={bindPointer(onMouseDown, reportMouseDown)}
          onMouseUp={bindPointer(onMouseUp, reportMouseUp)}
          onMouseMove={bindPointer(onMouseMove, reportMouseMove)}
          onMouseEnter={bindPointer(onMouseEnter, reportMouseEnter)}
          onMouseLeave={bindPointer(onMouseLeave, reportMouseLeave)}
          onMouseOver={bindPointer(onMouseOver, reportMouseOver)}
          onMouseOut={bindPointer(onMouseOut, reportMouseOut)}
          onWheel={bindPointer(onWheel, reportWheel)}
          onDrag={bindMove(onDrag, reportDrag)}
          onDragStart={bindMove(onDragStart, reportDragStart)}
          onDragEnd={bindMove(onDragEnd, reportDragEnd)}
          onTouchStart={bindPointer(onTouchStart, reportTouchStart)}
          onTouchMove={bindPointer(onTouchMove, reportTouchMove)}
          onTouchEnd={bindPointer(onTouchEnd, reportTouchEnd)}
          onTouchCancel={bindPointer(onTouchCancel, reportTouchCancel)}
        >
          {children}
        </wrapper.Map>
      );
    }
  );

  const WebSource = ({ id, data, children }: SourceProps) => (
    <wrapper.Source id={id} type="geojson" data={data}>
      {children}
    </wrapper.Source>
  );

  const WebLayer = ({ id, paint, layout, source }: LayerProps) => (
    <wrapper.Layer
      id={id}
      type="line"
      source={source}
      paint={paint}
      layout={layout}
    />
  );

  return {
    backend: wrapper.backend,
    Map: WebMap,
    Source: WebSource,
    Layer: WebLayer,
  };
};

const createWebMapRef = (mapRef: {
  readonly current: WebMapHandle | null;
}): MapRef => ({
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.jumpTo(toWebCommandOptions(options)));
  },
  easeTo: async (options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.easeTo(toWebCommandOptions(options)));
  },
  flyTo: async (options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.flyTo(toWebFlyToOptions(options)));
  },
  fitBounds: async (bounds, options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(
      map.fitBounds(assertBounds(bounds), toWebFitBoundsOptions(options))
    );
  },
  zoomTo: async (zoom, options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.zoomTo(zoom, toWebZoomToOptions(options)));
  },
  stop: async () => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.stop());
  },
  getCenter: async () => {
    const map = requireWebMap(mapRef.current);

    return lngLatFromWrapper(await map.getCenter());
  },
  getZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getZoom(), "zoom");
  },
  getBearing: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getBearing(), "bearing");
  },
  getPitch: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getPitch(), "pitch");
  },
  getPadding: async () => {
    const map = requireWebMap(mapRef.current);

    return paddingFromWrapper(await map.getPadding());
  },
  getBounds: async () => {
    const map = requireWebMap(mapRef.current);

    return boundsFromGeographic(await map.getBounds());
  },
  getMinZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getMinZoom(), "min zoom");
  },
  getMaxZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getMaxZoom(), "max zoom");
  },
  getMaxBounds: async () => {
    const map = requireWebMap(mapRef.current);
    const value = await map.getMaxBounds();

    if (value == null) {
      return null;
    }

    return boundsFromGeographic(value);
  },
  project: async (lngLat) => {
    const map = requireWebMap(mapRef.current);

    return pointFromWrapper(await map.project(lngLat));
  },
  unproject: async (point) => {
    const map = requireWebMap(mapRef.current);

    return lngLatFromWrapper(await map.unproject(point));
  },
  resize: async () => {
    const map = mapRef.current;

    if (!map) {
      throw missingMapError();
    }

    await invokeWrapper(map.resize());
  },
});

const requireWebMap = (map: WebMapHandle | null): WebMapHandle => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
};

const finiteNumber = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Map ${name} must be a finite number.`);
  }

  return value;
};

const bindMove = (
  callback: ((event: MoveEvent) => void) | undefined,
  report: (event: MoveEvent) => void
) =>
  callback
    ? (event: WebMoveNotice) => {
        report(moveEventFromWeb(event.viewState, event.originalEvent));
      }
    : undefined;

const bindPointer = (
  callback: ((event: ClickEvent) => void) | undefined,
  report: (event: ClickEvent) => void
) =>
  callback
    ? (event: WebPointerNotice) => {
        report(clickEventFromWeb(event));
      }
    : undefined;

/**
 * Rejects a long-press callback on web.
 *
 * react-map-gl has no long-press event. A browser recognizer would be new
 * gesture behavior, so the prop fails instead of being ignored.
 *
 * @param onLongPress - Common long-press callback.
 * @throws When the callback is set.
 */
const assertWebLongPress = (onLongPress: unknown): void => {
  if (onLongPress !== undefined) {
    throw new Error(
      "onLongPress is not available on web maps. react-map-gl has no long-press callback."
    );
  }
};

/**
 * Error thrown when `resize()` has no web map to measure.
 *
 * @returns An error describing the missing map.
 */
const missingMapError = (): Error => new Error("Map is not attached.");
