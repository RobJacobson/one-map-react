import { Platform, StyleSheet, Text, View } from "react-native";

import { LifetimesMap } from "./lifetimes-map.js";
import { useLifetimesSmoke } from "./lifetimes-smoke.js";
import type { NativeSceneComponents } from "./scene-components.js";
import { useNativeMapRef } from "./use-native-map-ref.js";

interface NativeLifetimesScreenProps {
  readonly components: NativeSceneComponents;
}

/** Native TF06 vector and family lifetime shell; status reports observed state. */
export const NativeLifetimesScreen = ({
  components,
}: NativeLifetimesScreenProps) => {
  const [mapRef, attachMap] = useNativeMapRef();
  const smoke = useLifetimesSmoke({
    mapRef,
    statusUrl:
      Platform.OS === "ios"
        ? "http://127.0.0.1:8799/tf06-lifetimes"
        : undefined,
  });

  return (
    <View style={styles.screen}>
      <Text testID="tf06-lifetimes-status">{smoke.status}</Text>
      <LifetimesMap
        components={components}
        ref={attachMap}
        family={smoke.family}
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

const styles = StyleSheet.create({ screen: { flex: 1 } });
