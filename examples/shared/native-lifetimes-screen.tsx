import type { Adapter, MapRef } from "one-map-react";
import { MapSetup } from "one-map-react";
import { useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { LifetimesMap } from "./lifetimes-map.js";
import { useLifetimesSmoke } from "./lifetimes-smoke.js";

interface NativeLifetimesScreenProps {
  readonly adapter: Adapter;
}

/** Native TF06 vector and family lifetime shell; status reports observed state. */
export const NativeLifetimesScreen = ({
  adapter,
}: NativeLifetimesScreenProps) => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useLifetimesSmoke({
    mapRef,
    statusUrl:
      Platform.OS === "ios"
        ? "http://127.0.0.1:8799/tf06-lifetimes"
        : undefined,
  });

  return (
    <MapSetup adapter={adapter}>
      <View style={styles.screen}>
        <Text testID="tf06-lifetimes-status">{smoke.status}</Text>
        <LifetimesMap
          ref={mapRef}
          family={smoke.family}
          mapStyle={smoke.mapStyle}
          sourceRevision={smoke.sourceRevision}
          style={{ flex: 1 }}
          onLoad={smoke.onLoad}
          onStyleLoad={smoke.onStyleLoad}
          onError={smoke.onError}
        />
      </View>
    </MapSetup>
  );
};

const styles = StyleSheet.create({ screen: { flex: 1 } });
