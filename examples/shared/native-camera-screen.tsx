import type { Adapter } from "one-map-react";
import { type MapRef, MapSetup } from "one-map-react";
import { useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useCameraSmoke } from "./camera-smoke.js";
import { RouteMap } from "./route-map.js";

interface NativeCameraScreenProps {
  readonly adapter: Adapter;
  readonly doubleTap: boolean;
}

/**
 * Native example shell for the TF04 camera smoke.
 *
 * The status line is the result. A runner taps the map while `click` is
 * waiting, and double-taps when `doubletap` is waiting.
 */
export const NativeCameraScreen = ({
  adapter,
  doubleTap,
}: NativeCameraScreenProps) => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useCameraSmoke({
    mapRef,
    platform: "native",
    doubleTap,
    statusUrl: Platform.OS === "ios" ? "http://127.0.0.1:8799/tf04" : undefined,
  });

  return (
    <MapSetup adapter={adapter}>
      <View style={styles.screen}>
        <Text testID="tf04-status">{smoke.status}</Text>
        <RouteMap
          ref={mapRef}
          style={{ flex: 1 }}
          viewState={smoke.viewState}
          touchZoom={smoke.touchZoom}
          doubleTapZoom={smoke.doubleTapZoom}
          onLoad={smoke.onLoad}
          onMove={smoke.onMove}
          onMoveEnd={smoke.onMoveEnd}
          onClick={smoke.onClick}
        />
      </View>
    </MapSetup>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
