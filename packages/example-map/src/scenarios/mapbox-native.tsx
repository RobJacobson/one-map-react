import { type MapRef, MapSetup } from "one-map-react";
import {
  adapter,
  type NativeMapProps,
  WrapperLocationManager,
  WrapperOfflineManager,
  offlineManagerLegacy,
  TileStore,
  CustomLocationProvider,
  LocationPuck,
} from "one-map-react/mapbox-native";
import { useRef } from "react";
import { Button, NativeModules, StyleSheet, Text, View } from "react-native";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import { useLifecycleSmoke } from "./lifecycle-smoke.js";
import { createMapboxOfflineCommands } from "./mapbox-offline-commands.js";
import { createMapboxSnapshot } from "./mapbox-snapshot.js";
import { NativeCameraScreen } from "./native-camera-screen.js";
import { NativeLifetimesScreen } from "./native-lifetimes-screen.js";
import {
  acquireNativeLocation,
  requestNativeLocationPermission,
} from "./native-location.js";
import { NativeModelScene } from "./native-model-scene.js";
import { NativeQueriesScreen } from "./native-queries-screen.js";
import { NativeSourcesScreen } from "./native-sources-screen.js";
import { NativeTf07FocusedScreen } from "./native-tf07-focused-screen.js";
import { NativeTf07RetainedScreen } from "./native-tf07-retained-screen.js";
import { NativeTf07Screen } from "./native-tf07-screen.js";
import { NativeTf08Screen } from "./native-tf08-screen.js";
import { NativeTf09Screen } from "./native-tf09-screen.js";
import { RouteMap } from "./route-map.js";

/** Uses the wrapper's SDK network switch while keeping test transport available. */
const setNetworkConnected = (connected: boolean): Promise<boolean> =>
  (
    NativeModules.RNMBXModule as {
      setConnected: (connected: boolean) => Promise<boolean>;
    }
  ).setConnected(connected);

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
    (await offlineManagerLegacy.getPacks()).map(
      (pack: { name: string; metadata: unknown }) => ({
        name: pack.name,
        metadata: pack.metadata,
      })
    ),
  migrate: () => WrapperOfflineManager.migrateOfflineCache(),
  "tile-limit": () => WrapperOfflineManager.setTileCountLimit(1000),
  throttle: () => WrapperOfflineManager.setProgressEventThrottle(300),
  reset: () => WrapperOfflineManager.resetDatabase(),
  packs: async () => (await WrapperOfflineManager.getPacks()).length,
  quota: async () =>
    (await TileStore.shared()).setOption("disk-quota", "Maps", 8 * 1024 * 1024),
  "legacy-list": async () => (await offlineManagerLegacy.getPacks()).length,
  "legacy-migrate": () => offlineManagerLegacy.migrateOfflineCache(),
  "legacy-limit": () => offlineManagerLegacy.setTileCountLimit(1000),
  "legacy-reset": () => offlineManagerLegacy.resetDatabase(),
  "legacy-create": async () => {
    await offlineManagerLegacy.createPack({
      name: "tf08-legacy-pending",
      styleURL: "http://127.0.0.1:8798/style.json",
      bounds: [
        [10, 10],
        [-10, -10],
      ],
      minZoom: 0,
      maxZoom: 0,
    });
    return (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.name;
  },
  "legacy-status": async () =>
    (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.status(),
  "legacy-pause": async () =>
    (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.pause(),
  "legacy-resume": async () =>
    (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.resume(),
  "legacy-invalidate": () =>
    offlineManagerLegacy.invalidatePack("tf08-legacy-pending"),
  "legacy-delete": async () => {
    await offlineManagerLegacy.deletePack("tf08-legacy-pending");
    return (
      (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.name ?? null
    );
  },
};

const getCurrentPosition = (signal?: AbortSignal, timeoutMs?: number) =>
  acquireNativeLocation(WrapperLocationManager, "mapbox", signal, timeoutMs);
const requestLocationPermission = () => requestNativeLocationPermission();

const App = ({ scenario }: { readonly scenario: AcceptanceScenario }) => {
  if (scenario === "tf09-model")
    return <NativeTf09Screen adapter={adapter} scene={NativeModelScene} />;
  if (scenario === "tf09") return <NativeTf09Screen adapter={adapter} />;
  if (scenario === "tf08" || scenario === "tf08-storage")
    return (
      <NativeTf08Screen
        adapter={adapter}
        createSnapshot={createMapboxSnapshot}
        getCurrentPosition={getCurrentPosition}
        requestLocationPermission={requestLocationPermission}
        getLocationDiagnostic={() =>
          WrapperLocationManager.getLastKnownLocation()
        }
        setNetworkConnected={setNetworkConnected}
        offlineOperations={offlineOperations}
        createOfflineCommands={createMapboxOfflineCommands}
        startDetached={scenario === "tf08-storage"}
        nativePuck={
          <>
            <CustomLocationProvider coordinate={[-122.34, 47.615]} />
            <LocationPuck puckBearingEnabled={false} />
          </>
        }
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
    return <NativeCameraScreen adapter={adapter} doubleTap={false} />;
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
const tf07Ornaments = {
  scaleBarEnabled: true,
  scaleBarPosition: { top: 64, left: 8 },
  compassPosition: { top: 148, right: 8 },
} satisfies NativeMapProps["options"];
