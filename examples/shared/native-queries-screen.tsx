import type { Adapter, MapRef } from "one-map-react";
import { MapSetup } from "one-map-react";
import { useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { QueriesMap } from "./queries-map.js";
import { useQueriesSmoke } from "./queries-smoke.js";

interface NativeQueriesScreenProps {
  readonly adapter: Adapter;
}

/**
 * Native example shell for the TF06 queries smoke.
 *
 * @remarks
 * The status line is the result. iOS posts it to the runner's status port;
 * Android reads it from logcat.
 */
export const NativeQueriesScreen = ({ adapter }: NativeQueriesScreenProps) => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useQueriesSmoke({
    mapRef,
    statusUrl: Platform.OS === "ios" ? "http://127.0.0.1:8799/tf06" : undefined,
  });

  return (
    <MapSetup adapter={adapter}>
      <View style={styles.screen}>
        <Text testID="tf06-status">{smoke.status}</Text>
        <QueriesMap
          ref={mapRef}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
