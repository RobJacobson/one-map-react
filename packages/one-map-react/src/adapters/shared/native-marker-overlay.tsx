import {
  type ReactElement,
  useContext,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { Portal } from "react-native-teleport";

import type { NativeBackend } from "../../contracts/backend.js";
import type { MapRef, Point } from "../../contracts/camera-types.js";
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
  const { ref, ready, components } = useMapSession();
  const { backend } = components;
  const { nativeLayout, overlayHostName } = useNativeMapPresentation();
  const observed = useContext(NativeCameraContext);
  const name = useId();
  const [point, setPoint] = useState<Point | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reportError = useEffectEvent((error: unknown) =>
    props.onProjectionError?.(error)
  );
  const longitude = props.lngLat[0];
  const latitude = props.lngLat[1];

  const projection = useRef<{
    readonly map: MapRef;
    readonly refresh: () => void;
  } | null>(null);

  // Retire the projection at commit even if there is no new camera sample.
  useLayoutEffect(
    () => () => {
      projection.current = null;
    },
    [ref, ready, nativeLayout, longitude, latitude, backend]
  );

  useLayoutEffect(() => {
    let active = true;
    const request = (): void => {
      const map = ref.current;
      if (!map || !ready) {
        projection.current = null;
        return;
      }
      const previous = projection.current;
      if (previous?.map === map) {
        previous.refresh();
        return;
      }

      let running = false;
      let pending = false;
      const isCurrent = (): boolean =>
        projection.current?.refresh === refresh && ref.current === map;
      const run = async (): Promise<void> => {
        try {
          const next = await map.project([longitude, latitude]);
          // Publish each completed sample even if a newer camera is pending.
          if (isCurrent()) setPoint(visiblePoint(next, backend));
        } catch (error) {
          if (isCurrent()) {
            setPoint(null);
            reportError(error);
          }
        }
      };
      const refresh = (): void => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        pending = false;
        void run().finally(() => {
          running = false;
          if (isCurrent() && pending) refresh();
        });
      };
      projection.current = { map, refresh };
      refresh();
    };

    // The map's imperative ref can attach later in the same layout commit.
    void Promise.resolve().then(() => {
      if (active) request();
    });
    return () => {
      active = false;
    };
  }, [ref, ready, nativeLayout, longitude, latitude, backend, observed]);

  const [horizontal, vertical] = anchorFraction(props.anchor);
  return (
    <Portal
      name={name}
      hostName={overlayHostName}
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
