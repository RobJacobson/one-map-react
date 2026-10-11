import { type MapRef, MapSetup } from "one-map-react";
import { adapter } from "one-map-react/maplibre-native";
import { useRef } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { useLifecycleSmoke } from "../shared/lifecycle-smoke.js";
import { NativeCameraScreen } from "../shared/native-camera-screen.js";
import { RouteMap } from "../shared/route-map.js";
import { smokeTarget } from "../shared/smoke-target.js";

const App = () =>
  smokeTarget === "tf04" ? (
    <NativeCameraScreen adapter={adapter} doubleTap />
  ) : (
    <LifecycleApp />
  );

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
