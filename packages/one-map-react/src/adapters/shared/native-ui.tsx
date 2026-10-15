import {
  type ComponentType,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
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
  PopupProps,
  ScaleControlProps,
} from "../../contracts/ui-types.js";
import {
  NativeOverlayContext,
  useMapSession,
} from "../../facade/map-context.js";
import { useGeolocationControl } from "../../facade/use-geolocation-control.js";
import { UserLocation } from "../../facade/user-location.js";
import { useActiveCallback } from "./use-active-callback.js";
import { lngLatFromWrapper, pointFromWrapper } from "./wrapper-values.js";

/** Selected native marker host presentation. */
export interface NativeMarkerProps extends MarkerProps {
  /** Props for the owned content View; facade responder handlers stay composed. */
  readonly hostProps?: ViewProps;
}

/** Selected native popup bubble presentation. */
export interface NativePopupProps extends PopupProps {
  /** Bubble View props and style; native marker bounds contain presses. */
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
  /** Annotation dragging; live dragging is owned by the composition. */
  readonly draggable?: boolean;
  /** Keep popup bubbles visible beside nearby markers. */
  readonly allowOverlap?: boolean;
  /** Retain JS gestures inside a draggable live view. */
  readonly stopGesturePropagation?: boolean;
  /** Activation callback. */
  readonly onClick?: (event: MarkerEvent) => void;
  /** Annotation drag start. */
  readonly onDragStart?: (event: MarkerEvent) => void;
  /** Annotation coordinate proposal. */
  readonly onDrag?: (event: MarkerEvent) => void;
  /** Annotation drag end. */
  readonly onDragEnd?: (event: MarkerEvent) => void;
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

type NativeUI = Pick<
  Adapter,
  | "Marker"
  | "Popup"
  | "Control"
  | "NavigationControl"
  | "AttributionControl"
  | "ScaleControl"
  | "GeolocateControl"
  | "FullscreenControl"
>;

interface DragState {
  readonly generation: number;
  readonly pageOrigin: Point;
  readonly mapOrigin: Point;
  readonly lngLat: LngLat;
}

/** Leaves touches inside overflowing child content with its native scroll host. */
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

/**
 * Composes native markers, popup bubbles, and corner controls.
 *
 * @param options - Native wrappers with converted marker props.
 * @returns UI implementations for a native adapter.
 */
export const createNativeUI = (options: NativeUIOptions): NativeUI => {
  const NativeMarker = forwardRef<MarkerRef, NativeMarkerProps>(
    (props, ref) => {
      const coordinate = lngLatFromWrapper([props.longitude, props.latitude]);
      const offset = pointFromWrapper(props.offset ?? [0, 0]);
      const mapSession = useMapSession();
      const generatedId = useId();
      const annotationRef = useRef<MarkerRef>(null);
      const [dragCoordinate, setDragCoordinate] = useState<LngLat | null>(null);
      const [annotationRevision, setAnnotationRevision] = useState(0);
      const previousCoordinate = useRef<LngLat>([
        props.longitude,
        props.latitude,
      ]);
      const initial = useRef({
        id: props.id ?? generatedId,
        anchor:
          props.anchor ??
          (props.children === undefined || props.children === null
            ? "bottom"
            : "center"),
        renderMode: props.renderMode ?? "view",
      }).current;
      const click = useNativeCallback(props.onClick);
      const dragStart = useNativeCallback(props.onDragStart);
      const drag = useNativeCallback(props.onDrag);
      const dragEnd = useNativeCallback(props.onDragEnd);
      const reportError = useNativeCallback(props.onError);
      const gesture = useRef<DragState | null>(null);
      const generation = useRef(0);
      const requestSequence = useRef(0);
      const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
      const active = useRef(false);
      const eligibleTouch = useRef(false);
      const startingPoint = useRef<Point | null>(null);
      const lastPoint = useRef<Point | null>(null);

      const clearTimer = useCallback((): void => {
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
      }, []);

      const releaseInteraction = useCallback((): void => {
        if (active.current) mapSession.requestGestureLock(false);
      }, [mapSession.requestGestureLock]);

      const cancel = useCallback((): void => {
        clearTimer();
        generation.current += 1;
        requestSequence.current += 1;
        gesture.current = null;
        startingPoint.current = null;
        lastPoint.current = null;
        eligibleTouch.current = false;
        releaseInteraction();
        active.current = false;
        setDragCoordinate(null);
      }, [clearTimer, releaseInteraction]);

      useLayoutEffect(() => cancel, [cancel]);

      useLayoutEffect(() => {
        if (!props.draggable) cancel();
      }, [props.draggable, cancel]);

      useLayoutEffect(() => {
        const coordinate: LngLat = [props.longitude, props.latitude];
        const changed =
          previousCoordinate.current[0] !== coordinate[0] ||
          previousCoordinate.current[1] !== coordinate[1];
        previousCoordinate.current = coordinate;
        const proposal = gesture.current?.lngLat;
        // Application echoes of the latest proposal keep the gesture alive.
        if (
          changed &&
          active.current &&
          (!proposal ||
            proposal[0] !== coordinate[0] ||
            proposal[1] !== coordinate[1])
        )
          cancel();
      }, [props.longitude, props.latitude, cancel]);

      useImperativeHandle(ref, () => ({
        refresh: async () => {
          if (initial.renderMode === "annotation") {
            if (!annotationRef.current)
              throw new Error("Annotation is detached.");
            await annotationRef.current.refresh();
          }
        },
      }));

      const updateDrag = async (
        pagePoint: Point,
        ending: boolean
      ): Promise<void> => {
        const currentGesture = gesture.current;
        const map = mapSession.ref.current;
        if (!currentGesture || !map) return;
        const sequence = ++requestSequence.current;
        const point: Point = [
          currentGesture.mapOrigin[0] +
            pagePoint[0] -
            currentGesture.pageOrigin[0],
          currentGesture.mapOrigin[1] +
            pagePoint[1] -
            currentGesture.pageOrigin[1],
        ];

        try {
          const lngLat = await map.unproject(point);
          if (
            generation.current !== currentGesture.generation ||
            sequence !== requestSequence.current
          )
            return;
          gesture.current = { ...currentGesture, lngLat };
          setDragCoordinate(lngLat);
          if (ending) {
            dragEnd({ lngLat, point });
            cancel();
          } else {
            drag({ lngLat, point });
          }
        } catch (error) {
          if (
            generation.current !== currentGesture.generation ||
            sequence !== requestSequence.current
          )
            return;
          cancel();
          reportError(error);
        }
      };

      const startDrag = async (pageOrigin: Point): Promise<void> => {
        const map = mapSession.ref.current;
        if (!map || !props.draggable || !mapSession.ready) return;
        const currentGeneration = ++generation.current;
        const lngLat: LngLat = [props.longitude, props.latitude];
        active.current = true;
        mapSession.requestGestureLock(true);

        try {
          const mapOrigin = await map.project(lngLat);
          if (generation.current !== currentGeneration) return;
          gesture.current = {
            generation: currentGeneration,
            pageOrigin,
            mapOrigin,
            lngLat,
          };
          dragStart({ lngLat, point: mapOrigin });
          const latest = lastPoint.current;
          if (latest) await updateDrag(latest, false);
        } catch (error) {
          if (generation.current !== currentGeneration) return;
          cancel();
          reportError(error);
        }
      };

      const grant = (event: GestureResponderEvent): void => {
        clearTimer();
        const point = pagePoint(event);
        startingPoint.current = point;
        lastPoint.current = point;
        if (props.draggable) {
          timer.current = setTimeout(() => void startDrag(point), 500);
        }
      };

      const move = (event: GestureResponderEvent): void => {
        if (event.nativeEvent.touches.length !== 1) {
          cancel();
          return;
        }
        const point = pagePoint(event);
        lastPoint.current = point;
        if (active.current) {
          void updateDrag(point, false);
        } else if (
          startingPoint.current &&
          distance(point, startingPoint.current) > 8
        ) {
          cancel();
        }
      };

      const release = (event: GestureResponderEvent): void => {
        clearTimer();
        if (active.current) {
          if (gesture.current) void updateDrag(pagePoint(event), true);
          else cancel();
          return;
        }
        if (startingPoint.current) {
          click({ lngLat: [props.longitude, props.latitude] });
        }
        cancel();
      };

      const isAnnotation = initial.renderMode === "annotation";
      const Host = isAnnotation ? options.Annotation : options.Marker;
      const markerCoordinate = dragCoordinate ?? coordinate;
      const markerClick = (event: MarkerEvent): void => {
        click(event);
        // RNMapbox 10.3.7 toggles selection on taps; reset until it exposes per-tap events.
        if (options.backend === "mapbox-native") {
          setAnnotationRevision((revision) => revision + 1);
        }
      };
      const responders: ViewProps = isAnnotation
        ? {}
        : {
            // Observe the bubble negotiation without claiming a JS responder:
            // Fabric blocks native scrolling below a responder ancestor.
            // A button that claims the touch prevents this negotiation reaching us.
            onStartShouldSetResponder: (event) => {
              if (!event) return false;
              eligibleTouch.current = event.nativeEvent.touches.length === 1;
              return false;
            },
            onResponderTerminate: () => cancel(),
            onResponderTerminationRequest: () => !active.current,
            onTouchStart: (event) => {
              if (event.nativeEvent.touches.length > 1) cancel();
              else if (eligibleTouch.current) {
                eligibleTouch.current = false;
                // Negotiation has no currentTarget; ordinary touch dispatch does.
                // Bound native DOM traversal to this marker, not its page layout.
                if (!startsInScrollableChild(event)) grant(event);
              }
            },
            onTouchMove: move,
            onTouchEnd: (event) => {
              if (event.nativeEvent.touches.length === 0) release(event);
            },
            onTouchCancel: () => cancel(),
          };

      return (
        <Host
          key={isAnnotation ? annotationRevision : "view"}
          ref={annotationRef}
          id={initial.id}
          lngLat={[markerCoordinate[0], markerCoordinate[1]]}
          anchor={initial.anchor}
          offset={offset}
          draggable={isAnnotation && props.draggable}
          stopGesturePropagation={!isAnnotation && props.draggable}
          onProjectionError={reportError}
          onClick={isAnnotation ? markerClick : undefined}
          onDragStart={dragStart}
          onDrag={drag}
          onDragEnd={(event: MarkerEvent) => {
            dragEnd(event);
            // Native annotation wrappers retain a dragged coordinate when the
            // unchanged controlled prop is rejected; reattachment reapplies it.
            if (isAnnotation) setAnnotationRevision((revision) => revision + 1);
          }}
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

  const NativePopup = (props: NativePopupProps): ReactElement => {
    const coordinate = lngLatFromWrapper([props.longitude, props.latitude]);
    const offset = pointFromWrapper(props.offset ?? [0, 0]);
    const mapSession = useMapSession();
    const id = useId();
    const close = useNativeCallback(props.onClose);
    const open = useNativeCallback(props.onOpen);
    const initial = useRef({
      closeOnClick: props.closeOnClick ?? true,
      closeOnMove: props.closeOnMove ?? false,
      closeButton: props.closeButton ?? true,
    }).current;
    const dismissed = useRef(false);
    const requestClose = useCallback((): void => {
      if (dismissed.current) return;
      dismissed.current = true;
      close();
    }, [close]);

    useLayoutEffect(() => {
      dismissed.current = false;
      open();
      const removeClick = initial.closeOnClick
        ? mapSession.subscribe("click", requestClose)
        : undefined;
      const removeMove = initial.closeOnMove
        ? mapSession.subscribe("move", requestClose)
        : undefined;
      return () => {
        removeClick?.();
        removeMove?.();
      };
    }, [
      mapSession.subscribe,
      initial.closeOnClick,
      initial.closeOnMove,
      open,
      requestClose,
    ]);

    if (props.focusAfterOpen !== undefined) {
      throw new Error("Native Popup does not support browser focusAfterOpen.");
    }

    return (
      <options.Marker
        id={id}
        lngLat={coordinate}
        anchor={props.anchor ?? "bottom"}
        offset={offset}
        allowOverlap
      >
        <View
          {...props.hostProps}
          collapsable={false}
          onTouchStart={(event) => {
            props.hostProps?.onTouchStart?.(event);
          }}
          style={[
            {
              padding: 12,
              backgroundColor: "white",
              borderRadius: 6,
              elevation: 4,
              shadowOpacity: 0.2,
              shadowRadius: 4,
            },
            props.hostProps?.style,
            { maxWidth: nativeMaxWidth(props.maxWidth) },
          ]}
        >
          {initial.closeButton && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close popup"
              onPress={requestClose}
            >
              <Text style={{ alignSelf: "flex-end", fontSize: 20 }}>×</Text>
            </Pressable>
          )}
          {props.children}
        </View>
      </options.Marker>
    );
  };

  return {
    Marker: NativeMarker,
    Popup: NativePopup,
    Control: NativeControl,
    NavigationControl: NativeNavigationControl,
    AttributionControl: NativeAttributionControl,
    ScaleControl: NativeScaleControl,
    GeolocateControl: NativeGeolocateControl,
    FullscreenControl: NativeFullscreenControl,
  };
};

const NativeControl = (props: NativeControlProps): ReactElement => {
  const mapSession = useMapSession();
  const overlays = useContext(NativeOverlayContext);
  const id = useId();
  const position = useRef(props.position ?? "top-right").current;
  const index = overlays.findIndex((overlay) => overlay.id === id);
  const neighbors = position.startsWith("top")
    ? overlays.slice(0, Math.max(0, index))
    : overlays.slice(index + 1);
  const inset = neighbors
    .filter((overlay) => overlay.position === position && overlay.id !== id)
    .reduce((offset, overlay) => offset + overlay.height + 8, 8);

  useLayoutEffect(() => {
    mapSession.setOverlay(id, position);
    return () => mapSession.setOverlay(id, null);
  }, [mapSession.setOverlay, id, position]);

  // Teleport moves native views only. Rendering children here preserves
  // application providers, local state, and effects in the original React tree.
  return (
    <Portal
      name={id}
      hostName={mapSession.overlayHostName}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        // Android SDK parents leave the source portal detached, so native host
        // notifications may not refresh its constraints. iOS keeps host sizing.
        ...(Platform.OS === "android" ? mapSession.nativeLayout : undefined),
      }}
    >
      <View
        {...props.hostProps}
        pointerEvents="box-none"
        onLayout={(event) => {
          mapSession.setOverlay(id, position, event.nativeEvent.layout.height);
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

const NativeNavigationControl: Adapter["NavigationControl"] = (props) => {
  const mapSession = useMapSession();
  const reportError = useNativeCallback(props.onError);
  const navigate = async (change: number): Promise<void> => {
    const map = mapSession.ref.current;
    if (!map || !mapSession.ready) return;
    try {
      // Region-change snapshots can precede the settled renderer zoom.
      const zoom = await map.getZoom();
      await map.zoomTo(
        Math.max(
          mapSession.minZoom ?? 0,
          Math.min(mapSession.maxZoom ?? 24, zoom + change)
        )
      );
    } catch (error) {
      reportError(error);
    }
  };
  const resetNorth = async (): Promise<void> => {
    const map = mapSession.ref.current;
    if (!map || !mapSession.ready) return;
    try {
      await map.easeTo({
        bearing: 0,
        ...(props.visualizePitch ? { pitch: 0 } : {}),
      });
    } catch (error) {
      reportError(error);
    }
  };
  return (
    <NativeControl position={props.position}>
      <View style={{ backgroundColor: "white", borderRadius: 4 }}>
        {props.showZoom !== false && (
          <>
            <ControlButton
              label="Zoom in"
              disabled={!mapSession.ready}
              onPress={() => void navigate(1)}
            >
              +
            </ControlButton>
            <ControlButton
              label="Zoom out"
              disabled={!mapSession.ready}
              onPress={() => void navigate(-1)}
            >
              −
            </ControlButton>
          </>
        )}
        {props.showCompass !== false && (
          <ControlButton
            label="Reset north"
            disabled={!mapSession.ready}
            onPress={() => void resetNorth()}
          >
            <Text
              style={{
                transform: [
                  { rotate: `${-(mapSession.viewState?.bearing ?? 0)}deg` },
                  ...(props.visualizePitch
                    ? [
                        { perspective: 400 },
                        { rotateX: `${mapSession.viewState?.pitch ?? 0}deg` },
                      ]
                    : []),
                ],
              }}
            >
              ↑
            </Text>
          </ControlButton>
        )}
      </View>
    </NativeControl>
  );
};

const NativeAttributionControl: Adapter["AttributionControl"] = (props) => {
  const mapSession = useMapSession();
  const position = useRef(props.position ?? "bottom-right").current;
  useLayoutEffect(() => {
    mapSession.setOrnament("attribution", { position });
    return () => mapSession.setOrnament("attribution", null);
  }, [mapSession.setOrnament, position]);
  if (props.compact === false) {
    throw new Error(
      "Native AttributionControl does not support expanded attribution."
    );
  }
  if (!props.customAttribution) return null;
  const attribution = Array.isArray(props.customAttribution)
    ? props.customAttribution.join(" · ")
    : props.customAttribution;
  return (
    <NativeControl position={position}>
      <Text style={{ backgroundColor: "white", fontSize: 10 }}>
        {attribution}
      </Text>
    </NativeControl>
  );
};

const NativeScaleControl = (props: ScaleControlProps): ReactElement | null => {
  const mapSession = useMapSession();
  const [scale, setScale] = useState<{
    readonly width: number;
    readonly text: string;
  } | null>(null);
  const maxWidth = useRef(props.maxWidth ?? 100).current;
  const reportError = useNativeCallback(props.onError);
  const unit = props.unit ?? "metric";
  if (!Number.isFinite(maxWidth) || maxWidth <= 0)
    throw new Error("ScaleControl maxWidth must be positive and finite.");

  // Wrapper imperative handles attach after descendant layout effects.
  useEffect(() => {
    let active = true;
    let request = 0;
    const updateScale = async (): Promise<void> => {
      const map = mapSession.ref.current;
      if (!map || !mapSession.ready) return;
      const sequence = ++request;
      try {
        const center = mapSession.viewState
          ? ([
              mapSession.viewState.longitude,
              mapSession.viewState.latitude,
            ] as const)
          : await map.getCenter();
        const origin = await map.project(center);
        const end = await map.unproject([origin[0] + maxWidth, origin[1]]);
        const meters = groundDistance(center, end);
        if (active && sequence === request && meters > 0) {
          setScale(scaleDisplay(meters, maxWidth, unit));
        }
      } catch (error) {
        if (active && sequence === request) {
          setScale(null);
          reportError(error);
        }
      }
    };
    void updateScale();
    const remove = mapSession.subscribe("move", () => void updateScale());
    return () => {
      active = false;
      remove();
    };
  }, [
    mapSession.ready,
    mapSession.subscribe,
    mapSession.ref,
    mapSession.viewState,
    maxWidth,
    unit,
    reportError,
  ]);

  if (!scale) return null;
  return (
    <NativeControl position={props.position ?? "bottom-left"}>
      <View
        style={{
          width: scale.width,
          backgroundColor: "rgba(255,255,255,0.8)",
          borderColor: "black",
          borderWidth: 1,
          borderTopWidth: 0,
        }}
      >
        <Text style={{ fontSize: 10 }}>{scale.text}</Text>
      </View>
    </NativeControl>
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

const NativeFullscreenControl: Adapter["FullscreenControl"] = () => {
  throw new Error("FullscreenControl requires a browser fullscreen API.");
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

const pagePoint = (event: GestureResponderEvent): Point => [
  event.nativeEvent.pageX,
  event.nativeEvent.pageY,
];

const distance = (first: Point, second: Point): number =>
  Math.hypot(first[0] - second[0], first[1] - second[1]);

const groundDistance = (first: LngLat, second: LngLat): number => {
  const radians = Math.PI / 180;
  const latitudeDelta = (second[1] - first[1]) * radians;
  const longitudeDelta = (second[0] - first[0]) * radians;
  const chord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(first[1] * radians) *
      Math.cos(second[1] * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    6371008.8 *
    2 *
    Math.atan2(Math.sqrt(chord), Math.sqrt(Math.max(0, 1 - chord)))
  );
};

const scaleDisplay = (
  meters: number,
  maxWidth: number,
  unit: ScaleControlProps["unit"]
): { readonly width: number; readonly text: string } => {
  let divisor = 1;
  let suffix = "m";
  if (unit === "nautical") {
    divisor = 1852;
    suffix = "nm";
  } else if (unit === "imperial") {
    divisor = meters >= 1609.344 ? 1609.344 : 0.3048;
    suffix = meters >= 1609.344 ? "mi" : "ft";
  } else if (meters >= 1000) {
    divisor = 1000;
    suffix = "km";
  }
  const amount = meters / divisor;
  const magnitude = 10 ** Math.floor(Math.log10(amount));
  const rounded = [5, 2, 1].find((step) => step * magnitude <= amount) ?? 1;
  const value = rounded * magnitude;
  return {
    width: (maxWidth * value) / amount,
    text: `${Number(value.toPrecision(3))} ${suffix}`,
  };
};

const nativeMaxWidth = (width: number | string | undefined): number => {
  if (width === undefined) return 240;
  if (typeof width === "number") {
    if (!Number.isFinite(width) || width <= 0)
      throw new Error("Native Popup maxWidth must be a positive finite width.");
    return width;
  }
  if (/^\d+(?:\.\d+)?(?:px)?$/.test(width))
    return nativeMaxWidth(Number.parseFloat(width));
  throw new Error("Native Popup maxWidth requires a number or a pixel width.");
};

/** Keeps callback identity stable while committed callback ownership stays current. */
const useNativeCallback = <Args extends unknown[]>(
  callback: ((...args: Args) => void) | undefined
): ((...args: Args) => void) => useRef(useActiveCallback(callback)).current;
