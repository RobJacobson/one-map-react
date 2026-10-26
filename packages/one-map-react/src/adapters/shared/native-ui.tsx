import {
  type ComponentType,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  type GestureResponderEvent,
  Platform,
  Pressable,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { Portal } from "react-native-teleport";

import type { Adapter } from "../../contracts/adapter.js";
import type { LngLat, Point } from "../../contracts/camera-types.js";
import type {
  Anchor,
  ControlProps,
  MarkerEvent,
  MarkerProps,
  MarkerRef,
} from "../../contracts/ui-types.js";
import { useMapSession } from "../../facade/map-context.js";
import { useGeolocationControl } from "../../facade/use-geolocation-control.js";
import { UserLocation } from "../../facade/user-location.js";
import {
  NativeOverlayContext,
  useNativeMapPresentation,
} from "./native-map-presentation.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";
import { lngLatFromWrapper, pointFromWrapper } from "./wrapper-values.js";

/** Selected native marker host presentation. */
export interface NativeMarkerProps extends MarkerProps {
  /** Props for the owned content View; facade responder handlers stay composed. */
  readonly hostProps?: ViewProps;
}

/** Selected native custom control presentation. */
export interface NativeControlProps extends ControlProps {
  /** Control content View props and style; corner placement stays map-owned. */
  readonly hostProps?: ViewProps;
}

/** Renderer-neutral native marker host after wrapper conversion. */
export interface NativeMarkerHostProps {
  /** Stable native annotation identity. */
  readonly id: string;
  /** Geographic location. */
  readonly lngLat: LngLat;
  /** Named anchor on the content bounds. */
  readonly anchor: Anchor;
  /** Logical-unit displacement of drawing and touch bounds. */
  readonly offset: Point;
  /** Activation callback. */
  readonly onClick?: (event: MarkerEvent) => void;
  /** Snapshot refresh handle. */
  readonly ref?: Ref<MarkerRef>;
  /** Reports asynchronous live-overlay projection failures. */
  readonly onProjectionError?: (error: unknown) => void;
  /** One measured content element. */
  readonly children: ReactElement;
}

/** Wrapper components needed by native UI compositions. */
export interface NativeUIOptions {
  /** Live-view wrapper. */
  readonly Marker: ComponentType<NativeMarkerHostProps>;
  /** Snapshot annotation wrapper. */
  readonly Annotation: ComponentType<NativeMarkerHostProps>;
  /** Selected native backend. */
  readonly backend: "mapbox-native" | "maplibre-native";
}

type NativeUI = Pick<Adapter, "Marker" | "Control" | "GeolocateControl">;

/**
 * Composes native markers and corner controls.
 *
 * @param options - Native wrappers with converted marker props.
 * @returns UI implementations for a native adapter.
 */
export const createNativeUI = (options: NativeUIOptions): NativeUI => {
  const NativeMarker = forwardRef<MarkerRef, NativeMarkerProps>(
    (props, ref) => {
      const coordinate = lngLatFromWrapper([props.longitude, props.latitude]);
      const offset = pointFromWrapper(props.offset ?? [0, 0]);
      const generatedId = useId();
      const annotationRef = useRef<MarkerRef>(null);
      const [annotationRevision, setAnnotationRevision] = useState(0);
      const defaultAnchor = useFrozenValue(
        props.children === undefined || props.children === null
          ? "bottom"
          : "center"
      );
      const markerId = props.id ?? generatedId;
      const anchor = props.anchor ?? defaultAnchor;
      const isAnnotation = props.renderMode === "annotation";
      const reportError = useActiveCallback(props.onError);
      const responders = useNativeMarkerActivation(props);

      if (
        props.draggable === true ||
        props.onDragStart !== undefined ||
        props.onDrag !== undefined ||
        props.onDragEnd !== undefined
      ) {
        throw new Error(
          "Native Marker does not support dragging. Use a selected raw native annotation for SDK dragging."
        );
      }

      useImperativeHandle(ref, () => ({
        refresh: async () => {
          if (isAnnotation) {
            if (!annotationRef.current)
              throw new Error("Annotation is detached.");
            await annotationRef.current.refresh();
          }
        },
      }));

      const Host = isAnnotation ? options.Annotation : options.Marker;
      const markerClick = useActiveCallback((event: MarkerEvent): void => {
        props.onClick?.(event);
        // RNMapbox 10.3.7 toggles selection on taps; reset until it exposes per-tap events.
        if (options.backend === "mapbox-native") {
          setAnnotationRevision((revision) => revision + 1);
        }
      });

      return (
        <Host
          key={isAnnotation ? annotationRevision : "view"}
          ref={annotationRef}
          id={markerId}
          lngLat={[coordinate[0], coordinate[1]]}
          anchor={anchor}
          offset={offset}
          onProjectionError={reportError}
          onClick={isAnnotation ? markerClick : undefined}
        >
          <View
            {...props.hostProps}
            collapsable={false}
            {...responders}
            onStartShouldSetResponder={(event) =>
              Boolean(
                responders.onStartShouldSetResponder?.(event) ||
                props.hostProps?.onStartShouldSetResponder?.(event)
              )
            }
            onResponderGrant={(event) => {
              responders.onResponderGrant?.(event);
              props.hostProps?.onResponderGrant?.(event);
            }}
            onResponderMove={(event) => {
              responders.onResponderMove?.(event);
              props.hostProps?.onResponderMove?.(event);
            }}
            onResponderRelease={(event) => {
              responders.onResponderRelease?.(event);
              props.hostProps?.onResponderRelease?.(event);
            }}
            onResponderTerminate={(event) => {
              responders.onResponderTerminate?.(event);
              props.hostProps?.onResponderTerminate?.(event);
            }}
            onTouchStart={(event) => {
              responders.onTouchStart?.(event);
              props.hostProps?.onTouchStart?.(event);
            }}
            onTouchEnd={(event) => {
              responders.onTouchEnd?.(event);
              props.hostProps?.onTouchEnd?.(event);
            }}
            onTouchMove={(event) => {
              responders.onTouchMove?.(event);
              props.hostProps?.onTouchMove?.(event);
            }}
            onTouchCancel={(event) => {
              responders.onTouchCancel?.(event);
              props.hostProps?.onTouchCancel?.(event);
            }}
          >
            {props.children ?? <DefaultPin />}
          </View>
        </Host>
      );
    }
  );

  return {
    Marker: NativeMarker,
    Control: NativeControl,
    GeolocateControl: NativeGeolocateControl,
  };
};

/** Observes live-marker activation without claiming scrolling or child-button touches. */
const useNativeMarkerActivation = (props: MarkerProps): ViewProps => {
  const eligible = useRef(false);
  const origin = useRef<Point | null>(null);
  const foreground = useRef(
    AppState.currentState === null || AppState.currentState === "active"
  );
  const click = useActiveCallback(() =>
    props.onClick?.({ lngLat: [props.longitude, props.latitude] })
  );
  const cancel = useCallback((): void => {
    eligible.current = false;
    origin.current = null;
  }, []);

  useLayoutEffect(() => {
    // Home can transform native touch coordinates before touch cancellation arrives.
    const subscription = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      if (!foreground.current) cancel();
    });
    return () => {
      subscription.remove();
      cancel();
    };
  }, [cancel]);

  useLayoutEffect(() => {
    cancel();
  }, [props.longitude, props.latitude, props.renderMode, cancel]);

  if (props.renderMode === "annotation") return {};
  return {
    // Fabric blocks native scrolling below a responder ancestor; observe only.
    onStartShouldSetResponder: (event) => {
      if (event)
        eligible.current =
          foreground.current && event.nativeEvent.touches.length === 1;
      return false;
    },
    onResponderTerminate: cancel,
    onResponderTerminationRequest: () => true,
    onTouchStart: (event) => {
      const canActivate =
        eligible.current &&
        foreground.current &&
        event.nativeEvent.touches.length === 1;
      cancel();
      if (canActivate && !startsInScrollableChild(event)) {
        origin.current = [event.nativeEvent.pageX, event.nativeEvent.pageY];
      }
    },
    onTouchMove: (event) => {
      if (
        event.nativeEvent.touches.length !== 1 ||
        (origin.current &&
          Math.hypot(
            event.nativeEvent.pageX - origin.current[0],
            event.nativeEvent.pageY - origin.current[1]
          ) > 8)
      )
        cancel();
    },
    onTouchEnd: (event) => {
      const activate =
        origin.current !== null &&
        foreground.current &&
        event.nativeEvent.touches.length === 0;
      cancel();
      if (activate) click();
    },
    onTouchCancel: cancel,
  };
};

