import { type ReactElement, useEffect, useId, useState } from "react";
import { View } from "react-native";
import { Portal } from "react-native-teleport";

import type { Point } from "../../contracts/camera-types.js";
import { useMapSession } from "../../facade/map-context.js";
import { useNativeMapPresentation } from "./native-map-presentation.js";
import type { NativeMarkerHostProps } from "./native-ui.js";
import { useActiveCallback } from "./use-active-callback.js";

/**
 * Projects live children into the map's native overlay, outside SDK recognizers.
 * Native reparenting retains their original React providers and component state.
 */
export const NativeMarkerOverlay = (
  props: NativeMarkerHostProps
): ReactElement => {
  const session = useMapSession();
  const presentation = useNativeMapPresentation();
  const name = useId();
  const [point, setPoint] = useState<Point | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reportError = useActiveCallback(props.onProjectionError);
  const longitude = props.lngLat[0];
  const latitude = props.lngLat[1];

  // Viewport dimensions change projection even when the camera is unchanged.
  useEffect(() => {
    let active = true;
    let request = 0;
    const project = async (): Promise<void> => {
      const map = session.ref.current;
      if (!map || !session.ready) return;
      const sequence = ++request;
      try {
        const next = await map.project([longitude, latitude]);
        if (active && sequence === request) setPoint(next);
      } catch (error) {
        if (active && sequence === request) {
          setPoint(null);
          reportError(error);
        }
      }
    };
    void project();
    const remove = session.subscribe("move", () => void project());
    return () => {
      active = false;
      remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actual native layout invalidates screen coordinates.
  }, [
    session.ref,
    session.ready,
    session.subscribe,
    presentation.nativeLayout,
    longitude,
    latitude,
    reportError,
  ]);

  const horizontal = props.anchor.includes("left")
    ? 0
    : props.anchor.includes("right")
      ? 1
      : 0.5;
  const vertical = props.anchor.includes("top")
    ? 0
    : props.anchor.includes("bottom")
      ? 1
      : 0.5;
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
          setSize((previous) =>
            previous.width === width && previous.height === height
              ? previous
              : { width, height }
          );
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
