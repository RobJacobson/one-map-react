import { type MapRef, MapSetup } from "one-map-react";
import {
  adapter,
  type NativeMapProps,
  WrapperLocationManager,
  WrapperOfflineManager,
  NativeUserLocation,
} from "one-map-react/maplibre-native";
import { useRef } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import { useLifecycleSmoke } from "./lifecycle-smoke.js";
import { createMaplibreOfflineCommands } from "./maplibre-offline-commands.js";
import { createMaplibreSnapshot } from "./maplibre-snapshot.js";
import { NativeCameraScreen } from "./native-camera-screen.js";
import { NativeLifetimesScreen } from "./native-lifetimes-screen.js";
import {
  acquireNativeLocation,
  requestNativeLocationPermission,
} from "./native-location.js";
import { NativeQueriesScreen } from "./native-queries-screen.js";
import { NativeSourcesScreen } from "./native-sources-screen.js";
import { NativeTf07FocusedScreen } from "./native-tf07-focused-screen.js";
import { NativeTf07RetainedScreen } from "./native-tf07-retained-screen.js";
import { NativeTf07Screen } from "./native-tf07-screen.js";
import { NativeTf08Screen } from "./native-tf08-screen.js";
import { NativeTf09Screen } from "./native-tf09-screen.js";
import { RouteMap } from "./route-map.js";

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

const getCurrentPosition = (signal?: AbortSignal, timeoutMs?: number) =>
  acquireNativeLocation(WrapperLocationManager, "maplibre", signal, timeoutMs);
const requestLocationPermission = () =>
  requestNativeLocationPermission(() =>
    WrapperLocationManager.requestPermissions()
  );

const App = ({ scenario }: { readonly scenario: AcceptanceScenario }) => {
  if (scenario === "tf09") return <NativeTf09Screen adapter={adapter} />;
  if (scenario === "tf08" || scenario === "tf08-storage")
    return (
      <NativeTf08Screen
        adapter={adapter}
        createSnapshot={createMaplibreSnapshot}
        getCurrentPosition={getCurrentPosition}
        requestLocationPermission={requestLocationPermission}
        getLocationDiagnostic={() =>
          WrapperLocationManager.getCurrentPosition()
        }
        offlineOperations={offlineOperations}
        createOfflineCommands={createMaplibreOfflineCommands}
        startDetached={scenario === "tf08-storage"}
        nativePuck={<NativeUserLocation />}
      />
    );
  if (scenario === "tf07-retained")
    return <NativeTf07RetainedScreen adapter={adapter} />;
  if (scenario === "tf07-focused")
    return <NativeTf07FocusedScreen adapter={adapter} />;
  if (scenario === "tf07")
    return <NativeTf07Screen adapter={adapter} ornaments={tf07Ornaments} />;
  if (scenario === "tf06-lifetimes") {
    return <NativeLifetimesScreen adapter={adapter} />;
  }

  if (scenario === "tf06") {
    return <NativeQueriesScreen adapter={adapter} />;
  }

  if (scenario === "tf05") {
    return <NativeSourcesScreen adapter={adapter} />;
  }

  if (scenario === "tf04") {
    return <NativeCameraScreen adapter={adapter} doubleTap />;
  }

  return <LifecycleApp />;
};

const LifecycleApp = () => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useLifecycleSmoke({
    mapRef,
    failureStyleUrl: "http://127.0.0.1:8798/missing-style.json",
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

// Native scale units and appearance belong to the selected SDK.
// Leave the top-left corner clear for the application location button.
const tf07Ornaments = {
  scaleBar: true,
  scaleBarPosition: { top: 64, left: 8 },
  compassPosition: { top: 148, right: 8 },
} satisfies NativeMapProps["options"];
