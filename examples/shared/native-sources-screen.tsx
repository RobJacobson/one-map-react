import type { Adapter } from "one-map-react";
import { MapSetup } from "one-map-react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { SourcesMap } from "./sources-map.js";
import { useSourcesSmoke } from "./sources-smoke.js";
import { tf05Base } from "./tf05-base.js";

interface NativeSourcesScreenProps {
  readonly adapter: Adapter;
}

/**
 * Native example shell for the TF05 sources smoke.
 *
 * @remarks
 * The status line is the result. iOS posts it to the runner's status port;
 * Android reads it from logcat.
 */
export const NativeSourcesScreen = ({ adapter }: NativeSourcesScreenProps) => {
  const smoke = useSourcesSmoke({
    statusUrl: Platform.OS === "ios" ? "http://127.0.0.1:8799/tf05" : undefined,
  });

  return (
    <MapSetup adapter={adapter}>
      <View style={styles.screen}>
        <Text testID="tf05-status">{smoke.status}</Text>
        <SourcesMap
          base={tf05Base}
          mapStyle={smoke.mapStyle}
          routeData={smoke.routeData}
          lineColor={smoke.lineColor}
          showTransient={smoke.showTransient}
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