/** Leaves overflowing child content with its native scroll host, bounded to this marker. */
const startsInScrollableChild = (event: GestureResponderEvent): boolean => {
  const target = event.target;
  if (!target || typeof target !== "object") return false;
  let node: typeof target.parentElement = target;
  while (node && node !== event.currentTarget) {
    if (
      (node.clientHeight > 0 && node.scrollHeight > node.clientHeight) ||
      (node.clientWidth > 0 && node.scrollWidth > node.clientWidth)
    )
      return true;
    node = node.parentElement;
  }
  return false;
};

const NativeControl = (props: NativeControlProps): ReactElement => {
  const presentation = useNativeMapPresentation();
  const { setOverlay } = presentation;
  const overlays = useContext(NativeOverlayContext);
  const id = useId();
  const position = props.position ?? "top-right";
  const index = overlays.findIndex((overlay) => overlay.id === id);
  const neighbors = position.startsWith("top")
    ? overlays.slice(0, Math.max(0, index))
    : overlays.slice(index + 1);
  const inset = neighbors
    .filter((overlay) => overlay.position === position && overlay.id !== id)
    .reduce((offset, overlay) => offset + overlay.height + 8, 8);

  useLayoutEffect(() => {
    setOverlay(id, position);
    return () => setOverlay(id, null);
  }, [setOverlay, id, position]);

  // Teleport moves native views only. Rendering children here preserves
  // application providers, local state, and effects in the original React tree.
  return (
    <Portal
      name={id}
      hostName={presentation.overlayHostName}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        // Android SDK parents leave the source portal detached, so native host
        // notifications may not refresh its constraints. iOS keeps host sizing.
        ...(Platform.OS === "android" ? presentation.nativeLayout : undefined),
      }}
    >
      <View
        {...props.hostProps}
        pointerEvents="box-none"
        onLayout={(event) => {
          setOverlay(id, position, event.nativeEvent.layout.height);
          props.hostProps?.onLayout?.(event);
        }}
        style={[
          props.hostProps?.style,
          {
            position: "absolute",
            ...(position.startsWith("top")
              ? { top: inset }
              : { bottom: inset }),
            ...(position.endsWith("left") ? { left: 8 } : { right: 8 }),
          },
        ]}
      >
        {props.children}
      </View>
    </Portal>
  );
};

