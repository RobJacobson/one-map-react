import { Button, Host, Picker, Row } from "@expo/ui";
import { NativeAcceptance } from "@one-map/example-map/acceptance-native";
import {
  acceptanceScenario,
  acceptanceScenarios,
} from "@one-map/example-map/acceptance-selection";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Explicit development launch selection; ordinary startup stays on the basemap. */
export const acceptanceRequested = Boolean(
  process.env.EXPO_PUBLIC_ONE_MAP_SCENARIO
);

/** Native controls and one keyed acceptance map tree, shared by both installed engines. */
export const Acceptance = ({
  token,
  close,
}: {
  readonly token: string;
  readonly close: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const initialEngine = process.env.EXPO_PUBLIC_ONE_MAP_ENGINE ?? "maplibre";
  if (initialEngine !== "mapbox" && initialEngine !== "maplibre")
    throw new Error("Choose mapbox or maplibre.");
  if (initialEngine === "mapbox" && !token)
    throw new Error(
      "Configure a public Mapbox token before Mapbox acceptance."
    );
  const [engine, setEngine] = useState<"mapbox" | "maplibre">(initialEngine);
  const [scenario, setScenario] = useState(
    acceptanceScenario(process.env.EXPO_PUBLIC_ONE_MAP_SCENARIO ?? "tf03")
  );
  const choices = acceptanceScenarios.filter(
    (value) =>
      value !== "global-state" &&
      value !== "corrections" &&
      (value !== "tf09-model" || engine === "mapbox")
  );
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Host matchContents>
        <Row>
          <Button label="Basemap" onPress={close} />
          <Picker
            testID="acceptance-engine"
            selectedValue={engine}
            onValueChange={(value) => {
              setEngine(value);
              if (scenario === "tf09-model" && value !== "mapbox")
                setScenario("tf09");
            }}
          >
            <Picker.Item label="MapLibre" value="maplibre" />
            {token && <Picker.Item label="Mapbox" value="mapbox" />}
          </Picker>
          <Picker
            testID="acceptance-scenario"
            selectedValue={scenario}
            onValueChange={setScenario}
          >
            {choices.map((value) => (
              <Picker.Item key={value} label={value} value={value} />
            ))}
          </Picker>
        </Row>
      </Host>
      <NativeAcceptance engine={engine} scenario={scenario} />
    </View>
  );
};
