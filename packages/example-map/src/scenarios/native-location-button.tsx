import type { GeolocationPosition, MapRef } from "one-map-react";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

/** Application-owned one-shot location action; acquisition belongs to the caller. */
export interface NativeLocationButtonProps {
  /** Current map attachment receiving this explicit camera request. */
  readonly mapRef: RefObject<MapRef | null>;
  /** Acquires one fix and honors cancellation when its integration supports it. */
  readonly getCurrentPosition: (
    signal: AbortSignal
  ) => Promise<GeolocationPosition>;
  /** Screen corner chosen by this application; defaults to the left. */
  readonly corner?: "left" | "right";
  /** Camera zoom after acquisition; defaults to 14. */
  readonly zoom?: number;
  /** Reports the fix after camera dispatch is acknowledged. */
  readonly onGeolocate?: (position: GeolocationPosition) => void;
  /** Reports current acquisition or camera failures. */
  readonly onError: (error: unknown) => void;
}

/**
 * Renders an accessible screen button with one owned cancellable request.
 *
 * @param props - Application acquisition, current map and outcome callbacks.
 * @returns Screen UI for a one-shot camera action.
 */
export const NativeLocationButton = ({
  mapRef,
  getCurrentPosition,
  zoom = 14,
  corner = "left",
  onGeolocate,
  onError,
}: NativeLocationButtonProps) => {
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  useLayoutEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    []
  );
  const locate = async (): Promise<void> => {
    const map = mapRef.current;
    if (!map || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    const current = () =>
      request.current === controller &&
      !controller.signal.aborted &&
      mapRef.current === map;
    try {
      const position = await getCurrentPosition(controller.signal);
      if (!current()) return;
      const [longitude, latitude] = position.lngLat;
      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90
      )
        throw new Error("Invalid location coordinate.");
      const measured = { ...position, lngLat: [longitude, latitude] as const };
      await map.easeTo({ center: measured.lngLat, zoom });
      if (current()) onGeolocate?.(measured);
    } catch (error) {
      if (current()) onError(error);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  };
  return (
    <View style={{ position: "absolute", top: 8, [corner]: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Locate me"
        accessibilityState={{ disabled: pending }}
        disabled={pending}
        onPress={() => void locate()}
        style={{
          minWidth: 44,
          minHeight: 44,
          padding: 8,
          backgroundColor: "white",
        }}
      >
        <Text>Locate me</Text>
      </Pressable>
    </View>
  );
};
