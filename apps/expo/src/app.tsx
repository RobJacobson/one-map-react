import { Button, Host, Row } from "@expo/ui";
import {
  ExampleMap,
  publicMapboxToken,
  useExampleMap,
} from "@one-map/example-map";
import { StyleSheet, Text, View } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Metro selects the platform setup before bundling either renderer family.
import { adapters, configureMapbox } from "./engines";

const token = publicMapboxToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
configureMapbox(token);

/** Expo entry shared by iOS, Android, and its Metro-powered web target. */
export const App = () => (
  <SafeAreaProvider>
    <MapScreen />
  </SafeAreaProvider>
);

const MapScreen = () => {
  const model = useExampleMap(adapters, Boolean(token));
  const insets = useSafeAreaInsets();
  const testMode = __DEV__ && process.env.EXPO_PUBLIC_ONE_MAP_TEST_MODE === "1";
  const disabled = model.status === "loading" || model.status === "switching";
  return (
    <View style={styles.screen}>
      <ExampleMap model={model} style={{ flex: 1 }} />
      <View style={[styles.controls, { top: insets.top + 16 }]}>
        <Host matchContents>
          <Row>
            <Button
              variant={
                model.attachment.engine === "maplibre" ? "filled" : "outlined"
              }
              testID="engine-maplibre"
              disabled={disabled}
              onPress={() => {
                void model.selectEngine("maplibre");
              }}
            >
              MapLibre
              {model.attachment.engine === "maplibre" ? " (selected)" : ""}
            </Button>
            <Button
              variant={
                model.attachment.engine === "mapbox" ? "filled" : "outlined"
              }
              testID="engine-mapbox"
              disabled={disabled || !token}
              onPress={() => {
                void model.selectEngine("mapbox");
              }}
            >
              Mapbox{model.attachment.engine === "mapbox" ? " (selected)" : ""}
            </Button>
          </Row>
        </Host>
        {!token && (
          <Text selectable style={styles.message}>
            Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to enable Mapbox.
          </Text>
        )}
        {(testMode || model.status !== "ready") && (
          <Text selectable accessibilityLiveRegion="polite" testID="map-status">
            {model.status}
          </Text>
        )}
        {model.error && (
          <View>
            <Text selectable accessibilityRole="alert">
              {model.error}
            </Text>
            <Host matchContents>
              <Button
                onPress={() => {
                  void model.selectEngine(model.attachment.engine);
                }}
              >
                Retry
              </Button>
            </Host>
          </View>
        )}
        {testMode && (
          <View>
            <Text selectable>Scenario: Basemap and engine switching</Text>
            <Host matchContents>
              <Button
                disabled={disabled}
                onPress={() => {
                  void model.inspectCamera();
                }}
              >
                Read camera
              </Button>
            </Host>
            <Text selectable testID="camera-readback">
              {JSON.stringify(model.camera)}
            </Text>
            <Text selectable testID="map-generation">
              {model.attachment.generation}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: "90%",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    boxShadow: "0 2px 12px #0003",
  },
  message: { maxWidth: 290 },
});
