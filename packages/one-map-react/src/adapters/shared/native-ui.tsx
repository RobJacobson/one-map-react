import {
  type ComponentType,
  forwardRef,
  type ReactElement,
  type Ref,
  type RefObject,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  type GestureResponderEvent,
  View,
  type ViewProps,
} from "react-native";

import type { NativeBackend } from "../../contracts/backend.js";
import type { LngLat, Point } from "../../contracts/camera-types.js";
import type {
  Anchor,
  MarkerEvent,
  MarkerProps,
  MarkerRef,
} from "../../contracts/ui-types.js";
import type { NativeComponents } from "../../facade/map-context.js";
import { NativeMarkerOverlay } from "./native-marker-overlay.js";
import { useActiveCallback } from "./use-active-callback.js";
import { lngLatFromWrapper, pointFromWrapper } from "./wrapper-values.js";

/** Selected native marker host presentation. */
interface NativeMarkerProps extends Omit<MarkerProps, "anchor"> {
  /** Resolved named anchor on the content bounds. */
  readonly anchor: Anchor;
  /** Props for the owned content View; facade responder handlers stay composed. */
  readonly hostProps?: ViewProps;
}

interface NativeMarkerContentProps {
  /** Geographic location. */
  readonly lngLat: LngLat;
  /** Named anchor on the content bounds. */
  readonly anchor: Anchor;
  /** Logical-unit displacement of drawing and touch bounds. */
  readonly offset: Point;
  /** One measured content element. */
  readonly children: ReactElement;
}

/** Props for the live marker overlay. */
export interface NativeMarkerOverlayProps extends NativeMarkerContentProps {
  /** Reports asynchronous live-overlay projection failures. */
  readonly onProjectionError?: (error: unknown) => void;
}

/** Props for the native snapshot annotation. */
export interface NativeAnnotationHostProps extends NativeMarkerContentProps {
  /** Stable native annotation identity. */
  readonly id: string;
  /** Activation callback. */
  readonly onClick?: (event: MarkerEvent) => void;
  /** Snapshot refresh handle. */
  readonly ref?: Ref<MarkerRef>;
}

/** Wrapper components needed by native UI compositions. */
interface NativeUIOptions {
  /** Snapshot annotation wrapper. */
  readonly Annotation: ComponentType<NativeAnnotationHostProps>;
  /** Selected native backend. */
  readonly backend: NativeBackend;
}

type NativeUI = Pick<NativeComponents, "Marker">;

/**
 * Composes native markers.
 *
 * @param options - The backend and its snapshot annotation wrapper.
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
      const markerId = props.id ?? generatedId;
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

      useImperativeHandle(
        ref,
        () => ({
          refresh: async () => {
            if (isAnnotation) {
              if (!annotationRef.current)
                throw new Error("Annotation is detached.");
              await annotationRef.current.refresh();
            }
          },
        }),
        [isAnnotation]
      );

      const markerClick = useActiveCallback((event: MarkerEvent): void => {
        props.onClick?.(event);
        // RNMapbox toggles selection on taps. Reset until it exposes per-tap events.
        if (options.backend === "mapbox-native") {
          setAnnotationRevision((revision) => revision + 1);
        }
      });

      const content = (
        <View
          {...composeViewResponders(responders, props.hostProps)}
          collapsable={false}
        >
          {props.children ?? <DefaultPin />}
        </View>
      );
      const hostProps: NativeMarkerContentProps = {
        lngLat: coordinate,
        anchor: props.anchor,
        offset,
        children: content,
      };

      if (isAnnotation) {
        return (
          <options.Annotation
            {...hostProps}
            key={annotationRevision}
            ref={annotationRef}
            id={markerId}
            onClick={markerClick}
          />
        );
      }

      return (
        <NativeMarkerOverlay
          {...hostProps}
          key="view"
          onProjectionError={reportError}
        />
      );
    }
  );

  return {
    Marker: NativeMarker,
  };
};

/**
 * Exposes refresh against the currently attached native annotation.
 *
 * @param ref - Snapshot refresh handle to expose.
 * @param annotationRef - Current wrapper annotation.
 * @param wrapperName - Wrapper name used in the detached error.
 */
export const useNativeAnnotationRefresh = (
  ref: Ref<MarkerRef>,
  annotationRef: RefObject<{ refresh(): void } | null>,
  wrapperName: string
): void => {
  useImperativeHandle(
    ref,
    () => ({
      refresh: async () => {
        const annotation = annotationRef.current;
        if (!annotation)
          throw new Error(`${wrapperName} annotation is detached.`);
        annotation.refresh();
      },
    }),
    [annotationRef, wrapperName]
  );
};

type ActivationResponders = Required<
  Pick<
    ViewProps,
    | "onStartShouldSetResponder"
    | "onResponderTerminate"
    | "onResponderTerminationRequest"
    | "onTouchStart"
    | "onTouchMove"
    | "onTouchEnd"
    | "onTouchCancel"
  >
>;

const composeHandler = (
  first: (event: GestureResponderEvent) => void,
  second: ((event: GestureResponderEvent) => void) | undefined
): ((event: GestureResponderEvent) => void) =>
  second
    ? (event) => {
        first(event);
        second(event);
      }
    : first;

const composeStartResponder = (
  first: (event: GestureResponderEvent) => boolean,
  second: ViewProps["onStartShouldSetResponder"]
): ((event: GestureResponderEvent) => boolean) =>
  second ? (event) => Boolean(first(event) || second(event)) : first;

const composeViewResponders = (
  responders: ActivationResponders | undefined,
  hostProps: ViewProps | undefined
): ViewProps => {
  if (!responders) return hostProps ?? {};
  return {
    ...hostProps,
    onStartShouldSetResponder: composeStartResponder(
      responders.onStartShouldSetResponder,
      hostProps?.onStartShouldSetResponder
    ),
    onResponderTerminationRequest:
      hostProps?.onResponderTerminationRequest ??
      responders.onResponderTerminationRequest,
    onResponderTerminate: composeHandler(
      responders.onResponderTerminate,
      hostProps?.onResponderTerminate
    ),
    onTouchStart: composeHandler(
      responders.onTouchStart,
      hostProps?.onTouchStart
    ),
    onTouchMove: composeHandler(responders.onTouchMove, hostProps?.onTouchMove),
    onTouchEnd: composeHandler(responders.onTouchEnd, hostProps?.onTouchEnd),
    onTouchCancel: composeHandler(
      responders.onTouchCancel,
      hostProps?.onTouchCancel
    ),
  };
};

/** Observes live-marker activation without claiming scrolling or child-button touches. */
const useNativeMarkerActivation = (
  props: NativeMarkerProps
): ActivationResponders | undefined => {
  const enabled =
    props.renderMode !== "annotation" && props.onClick !== undefined;
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
    if (!enabled) {
      cancel();
      return;
    }
    foreground.current =
      AppState.currentState === null || AppState.currentState === "active";
    // Home can transform native touch coordinates before touch cancellation arrives.
    const subscription = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      if (!foreground.current) cancel();
    });
    return () => {
      subscription.remove();
      cancel();
    };
  }, [enabled, cancel]);

  useLayoutEffect(() => {
    cancel();
  }, [props.longitude, props.latitude, cancel]);

  if (!enabled) return undefined;
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
