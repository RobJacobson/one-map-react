import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";

import type { Adapter } from "../../contracts/adapter.js";
import type { LngLat } from "../../contracts/camera-types.js";
import type {
  MarkerEvent,
  MarkerProps,
  MarkerRef,
} from "../../contracts/ui-types.js";
import { useStableOptions } from "../../facade/use-stable-options.js";
import { useActiveCallbacks } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import {
  lngLatFromWrapper,
  pointFromWrapper,
} from "../shared/wrapper-values.js";
import type { WebForwardedProps, WebWrapper } from "./contracts.js";

/** Platform additions accepted only by selected web UI entry points. */
interface WebUiOptions {
  /** Wrapper-specific options; portable fields take precedence. */
  readonly options?: Readonly<Record<string, unknown>>;
  /** Host attributes for the content container. */
  readonly hostProps?: HTMLAttributes<HTMLDivElement>;
}

interface WebMarkerNotice {
  readonly lngLat?: unknown;
  readonly point?: unknown;
  readonly target?: { readonly getLngLat: () => unknown };
  readonly originalEvent?: { readonly stopPropagation?: () => void };
}

interface WebMarkerHandle {
  readonly setLngLat: (coordinate: LngLat) => unknown;
}

/**
 * Builds UI delegates while converting only portable events and resets.
 *
 * @param wrapper - Selected react-map-gl components.
 * @returns Marker implementation for the adapter.
 */
export const createWebUi = (
  wrapper: WebWrapper<"mapbox-web" | "maplibre-web">
): Pick<Adapter, "Marker"> => {
  const Marker = forwardRef<MarkerRef, MarkerProps & WebUiOptions>(
    (props, ref) => {
      const {
        options,
        hostProps,
        id,
        renderMode,
        onError,
        onClick,
        onDragStart,
        onDrag,
        onDragEnd,
        children,
        ...markerProps
      } = props;
      const rendererRef = useRef<WebMarkerHandle | null>(null);
      const coordinate = useRef<LngLat>([props.longitude, props.latitude]);
      useLayoutEffect(() => {
        coordinate.current = [props.longitude, props.latitude];
      });
      const defaultAnchor = useFrozenValue(
        children === undefined || children === null ? "bottom" : "center"
      );
      const anchor = props.anchor ?? defaultAnchor;
      useStableOptions(
        "Marker",
        creationOptions(options, [
          "style",
          "className",
          "rotation",
          "rotationAlignment",
          "pitchAlignment",
          "popup",
        ])
      );
      useImperativeHandle(ref, () => ({ refresh: async () => {} }), []);
      // react-map-gl writes its callback ref during render, before a Suspense commit.
      const {
        onClick: click,
        onDragStart: dragStart,
        onDrag: drag,
        onDragEnd: dragEnd,
        onError: error,
      } = useActiveCallbacks({
        onClick,
        onDragStart,
        onDrag,
        onDragEnd,
        onError,
      });
      const notify =
        (callback: (event: MarkerEvent) => void) =>
        (event: WebMarkerNotice): void => {
          try {
            callback(markerEvent(event, [props.longitude, props.latitude]));
          } catch (failure) {
            if (onError) {
              error(failure);
            } else {
              throw failure;
            }
          }
        };

      return (
        <wrapper.Marker
          {...options}
          {...markerProps}
          ref={rendererRef}
          anchor={anchor}
          offset={props.offset ?? [0, 0]}
          onClick={(event: WebMarkerNotice) => {
            event.originalEvent?.stopPropagation?.();
            notify(click)(event);
          }}
          onDragStart={notify(dragStart)}
          onDrag={notify(drag)}
          onDragEnd={(event: WebMarkerNotice) => {
            notify(dragEnd)(event);
            rendererRef.current?.setLngLat(coordinate.current);
          }}
        >
          <div {...hostProps}>{children ?? <DefaultPin />}</div>
        </wrapper.Marker>
      );
    }
  );

  return { Marker };
};

const markerEvent = (
  event: WebMarkerNotice,
  fallback: LngLat
): MarkerEvent => ({
  lngLat: lngLatFromWrapper(
    event.lngLat ?? event.target?.getLngLat() ?? fallback
  ),
  ...(event.point === undefined
    ? {}
    : { point: pointFromWrapper(event.point) }),
});

const creationOptions = (
  options: WebUiOptions["options"],
  mutable: readonly string[]
): WebForwardedProps =>
  Object.fromEntries(
    Object.entries(options ?? {}).filter(([key]) => !mutable.includes(key))
  );

const DefaultPin = (): ReactNode => (
  <svg
    width="24"
    height="32"
    viewBox="0 0 24 32"
    aria-hidden="true"
    style={{ display: "block" }}
  >
    <rect
      x="5"
      y="16"
      width="14"
      height="14"
      fill="#2679e8"
      transform="rotate(45 12 23)"
    />
    <circle cx="12" cy="12" r="12" fill="#2679e8" />
    <circle cx="12" cy="12" r="4" fill="white" />
  </svg>
);
