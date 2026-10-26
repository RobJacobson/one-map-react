import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import type { Adapter } from "../../contracts/adapter.js";
import type { LngLat } from "../../contracts/camera-types.js";
import type {
  AttributionControlProps,
  ControlProps,
  GeolocateControlProps,
  MarkerEvent,
  MarkerProps,
  MarkerRef,
  ScaleControlProps,
} from "../../contracts/ui-types.js";
import {
  useMapSession,
  useOptionalMapSession,
} from "../../facade/map-context.js";
import { useLocationOverride } from "../../facade/map-setup.js";
import { useGeolocationControl } from "../../facade/use-geolocation-control.js";
import { useStableOptions } from "../../facade/use-stable-options.js";
import { UserLocation } from "../../facade/user-location.js";
import { positionFromWrapper } from "../shared/location-values.js";
import { useActiveCallbacks } from "../shared/use-active-callback.js";
import { useFrozenValue } from "../shared/use-frozen-value.js";
import {
  lngLatFromWrapper,
  pointFromWrapper,
} from "../shared/wrapper-values.js";
import type {
  WebCustomControl,
  WebForwardedProps,
  WebWrapper,
} from "./contracts.js";

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
 * @param wrapper - Selected react-map-gl components and control hook.
 * @returns Marker and control implementations for the adapter.
 */
export const createWebUi = (
  wrapper: WebWrapper<"mapbox-web" | "maplibre-web">
): Pick<
  Adapter,
  | "Marker"
  | "Control"
  | "AttributionControl"
  | "ScaleControl"
  | "GeolocateControl"
> => {
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

  const Control = (props: ControlProps & WebUiOptions) => {
    const control = wrapper.useControl(createControlHost, {
      position: props.position ?? "top-right",
    });

    return createPortal(
      <div {...props.hostProps}>{props.children}</div>,
      control.element
    );
  };

  const AttributionControl = (
    props: AttributionControlProps & WebUiOptions
  ) => {
    const { options, hostProps, children, ...forwarded } = props;
    useStableOptions("AttributionControl", creationOptions(options, ["style"]));

    return (
      <wrapper.AttributionControl
        {...options}
        {...forwarded}
        position={props.position ?? "top-right"}
      />
    );
  };

  const ScaleControl = (props: ScaleControlProps & WebUiOptions) => {
    const { options, hostProps, onError, children, ...forwarded } = props;
    useStableOptions("ScaleControl", creationOptions(options, ["style"]));

    return (
      <wrapper.ScaleControl
        {...options}
        {...forwarded}
        position={props.position ?? "top-right"}
        unit={props.unit ?? "metric"}
        maxWidth={props.maxWidth ?? 100}
      />
    );
  };

  const GeolocateControl = (props: GeolocateControlProps & WebUiOptions) => {
    const {
      options,
      hostProps,
      children,
      getCurrentPosition,
      locationProvider,
      zoom,
      onGeolocate,
      onError,
      ...forwarded
    } = props;
    useStableOptions(
      "GeolocateControl",
      creationOptions(options, [
        "style",
        "onOutOfMaxBounds",
        "onTrackUserLocationStart",
        "onTrackUserLocationEnd",
      ])
    );
    // react-map-gl writes its callback ref during render, before a Suspense commit.
    const { onGeolocate: locate, onError: error } = useActiveCallbacks({
      onGeolocate,
      onError,
    });

    const session = useOptionalMapSession();
    const setupProvider = useLocationOverride();
    if (props.trackUserLocation && session?.cameraControlled) {
      throw new Error(
        "Location follow conflicts with viewState or selected native camera follow."
      );
    }

    if (getCurrentPosition || locationProvider || setupProvider) {
      return <InjectedGeolocateControl {...props} Control={Control} />;
    }

    return (
      <wrapper.GeolocateControl
        key={props.trackUserLocation ? "tracking" : "once"}
        {...options}
        {...forwarded}
        position={props.position ?? "top-right"}
        onGeolocate={(event: unknown) =>
          locate(positionFromWrapper(event, "browser"))
        }
        onError={error}
      />
    );
  };

  return {
    Marker,
    Control,
    AttributionControl,
    ScaleControl,
    GeolocateControl,
  };
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

/** Creates only the facade's DOM host; react-map-gl owns map registration. */
const createControlHost = (): WebCustomControl => {
  const browser = globalThis as unknown as {
    document: { createElement: (name: string) => WebCustomControl["element"] };
  };
  const element = browser.document.createElement("div");
  element.className = "mapboxgl-ctrl maplibregl-ctrl";

  return { element, onAdd: () => element, onRemove: () => element.remove() };
};

/** One-shot injected locations permit deterministic browser/native app behavior. */
const InjectedGeolocateControl = (
  props: GeolocateControlProps &
    WebUiOptions & {
      readonly Control: (props: ControlProps & WebUiOptions) => ReactNode;
    }
): ReactNode => {
  const session = useMapSession();
  const { pending, position, activate } = useGeolocationControl(props, "flyTo");
  return (
    <>
      <UserLocation position={position} showAccuracyCircle />
      <props.Control position={props.position} hostProps={props.hostProps}>
        <button
          type="button"
          aria-label="Locate me"
          disabled={pending || !session.ready}
          onClick={activate}
        >
          Locate me
        </button>
      </props.Control>
    </>
  );
};
