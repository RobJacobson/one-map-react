import {
  type Adapter,
  UserLocation,
  type GeolocationPosition,
  Layer,
  type MapRef,
  MapSetup,
  Marker,
  type MarkerRef,
  Map as OneMap,
  Source,
} from "one-map-react";
import type { NativeMapProps as MapboxMapProps } from "one-map-react/mapbox-native";
import type { NativeMapProps as MaplibreMapProps } from "one-map-react/maplibre-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { NativeCameraButtons } from "./native-camera-buttons.js";
import { NativeLocationButton } from "./native-location-button.js";
import { measureNativeViewport } from "./native-viewport.js";
import { tf06Base } from "./tf06-base.js";

const firstOrnaments = {
  compassPosition: { top: 64, right: 8 },
} satisfies MapboxMapProps["options"] & MaplibreMapProps["options"];
const secondOrnaments = {
  compassPosition: { top: 104, right: 8 },
} satisfies MapboxMapProps["options"] & MaplibreMapProps["options"];

const Theme = createContext("initial");
const style = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#e2e8f0" },
    },
  ],
};
const data = (id: number) => ({
  type: "Feature" as const,
  id,
  properties: { fixture: "tf07-focused" },
  geometry: { type: "Point" as const, coordinates: [-122.34, 47.61] },
});
interface FocusProps {
  readonly adapter: Adapter;
}
interface Counts {
  [name: string]: number;
}
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==";
const Child = ({
  name,
  record,
  mapRef,
}: {
  readonly mapRef: import("react").RefObject<MapRef | null>;
  readonly name: string;
  readonly record: (name: string) => void;
}) => {
  const theme = useContext(Theme);
  const [count, setCount] = useState(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${theme} ${count}`}
      onPress={() => {
        setCount((c) => c + 1);
        record(`${name}-click`);
        const map = mapRef.current;
        if (!map) {
          record(`${name}-map-error`);
          return;
        }
        void map.getZoom().then(
          (zoom) => record(`${name}-map-zoom-${Math.round(zoom)}`),
          () => record(`${name}-map-error`)
        );
      }}
    >
      <Text>
        {name} {theme} {count}
      </Text>
    </Pressable>
  );
};
/** Additional actual-renderer TF07 cases, separate from the canonical fixture. */
export const NativeTf07FocusedScreen = ({ adapter }: FocusProps) => {
  const windowMetrics = useWindowDimensions();
  const { width, height } = windowMetrics;
  const firstHost = useRef<View>(null);
  const secondHost = useRef<View>(null);
  const active = useRef(true);
  const readSequence = useRef(0);
  const imageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(imageTimer.current);
    };
  }, []);
  const landscape = width > height;
  const first = useRef<MapRef>(null);
  const second = useRef<MapRef>(null);
  const annotation = useRef<MarkerRef>(null);
  const counts = useRef<Counts>({});
  const [status, setStatus] = useState("Focused waiting");
  const record = useCallback((name: string) => {
    if (!active.current) return;
    counts.current[name] = (counts.current[name] ?? 0) + 1;
    setStatus(name);
  }, []);
  const [theme, setTheme] = useState("initial");
  const [displayPosition, setDisplayPosition] = useState<GeolocationPosition>();
  const [mode, setMode] = useState<"reject" | "delay">("reject");
  const [locate, setLocate] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [short, setShort] = useState(false);
  const release = useRef<(() => void) | null>(null);
  const [readback, setReadback] = useState("");
  const position = useCallback(async () => {
    record("provider-call");
    if (mode === "reject") throw new Error("Expected test rejection");
    return await new Promise<{ lngLat: readonly [number, number] }>(
      (resolve) => {
        release.current = () => resolve({ lngLat: [-122.33, 47.62] });
      }
    );
  }, [mode, record]);
  const read = async (focusedComplete = false) => {
    const a = first.current,
      b = second.current;
    if (!a || !b) return;
    const [
      aCenter,
      aZoom,
      bCenter,
      bZoom,
      overlap,
      vector,
      overlapPoint,
      vectorPoint,
      aViewport,
      bViewport,
    ] = await Promise.all([
      a.getCenter(),
      a.getZoom(),
      b.getCenter(),
      b.getZoom(),
      a.queryRenderedFeatures(undefined, {
        layers: ["focus-low", "focus-high"],
      }),
      b.queryRenderedFeatures(undefined, { layers: ["focus-vector"] }),
      a.project([-122.34, 47.61]),
      b.project([-122.338, 47.6115]),
      measureNativeViewport(firstHost.current),
      measureNativeViewport(secondHost.current),
    ]);
    if (!active.current) return;
    const observation = {
      readSequence: ++readSequence.current,
      aViewport,
      bViewport,
      window: windowMetrics,
      focused: true,
      focusedComplete,
      counts: { ...counts.current },
      mode,
      theme,
      locate,
      short,
      aCenter,
      aZoom,
      bCenter,
      bZoom,
      overlap,
      vector,
      overlapPoint,
      vectorPoint,
    };
    setReadback(JSON.stringify(observation));
    await fetch("http://127.0.0.1:8797/tf07", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(observation),
    });
  };
  return (
    <Theme.Provider value={theme}>
      <MapSetup adapter={adapter}>
        <SafeAreaView
          style={{
            flex: 1,
            paddingTop:
              Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {/* eslint-disable react/refs -- This list stores press handlers; map refs are read only when a button is pressed. */}
            {(
              [
                [
                  "Read focus",
                  () => void read().catch(() => record("read-error")),
                ],
                [
                  "Finish focus",
                  () => void read(true).catch(() => record("read-error")),
                ],
                ["Theme", () => setTheme("updated")],
                ["Delay", () => setMode("delay")],
                ["Drop locate", () => setLocate(false)],
                ["Restore locate", () => setLocate(true)],
                ["Resolve", () => release.current?.()],
                [
                  "Image",
                  () => {
                    clearTimeout(imageTimer.current);
                    imageTimer.current = setTimeout(
                      () => setShowImage(true),
                      200
                    );
                  },
                ],
                ["Resize", () => setShort((value) => !value)],
              ] as const
            ).map(([title, onPress]) => (
              <View
                key={title}
                style={{
                  width: landscape ? "20%" : "33.333333%",
                  height: 36,
                  justifyContent: "center",
                }}
              >
                <Button title={title} onPress={onPress} />
              </View>
            ))}
            {/* eslint-enable react/refs */}
          </View>
          <Text style={{ height: 48 }} numberOfLines={2}>
            {status}; provider {mode}; theme {theme}
          </Text>
          <Text
            testID="tf07-focus-readback"
            style={{ height: 48 }}
            numberOfLines={2}
          >
            {readback}
          </Text>
          <View
            style={{ flex: 1, flexDirection: landscape ? "row" : "column" }}
          >
            <View
              ref={firstHost}
              collapsable={false}
              style={{ flex: landscape || short ? 1 : 2 }}
            >
              <OneMap
                ref={first}
                {...{ options: firstOrnaments }}
                mapStyle={style}
                initialViewState={{
                  longitude: -122.34,
                  latitude: 47.61,
                  zoom: 11,
                  bearing: 0,
                  pitch: 0,
                }}
                style={{ flex: 1 }}
                interactiveLayerIds={["focus-low", "focus-high"]}
                onLoad={() => {
                  record("a-load");
                  void first.current?.jumpTo({
                    center: [-122.34, 47.61],
                    zoom: 11,
                  });
                }}
                onClick={(event) => {
                  const id = String(
                    (
                      event.features?.[0] as
                        | { id?: string | number }
                        | undefined
                    )?.id
                  );
                  if (id === "708") record("high-click");
                  if (id === "707") record("low-click");
                  record("a-map-click");
                }}
                onError={() => record("a-error")}
              >
                {locate && (
                  <UserLocation position={displayPosition} showAccuracyCircle />
                )}
                <Source id="focus-low-source" type="geojson" data={data(707)}>
                  <Layer
                    id="focus-low"
                    type="circle"
                    paint={{ "circle-color": "#16a34a", "circle-radius": 20 }}
                  />
                </Source>
                <Source id="focus-high-source" type="geojson" data={data(708)}>
                  <Layer
                    id="focus-high"
                    type="circle"
                    paint={{ "circle-color": "#dc2626", "circle-radius": 12 }}
                  />
                </Source>
                <Marker
                  ref={annotation}
                  id="focus-image"
                  longitude={-122.35}
                  latitude={47.59}
                  renderMode="annotation"
                >
                  <View style={{ padding: 8, backgroundColor: "white" }}>
                    <Text>{showImage ? "Image ready" : "Waiting image"}</Text>
                    {showImage && (
                      <Image
                        source={{ uri: image }}
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: "blue",
                        }}
                        onError={() => record("image-error")}
                        onLoad={() => {
                          record("image-load");
                          void annotation.current?.refresh().then(
                            () => record("image-refresh"),
                            () => record("image-error")
                          );
                        }}
                      />
                    )}
                  </View>
                </Marker>
              </OneMap>
              <View style={{ position: "absolute", bottom: 40, right: 8 }}>
                <Child name="Map A" mapRef={first} record={record} />
              </View>
              {locate && (
                <NativeLocationButton
                  key={mode}
                  mapRef={first}
                  corner="right"
                  getCurrentPosition={position}
                  onError={() => record("provider-error")}
                  onGeolocate={(position) => {
                    setDisplayPosition(position);
                    record("provider-location");
                  }}
                />
              )}
            </View>
            <View ref={secondHost} collapsable={false} style={{ flex: 1 }}>
              <OneMap
                ref={second}
                {...{ options: secondOrnaments }}
                mapStyle={style}
                initialViewState={{
                  longitude: -122.34,
                  latitude: 47.61,
                  zoom: 12,
                  bearing: 0,
                  pitch: 0,
                }}
                minZoom={12}
                maxZoom={13}
                style={{ flex: 1 }}
                interactiveLayerIds={["focus-vector"]}
                onLoad={() => {
                  record("b-load");
                  void second.current?.jumpTo({
                    center: [-122.34, 47.61],
                    zoom: 12,
                  });
                }}
                onClick={(event) => {
                  if (event.features?.length) record("vector-click");
                  record("b-map-click");
                }}
                onError={() => record("b-error")}
              >
                <Source
                  id="focus-vector-source"
                  type="vector"
                  tiles={[`${tf06Base}/vt/0/{z}/{x}/{y}.pbf`]}
                  minzoom={11}
                  maxzoom={11}
                >
                  <Layer
                    id="focus-vector"
                    type="line"
                    source-layer="routes"
                    paint={{ "line-color": "#f97316", "line-width": 16 }}
                  />
                </Source>
              </OneMap>
              <View style={{ position: "absolute", bottom: 40, right: 8 }}>
                <Child name="Map B" mapRef={second} record={record} />
              </View>
              <NativeCameraButtons
                mapRef={second}
                minZoom={12}
                maxZoom={13}
                showNorth={false}
                onError={() => record("b-error")}
              />
            </View>
          </View>
        </SafeAreaView>
      </MapSetup>
    </Theme.Provider>
  );
};
