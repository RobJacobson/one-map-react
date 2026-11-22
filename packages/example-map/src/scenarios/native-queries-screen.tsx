import { Platform, StyleSheet, Text, View } from "react-native";

import { QueriesMap } from "./queries-map.js";
import { useQueriesSmoke } from "./queries-smoke.js";
import type { NativeSceneComponents } from "./scene-components.js";
import { useNativeMapRef } from "./use-native-map-ref.js";

interface NativeQueriesScreenProps {
  readonly components: NativeSceneComponents;
}

/**
 * Native example shell for the TF06 queries smoke.
 *
 * The status line is the result. iOS posts it to the runner's status port;
 * Android reads it from logcat.
 */
export const NativeQueriesScreen = ({
  components,
}: NativeQueriesScreenProps) => {
  const [mapRef, attachMap] = useNativeMapRef();
  const smoke = useQueriesSmoke({
    mapRef,
    statusUrl: Platform.OS === "ios" ? "http://127.0.0.1:8799/tf06" : undefined,
  });

  return (
    <View style={styles.screen}>
      <Text testID="tf06-status">{smoke.status}</Text>
      <QueriesMap
        components={components}
        ref={attachMap}
        mapStyle={smoke.mapStyle}
        sourceRevision={smoke.sourceRevision}
        style={{ flex: 1 }}
        onLoad={smoke.onLoad}
        onStyleLoad={smoke.onStyleLoad}
        onError={smoke.onError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
