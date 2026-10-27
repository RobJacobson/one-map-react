import { type Adapter, MapSetup, Marker, type ViewState } from "one-map-react";
import {
  Component,
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

import { initialViewState } from "../../tests/fixtures/map-fixture.js";
import { NativeCameraButtons } from "./native-camera-buttons.js";
import { NativeLocationButton } from "./native-location-button.js";
import { NativePopupBubble } from "./native-popup-bubble.js";
import { type Tf07Action, type Tf07Probe, Tf07Scene } from "./tf07-scene.js";

interface MarkerRejectionRequest {
  readonly requestId: number;
  readonly label: string;
  readonly renderMode: "view" | "annotation";
  readonly property: "draggable" | "onDrag";
}

const rejectionRequests = [
  { label: "Reject view draggable", renderMode: "view", property: "draggable" },
  { label: "Reject view callback", renderMode: "view", property: "onDrag" },
  {
    label: "Reject annotation draggable",
    renderMode: "annotation",
    property: "draggable",
  },
  {
    label: "Reject annotation callback",
    renderMode: "annotation",
    property: "onDrag",
  },
] as const;

const cameraTargetA: ViewState = {
  ...initialViewState,
  longitude: -122.34,
  latitude: 47.61,
};
const cameraTargetB: ViewState = {
  ...initialViewState,
  longitude: -122.32,
  latitude: 47.615,
};
const rejectionMessage =
  "Native Marker does not support dragging. Use a selected raw native annotation for SDK dragging.";

/**
 * Native TF07 touch fixture, selected by `ONE_MAP_SMOKE=tf07`.
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
  const probeRef = useRef<Tf07Probe | null>(null);
  const [cameraTarget, setCameraTarget] = useState<ViewState>();
  const [rejection, setRejection] = useState<MarkerRejectionRequest>();
  const [rejectionResult, setRejectionResult] = useState(
    "No rejection requested"
  );
  const rejectionSequence = useRef(0);
  const [status, setStatus] = useState("TF07 waiting for map");
  const [readback, setReadback] = useState("");
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

  const requestRejection = (
    request: Omit<MarkerRejectionRequest, "requestId">
  ): void => {
    rejectionSequence.current += 1;
    setRejectionResult(`${request.label}: waiting`);
    setRejection({ ...request, requestId: rejectionSequence.current });
  };

  const reportRejection = (error: Error): void => {
    const result =
      error.message === rejectionMessage
        ? error.message
        : `Unexpected rejection: ${error.name}`;
    setRejectionResult(`${rejection?.label}: ${result}`);
  };

  const clearRejection = (): void => {
    setRejection(undefined);
    setRejectionResult("No rejection requested");
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
          <Button
            title="Target A"
            onPress={() => setCameraTarget({ ...cameraTargetA })}
          />
          <Button
            title="Target B"
            onPress={() => setCameraTarget({ ...cameraTargetB })}
          />
          <Button
            title="Repeat target"
            onPress={() =>
              setCameraTarget((current) => (current ? { ...current } : current))
            }
          />
          <Button
            title="Clear target"
            onPress={() => setCameraTarget(undefined)}
          />
          {rejectionRequests.map((request) => (
            <Button
              key={request.label}
              title={request.label}
              onPress={() => requestRejection(request)}
            />
          ))}
          <Button title="Clear rejection" onPress={clearRejection} />
          <Button title="Read renderer" onPress={read} />
        </ScrollView>
        <Text testID="tf07-status" style={styles.status} numberOfLines={2}>
          {status}
        </Text>
        <Text testID="tf07-readback" style={styles.readback} numberOfLines={3}>
          {readback}
        </Text>
        <Text testID="tf07-requested-target">
          Requested target:{" "}
          {cameraTarget ? JSON.stringify(cameraTarget) : "none"}
        </Text>
        <Text testID="tf07-marker-rejection">{rejectionResult}</Text>
        <Text>Custom control</Text>
        <View style={{ flex: 1 }}>
          <Tf07Scene
            cameraTarget={cameraTarget}
            validationProbe={
              rejection && (
                <NativeMarkerRejectionBoundary
                  key={rejection.requestId}
                  onRejected={reportRejection}
                >
                  <Marker
                    id={`tf07-rejection-${rejection.requestId}`}
                    longitude={-122.34}
                    latitude={47.61}
                    renderMode={rejection.renderMode}
                    {...(rejection.property === "draggable"
                      ? { draggable: true }
                      : {
                          onDrag: () =>
                            setRejectionResult("Unexpected drag callback"),
                        })}
                  />
                </NativeMarkerRejectionBoundary>
              )
            }
            renderLocation={NativeLocationButton}
            renderNavigation={NativeCameraButtons}
            nativeOrnaments={ornaments}
            renderPopup={renderPopup}
            native
            style={{ flex: 1 }}
            attach={attach}
            report={(event) => setStatus(`TF07 ${event}`)}
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

/** React error boundaries require a class; this catches only the deliberate Marker probe. */
class NativeMarkerRejectionBoundary extends Component<
  {
    readonly children: ReactNode;
    readonly onRejected: (error: Error) => void;
  },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onRejected(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
