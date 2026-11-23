import type { ComponentProps, ReactElement } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import { useLifecycleSmoke } from "./lifecycle-smoke.js";
import { NativeCameraScreen } from "./native-camera-screen.js";
import { NativeLifetimesScreen } from "./native-lifetimes-screen.js";
import { NativeQueriesScreen } from "./native-queries-screen.js";
import { NativeSourcesScreen } from "./native-sources-screen.js";
import { NativeTf07FocusedScreen } from "./native-tf07-focused-screen.js";
import { NativeTf07RetainedScreen } from "./native-tf07-retained-screen.js";
import { NativeTf07Screen } from "./native-tf07-screen.js";
import { NativeTf08Screen } from "./native-tf08-screen.js";
import { NativeTf09Screen } from "./native-tf09-screen.js";
import { RouteMap } from "./route-map.js";
import type { NativeSceneComponents } from "./scene-components.js";
import { useNativeMapRef } from "./use-native-map-ref.js";

interface NativeAcceptanceSceneProps {
  readonly scenario: AcceptanceScenario;
  readonly components: NativeSceneComponents;
  readonly doubleTap: boolean;
  readonly ornaments: ComponentProps<typeof NativeTf07Screen>["ornaments"];
  readonly services: Omit<
    ComponentProps<typeof NativeTf08Screen>,
    "components" | "startDetached"
  >;
  readonly modelScene?: ComponentProps<typeof NativeTf09Screen>["scene"];
}

/**
 * Dispatches native acceptance scenarios using the selected backend.
 *
 * @param props - Scenario, renderer components, and SDK services.
 * @returns The requested acceptance screen.
 * @throws When the selected backend cannot run the scenario.
 */
export const NativeAcceptanceScene = ({
  scenario,
  components,
  doubleTap,
  ornaments,
  services,
  modelScene,
}: NativeAcceptanceSceneProps): ReactElement => {
  switch (scenario) {
    case "tf03":
      return <LifecycleApp components={components} />;
    case "tf04":
      return (
        <NativeCameraScreen components={components} doubleTap={doubleTap} />
      );
    case "tf05":
      return <NativeSourcesScreen components={components} />;
    case "tf06":
      return <NativeQueriesScreen components={components} />;
    case "tf06-lifetimes":
      return <NativeLifetimesScreen components={components} />;
    case "tf07":
      return <NativeTf07Screen components={components} ornaments={ornaments} />;
    case "tf07-focused":
      return <NativeTf07FocusedScreen components={components} />;
    case "tf07-retained":
      return <NativeTf07RetainedScreen components={components} />;
    case "tf08":
    case "tf08-storage":
      return (
        <NativeTf08Screen
          {...services}
          components={components}
          startDetached={scenario === "tf08-storage"}
        />
      );
    case "tf09":
      return <NativeTf09Screen components={components} />;
    case "tf09-model":
      if (!modelScene) {
        throw new Error("The selected model fixture requires native Mapbox.");
      }
      return <NativeTf09Screen components={components} scene={modelScene} />;
    case "corrections":
    case "global-state":
      throw new Error(`${scenario} is a web acceptance scenario.`);
    default:
      scenario satisfies never;
      throw new Error(`Unknown native acceptance scenario: ${scenario}`);
  }
};

const LifecycleApp = ({
  components,
}: {
  readonly components: NativeSceneComponents;
}): ReactElement => {
  const [mapRef, attachMap] = useNativeMapRef();
  const smoke = useLifecycleSmoke({
    mapRef,
    failureStyleUrl: "http://127.0.0.1:8798/missing-style.json",
  });

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Button title="Fly north" onPress={smoke.flyNorth} />
        <Button title="Remount" onPress={smoke.remount} />
        <Button title="Bad style" onPress={smoke.failStyle} />
      </View>
      <Text testID="tf03-status">{smoke.status}</Text>
      <RouteMap
        key={smoke.generation}
        components={components}
        ref={attachMap}
        mapStyle={smoke.mapStyle}
        style={{ flex: 1 }}
        onLoad={smoke.onLoad}
        onStyleLoad={smoke.onStyleLoad}
        onError={smoke.onError}
        onMove={smoke.onMove}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { padding: 8 },
});
