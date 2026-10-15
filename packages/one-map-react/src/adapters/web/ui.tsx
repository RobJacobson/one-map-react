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
import type { LngLat, Point } from "../../contracts/camera-types.js";
import type {
  AttributionControlProps,
  ControlProps,
  FullscreenControlProps,
  GeolocateControlProps,
  GeolocationPosition,
  MarkerEvent,
  MarkerProps,
  MarkerRef,
  NavigationControlProps,
  PopupProps,
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
import { useActiveCallback } from "../shared/use-active-callback.js";
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

interface WebPopupHandle {
  readonly options: { anchor?: PopupProps["anchor"] };
  readonly setOffset: (offset: Point) => unknown;
}

/**
 * Builds UI delegates while converting only portable events and resets.
 *
 * @param wrapper - Selected react-map-gl components and control hook.
 * @returns Marker, popup, and control implementations for the adapter.
 */
export const createWebUi = (
  wrapper: WebWrapper<"mapbox-web" | "maplibre-web">
): Pick<
  Adapter,
  | "Marker"
  | "Popup"
  | "Control"
  | "NavigationControl"
  | "AttributionControl"
  | "ScaleControl"
  | "GeolocateControl"
  | "FullscreenControl"
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
      const defaultAnchor = useRef(
        children === undefined || children === null ? "bottom" : "center"
      ).current;
      const anchor = props.anchor ?? defaultAnchor;
      useStableOptions("Marker", {
        id,
        anchor,
        renderMode: renderMode ?? "view",
        ...creationOptions(options, [
          "style",
          "className",
          "rotation",
          "rotationAlignment",
          "pitchAlignment",
          "popup",
        ]),
      });
      useImperativeHandle(ref, () => ({ refresh: async () => {} }), []);
      const click = useActiveCallback(onClick);
      const dragStart = useActiveCallback(onDragStart);
      const drag = useActiveCallback(onDrag);
      const dragEnd = useActiveCallback(onDragEnd);
      const error = useActiveCallback(onError);
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

  const Popup = (props: PopupProps & WebUiOptions) => {
    const { options, hostProps, children, onOpen, onClose, ...popupProps } =
      props;
    const handle = useRef<WebPopupHandle | null>(null);
    const anchor = props.anchor ?? "bottom";
    const offset = props.offset ?? [0, 0];
    useStableOptions("Popup", {
      ...creationOptions(options, ["style", "className"]),
      closeButton: props.closeButton ?? true,
      closeOnClick: props.closeOnClick ?? true,
      closeOnMove: props.closeOnMove ?? false,
      focusAfterOpen: props.focusAfterOpen ?? true,
    });
    const open = useActiveCallback(onOpen);
    const close = useActiveCallback(onClose);

    useLayoutEffect(() => {
      // react-map-gl 8.1.3 updates options.anchor only when offset changes.
      // Apply the SDK's public offset setter so anchor-only updates reposition.
      // Remove when the wrapper handles anchor updates independently.
      if (handle.current) {
        handle.current.options.anchor = anchor;
        handle.current.setOffset(offset);
      }
    }, [anchor, offset[0], offset[1]]);

    return (
      <wrapper.Popup
        {...options}
        {...popupProps}
        anchor={anchor}
        offset={offset}
        maxWidth={
          typeof props.maxWidth === "number"
            ? `${props.maxWidth}px`
            : (props.maxWidth ?? "240px")
        }
        ref={handle}
        onOpen={open}
        onClose={close}
      >
        <div {...hostProps}>{children}</div>
      </wrapper.Popup>
    );
  };

  const Control = (props: ControlProps & WebUiOptions) => {
    useStableOptions("Control", { position: props.position ?? "top-right" });
    const control = wrapper.useControl(createControlHost, {
      position: props.position ?? "top-right",
    });

    return createPortal(
      <div {...props.hostProps}>{props.children}</div>,
      control.element
    );
  };

  const NavigationControl = (props: NavigationControlProps & WebUiOptions) => {
    const { options, hostProps, onError, children, ...forwarded } = props;
    useStableOptions("NavigationControl", {
      ...creationOptions(options, ["style"]),
      position: props.position ?? "top-right",
      showZoom: props.showZoom ?? true,
      showCompass: props.showCompass ?? true,
      visualizePitch: props.visualizePitch ?? false,
    });

    return (
      <wrapper.NavigationControl
        {...options}
        {...forwarded}
        position={props.position ?? "top-right"}
      />
    );
  };

  const AttributionControl = (
    props: AttributionControlProps & WebUiOptions
  ) => {
    const { options, hostProps, children, ...forwarded } = props;
    useStableOptions("AttributionControl", {
      ...creationOptions(options, ["style"]),
      ...forwarded,
      position: props.position ?? "top-right",
    });

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
    useStableOptions("ScaleControl", {
      ...creationOptions(options, ["style"]),
      position: props.position ?? "top-right",
      maxWidth: props.maxWidth ?? 100,
    });

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
    useStableOptions("GeolocateControl", {
      ...creationOptions(options, [
        "style",
        "onOutOfMaxBounds",
        "onTrackUserLocationStart",
        "onTrackUserLocationEnd",
      ]),
      position: props.position ?? "top-right",
    });
    const locate = useActiveCallback(onGeolocate);
    const error = useActiveCallback(onError);

    const session = useOptionalMapSession();
    const setupProvider = useLocationOverride();
    if (
      props.trackUserLocation &&
      (session?.cameraControlled || session?.nativeLocationFollowing)
    ) {
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
        onGeolocate={(event: WebGeolocationNotice) =>
          locate(geolocationPosition(event))
        }
        onError={error}
      />
    );
  };

  const FullscreenControl = (props: FullscreenControlProps & WebUiOptions) => {
    const { options, hostProps, children, ...forwarded } = props;
    useStableOptions("FullscreenControl", {
      ...creationOptions(options, ["style"]),
      position: props.position ?? "top-right",
    });

    return (
      <wrapper.FullscreenControl
        {...options}
        {...forwarded}
        position={props.position ?? "top-right"}
      />
    );
  };

  return {
    Marker,
    Popup,
    Control,
    NavigationControl,
    AttributionControl,
    ScaleControl,
    GeolocateControl,
    FullscreenControl,
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

interface WebGeolocationNotice {
  readonly coords: {
    readonly longitude: number;
    readonly latitude: number;
    readonly accuracy?: number;
  };
  readonly timestamp?: number;
}

const geolocationPosition = (
  event: WebGeolocationNotice
): GeolocationPosition => positionFromWrapper(event, "browser");

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
