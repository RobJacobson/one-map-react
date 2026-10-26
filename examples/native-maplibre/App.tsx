import { type MapRef, MapSetup } from "one-map-react";
import {
  adapter,
  WrapperLocationManager,
  WrapperOfflineManager,
  NativeUserLocation,
} from "one-map-react/maplibre-native";
import { useRef } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { useLifecycleSmoke } from "../shared/lifecycle-smoke.js";
import { createMaplibreOfflineCommands } from "../shared/maplibre-offline-commands.js";
import { createMaplibreSnapshot } from "../shared/maplibre-snapshot.js";
import { NativeCameraScreen } from "../shared/native-camera-screen.js";
import { NativeLifetimesScreen } from "../shared/native-lifetimes-screen.js";
import { NativeQueriesScreen } from "../shared/native-queries-screen.js";
import { NativeSourcesScreen } from "../shared/native-sources-screen.js";
import { NativeTf07Screen } from "../shared/native-tf07-screen.js";
import { NativeTf08Screen } from "../shared/native-tf08-screen.js";
import { NativeTf09Screen } from "../shared/native-tf09-screen.js";
import { RouteMap } from "../shared/route-map.js";
import { smokeTarget } from "../shared/smoke-target.js";

// Destructive operations are only invoked by the isolated pending acceptance scope.
const offlineOperations = {
  "ambient-invalidate": () => WrapperOfflineManager.invalidateAmbientCache(),
  "ambient-clear": () => WrapperOfflineManager.clearAmbientCache(),
  "ambient-size": () =>
    WrapperOfflineManager.setMaximumAmbientCacheSize(16 * 1024 * 1024),
  "merge-missing": () =>
    WrapperOfflineManager.mergeOfflineRegions("/tf08-missing.db"),
  "merge-valid": (value: Record<string, unknown>) =>
    WrapperOfflineManager.mergeOfflineRegions(String(value.path)),
  "storage-packs": async () =>
    (await WrapperOfflineManager.getPacks()).map(
      (pack: { id: string; metadata: unknown }) => ({
        id: pack.id,
        metadata: pack.metadata,
      })
    ),
  "tile-limit": () => WrapperOfflineManager.setTileCountLimit(1000),
  throttle: () => WrapperOfflineManager.setProgressEventThrottle(300),
  reset: () => WrapperOfflineManager.resetDatabase(),
  packs: async () => (await WrapperOfflineManager.getPacks()).length,
};

const App = () => {
  if (smokeTarget === "tf09") return <NativeTf09Screen adapter={adapter} />;
  if (smokeTarget === "tf08" || smokeTarget === "tf08-storage")
    return (
      <NativeTf08Screen
        adapter={adapter}
        createSnapshot={createMaplibreSnapshot}
        getLocationDiagnostic={() =>
          WrapperLocationManager.getCurrentPosition()
        }
        offlineOperations={offlineOperations}
        createOfflineCommands={createMaplibreOfflineCommands}
        startDetached={smokeTarget === "tf08-storage"}
        nativePuck={<NativeUserLocation />}
      />
    );
  if (smokeTarget === "tf07") return <NativeTf07Screen adapter={adapter} />;
  if (smokeTarget === "tf06-lifetimes") {
    return <NativeLifetimesScreen adapter={adapter} />;
  }

  if (smokeTarget === "tf06") {
    return <NativeQueriesScreen adapter={adapter} />;
  }

  if (smokeTarget === "tf05") {
    return <NativeSourcesScreen adapter={adapter} />;
  }

  if (smokeTarget === "tf04") {
    return <NativeCameraScreen adapter={adapter} doubleTap />;
  }

  return <LifecycleApp />;
};

const LifecycleApp = () => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useLifecycleSmoke({
    mapRef,
    failureStyleUrl: "https://example.invalid/one-map-missing-style.json",
  });

  return (
    <MapSetup adapter={adapter}>
      <View style={styles.screen}>
        <View style={styles.toolbar}>
          <Button title="Fly north" onPress={smoke.flyNorth} />
          <Button title="Remount" onPress={smoke.remount} />
          <Button title="Bad style" onPress={smoke.failStyle} />
        </View>
        <Text testID="tf03-status">{smoke.status}</Text>
        <RouteMap
          key={smoke.generation}
          ref={mapRef}
          mapStyle={smoke.mapStyle}
          style={{ flex: 1 }}
          onLoad={smoke.onLoad}
          onStyleLoad={smoke.onStyleLoad}
          onError={smoke.onError}
          onMove={smoke.onMove}
        />
      </View>
    </MapSetup>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { padding: 8 },
});

export default App;