const NativeGeolocateControl: Adapter["GeolocateControl"] = (props) => {
  const session = useMapSession();
  const { pending, position, activate } = useGeolocationControl(props);
  return (
    <>
      <UserLocation position={position} showAccuracyCircle />
      <NativeControl position={props.position}>
        <ControlButton
          label="Locate me"
          disabled={pending || !session.ready}
          onPress={activate}
        >
          ◎
        </ControlButton>
      </NativeControl>
    </>
  );
};

const ControlButton = (props: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}): ReactElement => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={props.label}
    accessibilityState={{ disabled: props.disabled }}
    disabled={props.disabled}
    onPress={props.onPress}
    style={{
      minWidth: 40,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "white",
      opacity: props.disabled ? 0.5 : 1,
    }}
  >
    {typeof props.children === "string" ? (
      <Text style={{ fontSize: 24 }}>{props.children}</Text>
    ) : (
      props.children
    )}
  </Pressable>
);

const DefaultPin = (): ReactElement => (
  <View style={{ width: 24, height: 32, alignItems: "center" }}>
    <View
      style={{
        position: "absolute",
        bottom: 2,
        width: 14,
        height: 14,
        backgroundColor: "#2679e8",
        transform: [{ rotate: "45deg" }],
      }}
    />
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#2679e8",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "white",
        }}
      />
    </View>
  </View>
);
