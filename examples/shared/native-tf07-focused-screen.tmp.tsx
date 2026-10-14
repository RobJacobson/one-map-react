import {
  type Adapter,
  Control,
  GeolocateControl,
  Layer,
  type MapRef,
  MapSetup,
  Marker,
  type MarkerRef,
  NavigationControl,
  Map as OneMap,
  Source,
  useMap,
} from "one-map-react";
import { createContext, useContext, useRef, useState } from "react";
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
}: {
  readonly name: string;
  readonly record: (name: string) => void;
}) => {
  const theme = useContext(Theme);
  const [count, setCount] = useState(0);
  const map = useMap();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${theme} ${count}`}
      onPress={() => {
        setCount((c) => c + 1);
        record(`${name}-click`);
        void map
          .getZoom()
          .then((zoom) => record(`${name}-map-zoom-${Math.round(zoom)}`));
      }}
    >
      <Text>
        {name} {theme} {count}
      </Text>
    </Pressable>
  );
};
/** Additional actual-renderer TF07 cases, separate from the canonical fixture. */
export const NativeTf07Screen = ({ adapter }: FocusProps) => {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const first = useRef<MapRef>(null);
  const second = useRef<MapRef>(null);
  const annotation = useRef<MarkerRef>(null);
  const counts = useRef<Counts>({});
  const record = (name: string) => {
    counts.current[name] = (counts.current[name] ?? 0) + 1;
    setStatus(name);
  };
  const [status, setStatus] = useState("Focused waiting");
  const [theme, setTheme] = useState("initial");
  const [mode, setMode] = useState<"reject" | "delay">("reject");
  const [locate, setLocate] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [short, setShort] = useState(false);
  const [stop, setStop] = useState(false);
  const release = useRef<(() => void) | null>(null);
  const [readback, setReadback] = useState("");
  const position = async () => {
    record("provider-call");
    if (mode === "reject") throw new Error("Expected test rejection");
    return await new Promise<{ lngLat: readonly [number, number] }>(
      (resolve) => {
        release.current = () => resolve({ lngLat: [-122.33, 47.62] });
      }
    );
  };
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
    ]);
    const observation = {
      focused: true,
      focusedComplete,
      counts: { ...counts.current },
      mode,
      theme,
      locate,
      short,
      stop,
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
            {(
              [
                ["Read focus", () => void read()],
                ["Finish focus", () => void read(true)],
                ["Theme", () => setTheme("updated")],
                ["Delay", () => setMode("delay")],
                ["Drop locate", () => setLocate(false)],
                ["Resolve", () => release.current?.()],
                ["Image", () => setTimeout(() => setShowImage(true), 200)],
                ["Resize", () => setShort((value) => !value)],
                [
                  stop ? "Allow overlap" : "Stop overlap",
                  () => setStop((value) => !value),
                ],
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
            <OneMap
              ref={first}
              mapStyle={style}
              initialViewState={{
                longitude: -122.34,
                latitude: 47.61,
                zoom: 11,
                bearing: 0,
                pitch: 0,
              }}
              style={{ flex: landscape || short ? 1 : 2 }}
              interactiveLayerIds={["focus-low", "focus-high"]}
              onLoad={() => {
                record("a-load");
                void first.current?.jumpTo({
                  center: [-122.34, 47.61],
                  zoom: 11,
                });
              }}
              onClick={() => record("a-map-click")}
              onError={() => record("a-error")}
            >
              <Source
                id="focus-low-source"
                type="geojson"
                data={data(707)}
                onClick={() => record("low-click")}
              >
                <Layer
                  id="focus-low"
                  type="circle"
                  paint={{ "circle-color": "#16a34a", "circle-radius": 20 }}
                />
              </Source>
              <Source
                id="focus-high-source"
                type="geojson"
                data={data(708)}
                onClick={(event) => {
                  record("high-click");
                  if (stop) event.stopPropagation();
                }}
              >
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
                      style={{ width: 40, height: 40, backgroundColor: "blue" }}
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
              <Control position="bottom-right">
                <Child name="Map A" record={record} />
              </Control>
              {locate && (
                <GeolocateControl
                  position="top-right"
                  getCurrentPosition={position}
                  onError={() => record("provider-error")}
                  onGeolocate={() => record("provider-location")}
                />
              )}
            </OneMap>
            <OneMap
              ref={second}
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
              onClick={() => record("b-map-click")}
              onError={() => record("b-error")}
            >
              <Source
                id="focus-vector-source"
                type="vector"
                tiles={["http://127.0.0.1:8798/vt/0/{z}/{x}/{y}.pbf"]}
                minzoom={11}
                maxzoom={11}
                onClick={() => record("vector-click")}
              >
                <Layer
                  id="focus-vector"
                  type="line"
                  source-layer="routes"
                  paint={{ "line-color": "#f97316", "line-width": 16 }}
                />
              </Source>
              <Control position="bottom-right">
                <Child name="Map B" record={record} />
              </Control>
              <NavigationControl position="top-left" showCompass={false} />
            </OneMap>
          </View>
        </SafeAreaView>
      </MapSetup>
    </Theme.Provider>
  );
};
