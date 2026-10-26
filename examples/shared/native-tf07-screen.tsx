import { type Adapter, MapSetup, Marker } from "one-map-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NativeCameraButtons } from "./native-camera-buttons.js";
import { NativePopupBubble } from "./native-popup-bubble.js";
import { type Tf07Action, type Tf07Probe, Tf07Scene } from "./tf07-scene.js";

/**
 * Native TF07 touch fixture, selected by `ONE_MAP_SMOKE=tf07`.
 *
 * Operators perform the documented touch flow and use Read renderer to
 * inspect actual camera/features. A status label alone is not a pass.
 */
export const NativeTf07Screen = ({
  adapter,
}: {
  readonly adapter: Adapter;
}) => {
  const probeRef = useRef<Tf07Probe | null>(null);
  const [status, setStatus] = useState("TF07 waiting for map");
  const [readback, setReadback] = useState("");
  const [sourceStopped, setSourceStopped] = useState(false);
  const attached = useRef(true);
  const attach = useCallback((probe: Tf07Probe | null) => {
    probeRef.current = probe;
  }, []);

  useEffect(() => {
    attached.current = true;
    return () => {
      attached.current = false;
    };
  }, []);

  const read = (): void => {
    const probe = probeRef.current;
    if (!probe) return;
    void Promise.all([probe.read(), probe.project("source")]).then(
      ([renderer, sourcePoint]) => {
        const observation = { ...renderer, sourcePoint };
        if (!attached.current) return;
        setReadback(JSON.stringify(observation));
        void fetch("http://127.0.0.1:8797/tf07", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(observation),
        }).catch(() => {
          if (attached.current) setStatus("TF07 readback transport failed");
        });
      },
      () => {
        if (attached.current) setReadback("TF07 renderer read failed");
      }
    );
  };

  return (
    <MapSetup adapter={adapter}>
      <SafeAreaView
        style={[
          styles.screen,
          Platform.OS === "android" && {
            paddingTop: StatusBar.currentHeight ?? 0,
          },
        ]}
      >
        <ScrollView horizontal style={styles.toolbar}>
          {(["remount", "style", "offset", "popup", "units"] as const).map(
            (action: Tf07Action) => (
              <Button
                key={action}
                title={action}
                onPress={() => probeRef.current?.configure(action)}
              />
            )
          )}
          <Button title="Read renderer" onPress={read} />
          <Button
            title={
              sourceStopped ? "Allow source bubbling" : "Stop source bubbling"
            }
            onPress={() => {
              probeRef.current?.stopSource(!sourceStopped);
              setSourceStopped(!sourceStopped);
            }}
          />
        </ScrollView>
        <Text testID="tf07-status" style={styles.status} numberOfLines={2}>
          {status}
        </Text>
        <Text testID="tf07-readback" style={styles.readback} numberOfLines={3}>
          {readback}
        </Text>
        <Tf07Scene
          renderNavigation={NativeCameraButtons}
          renderPopup={renderPopup}
          native
          style={{ flex: 1 }}
          attach={attach}
          report={(event) => setStatus(`TF07 ${event}`)}
          controlContent={<Text>Custom control</Text>}
          markerContent={(kind, activate) => (
            <View testID={`tf07-${kind}`} style={styles.content}>
              <Text>{kind === "live" ? "Live marker" : kind}</Text>
              {kind !== "annotation" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${kind} child button`}
                  onPress={(event) => {
                    event.stopPropagation();
                    activate();
                  }}
                >
                  <Text>Child button</Text>
                </Pressable>
              )}
              {kind === "live" && (
                <ScrollView style={styles.scroll} nestedScrollEnabled>
                  <Text>Scroll one</Text>
                  <Text>Scroll two</Text>
                  <Text>Scroll three</Text>
                  <Text>Scroll four</Text>
                </ScrollView>
              )}
            </View>
          )}
        />
      </SafeAreaView>
    </MapSetup>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { flexGrow: 0, maxHeight: 48 },
  status: { height: 34 },
  readback: { height: 51 },
  content: { padding: 8, backgroundColor: "white" },
  scroll: { height: 32 },
});

const renderPopup = (
  children: ReactNode,
  onOpen: () => void,
  onClose: () => void
): ReactNode => (
  <Marker longitude={-122.3} latitude={47.63} anchor="bottom">
    <NativePopupBubble onOpen={onOpen} onClose={onClose}>
      {children}
    </NativePopupBubble>
  </Marker>
);
