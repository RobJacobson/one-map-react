import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Backend } from "../../contracts/adapter.js";
import type { MapRef } from "../../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../../contracts/event-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import type { MapStyle } from "../../contracts/style-types.js";
import { useActiveCallback } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import { normalizePadding, toFlatBounds } from "../shared/wrapper-values.js";
import type {
  StyleLoadTarget,
  WebMapHandle,
  WebMoveNotice,
  WebPointerNotice,
  WebWrapper,
} from "./contracts.js";
import { toWebInitialViewState } from "./convert-camera.js";
import { toWebGestureProps } from "./convert-gestures.js";
import { clickEventFromWeb, moveEventFromWeb } from "./convert-move-event.js";
import { createWebMapRef } from "./map-ref.js";

/**
 * Builds a web Map component that delegates to a react-map-gl Map.
 *
 * @param wrapper - Selected react-map-gl entry components and backend name.
 * @returns A Map component for the web adapter record.
 */
export const createWebMap = <
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
>(
  wrapper: WebWrapper<Name>
) => {
  const WebMap = forwardRef<
    MapRef,
    MapProps & {
      hostProps?: Omit<
        HTMLAttributes<HTMLDivElement>,
        "children" | "dangerouslySetInnerHTML"
      >;
    }
  >(
    (
      {
        mapStyle,
        interactiveLayerIds,
        hostProps,
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
        doubleTapZoom,
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
      const styleKey = useMemo(() => styleContentKey(mapStyle), [mapStyle]);
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
      const pendingLoad = useRef(false);
      const reportStyleLoad = useActiveCallback(onStyleLoad);
      const reportError = useActiveCallback(onError);
      const reportResize = useActiveCallback(onResize);
      const reportStyleLoadRef = useRef(reportStyleLoad);
      const setMapHandle = useCallback((handle: WebMapHandle | null) => {
        mapRef.current = handle;
        const next = handle?.getMap() ?? null;

        setStyleMap((current) => (current === next ? current : next));
      }, []);

      useImperativeHandle(ref, () => createWebMapRef(mapRef, wrapper));

      // Mapbox can emit load before react-map-gl commits its imperative handle.
      // Deliver the callback after attachment so camera operations are usable.
      useLayoutEffect(() => {
        if (styleMap && pendingLoad.current) {
          pendingLoad.current = false;
          reportLoad();
        }
      }, [styleMap, reportLoad]);

      useLayoutEffect(
        () => () => {
          pendingLoad.current = false;
        },
        []
      );

      useLayoutEffect(() => {
        reportStyleLoadRef.current = reportStyleLoad;
      });

      // style.load is style completion. react-map-gl onStyleData is activity
      // and is not this callback. A fresh map can finish style.load before
      // this commit, while isStyleLoaded() is still false; the map load that
      // follows then reports once. reuse() can fire that load before this
      // listener exists and still leave isStyleLoaded() false, so the next
      // idle reports once when the style is loaded. A later mapStyle
      // replacement re-runs this effect so an in-place style diff that
      // never emits style.load still reports once the current style is
      // loaded. The listener is facade-owned, so logical unmount removes
      // it even when reuseMaps keeps the renderer.
      // biome-ignore lint/correctness/useExhaustiveDependencies: style content changes rearm missed-load observation after in-place diffs.
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
      }, [styleMap, styleKey]);

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
        return () => handler.enableRotation();
      }, [styleMap, touchRotate, touchZoom]);

      assertWebLongPress(onLongPress);

      const hadPadding = useRef(false);
      const paddingValue =
        padding === undefined && !hadPadding.current
          ? undefined
          : normalizePadding(padding ?? 0);
      useLayoutEffect(() => {
        hadPadding.current = padding !== undefined;
      }, [padding]);
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
        <div
          {...hostProps}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            ...style,
            ...hostProps?.style,
          }}
        >
          <wrapper.Map
            ref={setMapHandle}
            interactiveLayerIds={
              interactiveLayerIds === undefined
                ? undefined
                : [...interactiveLayerIds]
            }
            mapStyle={mapStyle}
            initialViewState={initialCamera}
            viewState={controlledCamera}
            padding={paddingValue}
            minZoom={minZoom}
            maxZoom={maxZoom}
            maxBounds={
              maxBounds === undefined ? undefined : toFlatBounds(maxBounds)
            }
            style={{ width: "100%", height: "100%" }}
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
              doubleTapZoom,
              dragRotate,
              boxZoom,
              keyboard,
              cooperativeGestures,
              clickTolerance,
              hash,
            })}
            onLoad={() => {
              if (mapRef.current) reportLoad();
              else pendingLoad.current = true;
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
        </div>
      );
    }
  );

  return WebMap;
};

/** Content equality keeps equivalent inline styles from rearming completion. */
const styleContentKey = (style: MapStyle): string =>
  JSON.stringify(style, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        )
      : value
  );

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
