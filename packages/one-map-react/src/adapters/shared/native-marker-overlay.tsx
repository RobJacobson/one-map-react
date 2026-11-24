import {
  type ReactElement,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useState,
} from "react";
import { View } from "react-native";
import { Portal } from "react-native-teleport";

import type { NativeBackend } from "../../contracts/backend.js";
import type { Point } from "../../contracts/camera-types.js";
import type { Anchor } from "../../contracts/ui-types.js";
import { useMapSession } from "../../facade/map-context.js";
import {
  NativeCameraContext,
  useNativeMapPresentation,
} from "./native-map-presentation.js";
import type { NativeMarkerOverlayProps } from "./native-ui.js";
import { updateLayoutSize } from "./wrapper-values.js";

/**
 * Projects live children into the map's native overlay, outside SDK recognizers.
 * Native reparenting retains their original React providers and component state.
 *
 * @param props - Live marker content and its placement on the map.
 * @returns The projected marker in the native portal.
 */
export const NativeMarkerOverlay = (
  props: NativeMarkerOverlayProps
): ReactElement => {
  const session = useMapSession();
  const { backend } = session.components;
  const presentation = useNativeMapPresentation();
  const observed = useContext(NativeCameraContext);
  const name = useId();
  const [point, setPoint] = useState<Point | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reportError = useEffectEvent((error: unknown) =>
    props.onProjectionError?.(error)
  );
  const longitude = props.lngLat[0];
  const latitude = props.lngLat[1];

  // Viewport dimensions change projection even when the camera is unchanged.
  useEffect(() => {
    let active = true;
    const project = async (): Promise<void> => {
      const map = session.ref.current;
      if (!map || !session.ready) return;
      try {
        const next = await map.project([longitude, latitude]);
        // Reserve the off-screen (-1, -1) sentinel for RNMapbox.
        if (active) setPoint(visiblePoint(next, backend));
      } catch (error) {
        if (active) {
          setPoint(null);
          reportError(error);
        }
      }
    };
    void project();
    return () => {
      active = false;
    };
  }, [
    session.ref,
    session.ready,
    observed,
    presentation.nativeLayout,
    longitude,
    latitude,
    backend,
  ]);

  const [horizontal, vertical] = anchorFraction(props.anchor);
  return (
    <Portal
      name={name}
      hostName={presentation.overlayHostName}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <View
        testID="native-marker-overlay"
        pointerEvents={point ? "auto" : "none"}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize((previous) => updateLayoutSize(previous, width, height));
        }}
        style={{
          position: "absolute",
          opacity: point ? 1 : 0,
          left: (point?.[0] ?? 0) + props.offset[0] - horizontal * size.width,
          top: (point?.[1] ?? 0) + props.offset[1] - vertical * size.height,
        }}
      >
        {props.children}
      </View>
    </Portal>
  );
};

/**
 * Converts a marker anchor to fractions of the content bounds.
 *
 * @param anchor - Named anchor on the marker content.
 * @returns Horizontal and vertical fractions from the top-left corner.
 * @remarks Raw JavaScript strings match direction substrings, with left and
 * top taking precedence and unmatched axes staying centered.
 */
export const anchorFraction = (anchor: Anchor): readonly [number, number] => [
  fractionOnAxis(anchor, "left", "right"),
  fractionOnAxis(anchor, "top", "bottom"),
];

const fractionOnAxis = (anchor: Anchor, start: string, end: string): number => {
  if (anchor.includes(start)) return 0;
  return anchor.includes(end) ? 1 : 0.5;
};

const visiblePoint = (point: Point, backend: NativeBackend): Point | null =>
  backend === "mapbox-native" && point[0] === -1 && point[1] === -1
    ? null
    : point;
