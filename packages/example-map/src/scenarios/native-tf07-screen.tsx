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
  useWindowDimensions,
} from "react-native";

import { NativeCameraButtons } from "./native-camera-buttons.js";
import { NativeLocationButton } from "./native-location-button.js";
import { NativePopupBubble } from "./native-popup-bubble.js";
import { measureNativeViewport } from "./native-viewport.js";
import { type Tf07Action, type Tf07Probe, Tf07Scene } from "./tf07-scene.js";

/**
 * Native TF07 touch fixture, selected by `EXPO_PUBLIC_ONE_MAP_SCENARIO=tf07`.
 *
 * Operators perform the documented touch flow and use Read renderer to
 * inspect actual camera/features. A status label alone is not a pass.
 */
export const NativeTf07Screen = ({
  adapter,
  ornaments,
}: {
  readonly adapter: Adapter;
  readonly ornaments: object;
}) => {
  const mapHost = useRef<View>(null);
  const windowMetrics = useWindowDimensions();
  const probeRef = useRef<Tf07Probe | null>(null);
  const [status, setStatus] = useState("TF07 waiting for map");
  const [readback, setReadback] = useState("");
  const hostTouches = useRef<Record<string, number>>({});
  const readSequence = useRef(0);
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
    void Promise.all([
      probe.read(),
      probe.project("source"),
      measureNativeViewport(mapHost.current),
    ]).then(
      ([renderer, sourcePoint, viewport]) => {
        const observation = {
          ...renderer,
          viewport,
          window: windowMetrics,
          readSequence: ++readSequence.current,
          sourcePoint,
          hostTouches: { ...hostTouches.current },
        };
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

  const recordTouch = (kind: string, phase: string): void => {
    const key = `${kind}-${phase}`;
    hostTouches.current[key] = (hostTouches.current[key] ?? 0) + 1;
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
          {(["remount", "style", "offset", "popup"] as const).map(
            (action: Tf07Action) => (
              <Button
                key={action}
                title={action}
                onPress={() => probeRef.current?.configure(action)}
              />
            )
          )}
          <Button title="Read renderer" onPress={read} />
        </ScrollView>
        <Text testID="tf07-status" style={styles.status} numberOfLines={2}>
          {status}
        </Text>
        <Text testID="tf07-readback" style={styles.readback} numberOfLines={3}>
          {readback}
        </Text>
        <Text>Custom control</Text>
        <View ref={mapHost} collapsable={false} style={{ flex: 1 }}>
          <Tf07Scene
            renderLocation={NativeLocationButton}
            renderNavigation={NativeCameraButtons}
            nativeOrnaments={ornaments}
            renderPopup={renderPopup}
            native
            style={{ flex: 1 }}
            attach={attach}
            report={(event) => setStatus(`TF07 ${event}`)}
            markerContent={(kind, activate) => (
              <View
                testID={`tf07-${kind}`}
                style={styles.content}
                onTouchStart={(event) => {
                  recordTouch(kind, "start");
                  hostTouches.current[`${kind}-max-touches`] = Math.max(
                    hostTouches.current[`${kind}-max-touches`] ?? 0,
                    event.nativeEvent.touches.length
                  );
                }}
                onTouchEnd={() => recordTouch(kind, "end")}
                onTouchCancel={() => recordTouch(kind, "cancel")}
              >
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
                  <ScrollView
                    style={styles.scroll}
                    nestedScrollEnabled
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                      hostTouches.current["live-scroll-y"] =
                        event.nativeEvent.contentOffset.y;
                    }}
                  >
                    <Text>Scroll one</Text>
                    <Text>Scroll two</Text>
                    <Text>Scroll three</Text>
                    <Text>Scroll four</Text>
                  </ScrollView>
                )}
              </View>
            )}
          />
        </View>
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
