import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { Backend } from "../../contracts/adapter.js";
import type { MapRef, Padding } from "../../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../../contracts/event-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import type { MapStyle } from "../../contracts/style-types.js";
import { useMapCapture } from "../shared/map-capture.js";
import { useActiveCallbacks } from "../shared/use-active-callback.js";
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
import { useWebStyleLoad } from "./use-web-style-load.js";

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
      options?: Omit<
        import("./contracts.js").WebMapProps,
        "initialViewState" | "mapStyle"
      > &
        Readonly<Record<string, unknown>>;
      hostProps?: Omit<
        HTMLAttributes<HTMLDivElement>,
        "children" | "dangerouslySetInnerHTML"
      >;
    }
  >(
    (
      {
        mapStyle,
        terrain,
        projection,
        light,
        options,
        captureEnabled = false,
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
      const capture = useMapCapture(captureEnabled);
      const [styleMap, setStyleMap] = useState<StyleLoadTarget | null>(null);
      const styleKey = styleContentKey(mapStyle);
      const frozenViewState = useFrozenValue(initialViewState);
      // recycle() retains SDK listeners and old props until the next logical map attaches.
      const report = useActiveCallbacks({
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
      });

      const pendingLoad = useRef(false);

      const setMapHandle = useCallback((handle: WebMapHandle | null) => {
        mapRef.current = handle;
        const next = handle?.getMap() ?? null;

        setStyleMap((current) => (current === next ? current : next));
      }, []);

      useImperativeHandle(ref, () =>
        createWebMapRef(mapRef, wrapper, async (options) => {
          if (options.output === "file")
            throw new Error("Browser capture cannot return a native file URI.");
          const canvas = mapRef.current?.getMap().getCanvas?.();
          if (!canvas) throw new Error("Renderer canvas is unavailable.");
          const context =
            canvas.getContext("webgl2") ?? canvas.getContext("webgl");
          if (!context?.getContextAttributes()?.preserveDrawingBuffer)
            throw new Error(
              "Capture needs a preserved drawing buffer. Create a fresh capture-enabled map or provide a compatible context."
            );
          capture.layout(canvas.width, canvas.height);
          return capture.run(options, async () =>
            canvas.toDataURL("image/png")
          );
        })
      );

      // Mapbox can emit load before react-map-gl commits its imperative handle.
      // Deliver the callback after attachment so camera operations are usable.
      useLayoutEffect(() => {
        if (styleMap && pendingLoad.current) {
          pendingLoad.current = false;
          report.onLoad();
        }
      }, [styleMap, report]);

      useLayoutEffect(
        () => () => {
          pendingLoad.current = false;
        },
        []
      );

      useWebStyleLoad(styleMap, styleKey, report.onStyleLoad);

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

      useLayoutEffect(() => {
        if (!captureEnabled || !styleMap) return;
        const frame = () => {
          const canvas = styleMap.getCanvas?.();
          if (canvas) capture.layout(canvas.width, canvas.height);
          capture.frame();
        };
        styleMap.on("render", frame);
        styleMap.triggerRepaint?.();
        return () => styleMap.off("render", frame);
      }, [styleMap, captureEnabled, capture]);
      assertWebLongPress(onLongPress);

      const paddingValue = useWebPadding(padding);
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
            {...options}
            {...(terrain === undefined && options?.terrain === undefined
              ? {}
              : {
                  terrain: terrain === undefined ? options?.terrain : terrain,
                })}
            projection={
              projection === undefined
                ? options?.projection
                : wrapper.backend === "mapbox-web"
                  ? { name: projection }
                  : { type: projection }
            }
            light={light ?? options?.light}
            ref={setMapHandle}
            interactiveLayerIds={
              interactiveLayerIds === undefined
                ? undefined
                : [...interactiveLayerIds]
            }
            mapStyle={mapStyle}
            initialViewState={initialCamera}
            // MapLibre nested viewState also controls canvas size. Portable camera
            // fields use top-level props to leave dimensions uncontrolled.
            {...(wrapper.backend === "maplibre-web"
              ? {
                  longitude: controlledCamera?.longitude ?? options?.longitude,
                  latitude: controlledCamera?.latitude ?? options?.latitude,
                  zoom: controlledCamera?.zoom ?? options?.zoom,
                  bearing: controlledCamera?.bearing ?? options?.bearing,
                  pitch: controlledCamera?.pitch ?? options?.pitch,
                }
              : {})}
            viewState={
              wrapper.backend === "mapbox-web" ? controlledCamera : undefined
            }
            padding={paddingValue}
            minZoom={minZoom ?? options?.minZoom}
            maxZoom={maxZoom ?? options?.maxZoom}
            maxBounds={
              maxBounds === undefined
                ? options?.maxBounds
                : toFlatBounds(maxBounds)
            }
            style={{ width: "100%", height: "100%" }}
            {...(captureEnabled
              ? wrapper.backend === "mapbox-web"
                ? { preserveDrawingBuffer: true }
                : {
                    canvasContextAttributes: {
                      ...options?.canvasContextAttributes,
                      preserveDrawingBuffer: true,
                    },
                  }
              : {})}
            reuseMaps={reuseMaps ?? options?.reuseMaps}
            gl={gl ?? options?.gl}
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
              if (mapRef.current) report.onLoad();
              else pendingLoad.current = true;
            }}
            onError={(event) => {
              capture.fail(event.error);
              report.onError({ error: event.error });
            }}
            onResize={() => {
              report.onResize();
            }}
            onMove={bindMove(onMove, report.onMove)}
            onMoveStart={bindMove(onMoveStart, report.onMoveStart)}
            onMoveEnd={bindMove(onMoveEnd, report.onMoveEnd)}
            onIdle={
              onIdle
                ? () => {
                    report.onIdle();
                  }
                : undefined
            }
            onClick={bindPointer(onClick, report.onClick)}
            onDblClick={bindPointer(onDblClick, report.onDblClick)}
            onContextMenu={bindPointer(onContextMenu, report.onContextMenu)}
            onMouseDown={bindPointer(onMouseDown, report.onMouseDown)}
            onMouseUp={bindPointer(onMouseUp, report.onMouseUp)}
            onMouseMove={bindPointer(onMouseMove, report.onMouseMove)}
            onMouseEnter={bindPointer(onMouseEnter, report.onMouseEnter)}
            onMouseLeave={bindPointer(onMouseLeave, report.onMouseLeave)}
            onMouseOver={bindPointer(onMouseOver, report.onMouseOver)}
            onMouseOut={bindPointer(onMouseOut, report.onMouseOut)}
            onWheel={bindPointer(onWheel, report.onWheel)}
            onDrag={bindMove(onDrag, report.onDrag)}
            onDragStart={bindMove(onDragStart, report.onDragStart)}
            onDragEnd={bindMove(onDragEnd, report.onDragEnd)}
            onTouchStart={bindPointer(onTouchStart, report.onTouchStart)}
            onTouchMove={bindPointer(onTouchMove, report.onTouchMove)}
            onTouchEnd={bindPointer(onTouchEnd, report.onTouchEnd)}
            onTouchCancel={bindPointer(onTouchCancel, report.onTouchCancel)}
          >
            {children}
          </wrapper.Map>
        </div>
      );
    }
  );

  return WebMap;
};

/** Preserves initial omission and sends one explicit reset after clearing padding. */
const useWebPadding = (padding: Padding | undefined) => {
  const hadPadding = useRef(false);
  const paddingValue =
    // eslint-disable-next-line react/refs -- Previous committed padding requires one explicit zero reset when removed; keep that SDK transition.
    padding === undefined && !hadPadding.current
      ? undefined
      : normalizePadding(padding ?? 0);
  useLayoutEffect(() => {
    hadPadding.current = padding !== undefined;
  }, [padding]);
  return paddingValue;
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
 * @remarks
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
