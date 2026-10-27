import type { MapRef } from "one-map-react";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * Renders application camera actions beside the TF07 map.
 *
 * @param props - Current screen map, failure reporting and fixture limits.
 * @returns Accessible camera buttons with application-owned pending intents.
 */
export const NativeCameraButtons = ({
  mapRef,
  onError,
  minZoom = 0,
  maxZoom = 24,
  showNorth = true,
}: {
  readonly mapRef: RefObject<MapRef | null>;
  readonly onError: (error: unknown) => void;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly showNorth?: boolean;
}) => {
  // Pending readbacks belong to this mounted screen intent and concrete map.
  const intent = useRef(0);
  useLayoutEffect(
    () => () => {
      intent.current += 1;
    },
    []
  );
  const navigate = async (change?: number): Promise<void> => {
    const map = mapRef.current;
    if (!map) return;
    const request = ++intent.current;
    const current = () => request === intent.current && mapRef.current === map;
    try {
      if (change === undefined) {
        await map.easeTo({ bearing: 0 });
      } else {
        const zoom = await map.getZoom();
        if (current())
          await map.zoomTo(Math.max(minZoom, Math.min(maxZoom, zoom + change)));
      }
    } catch (error) {
      if (current()) onError(error);
    }
  };
  return (
    <View
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "white",
      }}
    >
      {(
        [
          ["Zoom in", 1],
          ["Zoom out", -1],
          ...(showNorth ? [["Reset north", undefined] as const] : []),
        ] as const
      ).map(([label, change]) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => void navigate(change)}
          style={{
            minWidth: 44,
            minHeight: 44,
            justifyContent: "center",
            padding: 8,
          }}
        >
          <Text>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
};
