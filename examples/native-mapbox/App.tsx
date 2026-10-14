import * as Mapbox from "@rnmapbox/maps";
import { type MapRef, MapSetup } from "one-map-react";
import { adapter } from "one-map-react/mapbox-native";
import { useRef } from "react";
import { Button, NativeModules, StyleSheet, Text, View } from "react-native";

import { useLifecycleSmoke } from "../shared/lifecycle-smoke.js";
import { NativeCameraScreen } from "../shared/native-camera-screen.js";
import { NativeLifetimesScreen } from "../shared/native-lifetimes-screen.js";
import { NativeQueriesScreen } from "../shared/native-queries-screen.js";
import { NativeSourcesScreen } from "../shared/native-sources-screen.js";
import { NativeTf07Screen } from "../shared/native-tf07-screen.js";
import { NativeTf08Screen } from "../shared/native-tf08-screen.js";
import { RouteMap } from "../shared/route-map.js";
import { smokeTarget } from "../shared/smoke-target.js";

// Mapbox.native.d.ts hides setAccessToken inside a combined const export.
// The runtime module still provides it.
const { setAccessToken } = Mapbox as typeof Mapbox & {
  setAccessToken: (accessToken: string | null) => Promise<string | null>;
};

// Babel inlines the public token from the shell or a .env file.
declare const process: {
  env: { MAPBOX_ACCESS_TOKEN?: string };
};

const mapboxAccessToken = process.env.MAPBOX_ACCESS_TOKEN;

if (!mapboxAccessToken) {
  throw new Error("Set MAPBOX_ACCESS_TOKEN in the shell or a .env file.");
}

void setAccessToken(mapboxAccessToken);

/** Uses the wrapper's SDK network switch while keeping test transport available. */
const setNetworkConnected = (connected: boolean): Promise<boolean> =>
  (
    NativeModules.RNMBXModule as {
      setConnected: (connected: boolean) => Promise<boolean>;
    }
  ).setConnected(connected);

const App = () => {
  if (smokeTarget === "tf08")
    return (
      <NativeTf08Screen
        adapter={adapter}
        setNetworkConnected={setNetworkConnected}
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
    return <NativeCameraScreen adapter={adapter} doubleTap={false} />;
  }

  return <LifecycleApp />;
};

const LifecycleApp = () => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useLifecycleSmoke({
    mapRef,
    failureStyleUrl: "mapbox://styles/mapbox/not-a-style",
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
