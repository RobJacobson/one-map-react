import * as Mapbox from "@rnmapbox/maps";
import { type MapRef, MapSetup } from "one-map-react";
import { adapter } from "one-map-react/mapbox-native";
import { useRef, useState } from "react";
import { Button, StyleSheet, View } from "react-native";

import { RouteMap } from "../shared/route-map.js";

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

const App = () => {
  const mapRef = useRef<MapRef>(null);
  const [generation, setGeneration] = useState(0);

  return (
    <MapSetup adapter={adapter}>
      <View style={styles.screen}>
        <View style={styles.toolbar}>
          <Button
            title="Fly north"
            onPress={() => {
              void mapRef.current?.flyTo({
                center: [-122.32, 47.64],
                duration: 1000,
              });
            }}
          />
          <Button
            title="Remount"
            onPress={() => {
              setGeneration((current) => current + 1);
            }}
          />
        </View>
        <RouteMap
          key={generation}
          ref={mapRef}
          style={{ flex: 1 }}
          onMove={(event) => {
            console.log(event.origin, event.viewState);
          }}
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
