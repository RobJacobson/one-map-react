import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { GestureResponderEvent, ViewProps } from "react-native";

import type { LngLat, Point } from "../../contracts/camera-types.js";
import type { MarkerProps } from "../../contracts/ui-types.js";
import { useMapSession } from "../../facade/map-context.js";
import { useNativeMapPresentation } from "./native-map-presentation.js";

interface NativeMarkerDrag {
  readonly dragCoordinate: LngLat | null;
  readonly responders: ViewProps;
}

/** Owns live-marker touch acquisition, projection requests, and gesture-lock cleanup. */
export const useNativeMarkerDrag = (
  props: MarkerProps,
  {
    onDragStart: dragStart,
    onDrag: drag,
    onDragEnd: dragEnd,
    onError: reportError,
  }: Required<
    Pick<MarkerProps, "onDragStart" | "onDrag" | "onDragEnd" | "onError">
  >
): NativeMarkerDrag => {
  const mapSession = useMapSession();
  const { requestGestureLock } = useNativeMapPresentation();
  const [dragCoordinate, setDragCoordinate] = useState<LngLat | null>(null);
  const previousCoordinate = useRef<LngLat>([props.longitude, props.latitude]);

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
    if (active.current) requestGestureLock(false);
  }, [requestGestureLock]);

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
    // eslint-disable-next-line react/set-state-in-effect -- Revoking draggable must cancel the active gesture and clear its visual offset before paint.
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

  const updateDrag = async (
    pagePoint: Point,
    ending: boolean
  ): Promise<void> => {
    const currentGesture = gesture.current;
    const map = mapSession.ref.current;
    if (!currentGesture || !map) return;
    const sequence = ++requestSequence.current;
    const point: Point = [
      currentGesture.mapOrigin[0] + pagePoint[0] - currentGesture.pageOrigin[0],
      currentGesture.mapOrigin[1] + pagePoint[1] - currentGesture.pageOrigin[1],
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
    requestGestureLock(true);

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
      props.onClick?.({ lngLat: [props.longitude, props.latitude] });
    }
    cancel();
  };

  const responders: ViewProps =
    props.renderMode === "annotation"
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

  return { dragCoordinate, responders };
};

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

const pagePoint = (event: GestureResponderEvent): Point => [
  event.nativeEvent.pageX,
  event.nativeEvent.pageY,
];

const distance = (first: Point, second: Point): number =>
  Math.hypot(first[0] - second[0], first[1] - second[1]);
