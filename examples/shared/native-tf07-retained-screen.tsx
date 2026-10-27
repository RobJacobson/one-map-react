import {
  type Adapter,
  type LngLat,
  type MapRef,
  MapSetup,
  Marker,
  type MarkerRef,
  Map as OneMap,
  Source,
  Layer,
  useMap,
} from "one-map-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { emptyStyle } from "../../tests/fixtures/map-fixture.js";

const Theme = createContext("initial");
const targets = { a: [-122.34, 47.61], b: [-122.33, 47.615] } as const;
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==";
type MapName = "a" | "b";
type Bounds = readonly [number, number, number, number];
interface ChildRead {
  readonly theme: string;
  readonly count: number;
  readonly center: LngLat;
  readonly zoom: number;
}

/**
 * Renders two real map/marker attachments with independent observation controls.
 * @param props - The selected native adapter.
 * @returns The native screen; readbacks supplement physical observations.
 */
export const NativeTf07RetainedScreen = ({
  adapter,
}: {
  readonly adapter: Adapter;
}) => {
  const window = useWindowDimensions();
  const active = useRef(false);
  const readSequence = useRef(0);
  const first = useRef<MapRef>(null);
  const second = useRef<MapRef>(null);
  const firstHost = useRef<View>(null);
  const secondHost = useRef<View>(null);
  const annotation = useRef<MarkerRef>(null);
  const imageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const imageSequence = useRef(0);
  const history = useRef<object[]>([]);
  const childReads = useRef<Partial<Record<MapName, ChildRead>>>({});
  const events = useRef<Record<string, number>>({});
  const [theme, setTheme] = useState("initial");
  const [short, setShort] = useState(false);
  const [target, setTarget] = useState<LngLat>();
  const [showImage, setShowImage] = useState(false);
  const [imageGeneration, setImageGeneration] = useState(0);
  const [status, setStatus] = useState("Focused waiting for maps");
  const [readback, setReadback] = useState("");

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      readSequence.current += 1;
      imageSequence.current += 1;
      clearTimeout(imageTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    readSequence.current += 1;
  }, [window.width, window.height, window.scale, short, theme, target]);

  const record = useCallback((event: string) => {
    if (!active.current) return;
    events.current[event] = (events.current[event] ?? 0) + 1;
    setStatus(event);
  }, []);

  const childRead = useCallback(
    (name: MapName, value: ChildRead) => {
      if (!active.current) return;
      childReads.current[name] = value;
      record(`${name}-child`);
    },
    [record]
  );

  const read = async (focusedComplete = false): Promise<void> => {
    const firstMap = first.current;
    const secondMap = second.current;
    const firstView = firstHost.current;
    const secondView = secondHost.current;
    if (!firstMap || !secondMap) throw new Error("Focused maps are detached.");
    const sequence = ++readSequence.current;
    const isCurrent = (): boolean =>
      active.current &&
      sequence === readSequence.current &&
      first.current === firstMap &&
      second.current === secondMap &&
      firstHost.current === firstView &&
      secondHost.current === secondView;
    const result = await Promise.all([
      readMap(firstMap, firstView, "a"),
      readMap(secondMap, secondView, "b"),
    ]).catch((error: unknown) => {
      if (isCurrent()) throw error;
      return undefined;
    });
    // A later read or replacement attachment must not publish retired geometry.
    if (!result || !isCurrent()) return;
    const [a, b] = result;
    const observation = {
      sequence,
      window,
      short,
      theme,
      a,
      b,
      children: { ...childReads.current },
      events: { ...events.current },
    };
    history.current = [...history.current, observation];
    const payload = {
      focused: true,
      focusedComplete,
      observations: history.current,
    };
    setReadback(JSON.stringify(payload));
    await fetch("http://127.0.0.1:8797/tf07", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((error: unknown) => {
      if (isCurrent()) throw error;
    });
  };

  const loadImage = (): void => {
    clearTimeout(imageTimer.current);
    imageSequence.current += 1;
    const sequence = imageSequence.current;
    setImageGeneration(sequence);
    setShowImage(false);
    imageTimer.current = setTimeout(() => {
      if (active.current && imageSequence.current === sequence)
        setShowImage(true);
    }, 200);
  };

  const refreshImage = (sequence: number): void => {
    if (!active.current || sequence !== imageSequence.current) return;
    const marker = annotation.current;
    if (!marker) {
      record("image-error");
      return;
    }
    record("image-load");
    void marker.refresh().then(
      () => {
        if (
          active.current &&
          imageSequence.current === sequence &&
          annotation.current === marker
        )
          record("image-refresh");
      },
      () => {
        if (
          active.current &&
          imageSequence.current === sequence &&
          annotation.current === marker
        )
          record("image-error");
      }
    );
  };

  return (
    <Theme.Provider value={theme}>
      <MapSetup adapter={adapter}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView horizontal style={{ flexGrow: 0, maxHeight: 48 }}>
            <Button
              title="Read focus"
              onPress={() => void read().catch(() => record("read-error"))}
            />
            <Button
              title="Finish focus"
              onPress={() => void read(true).catch(() => record("read-error"))}
            />
            <Button title="Theme" onPress={() => setTheme("updated")} />
            <Button
              title="Resize"
              onPress={() => setShort((current) => !current)}
            />
            <Button
              title="Target A"
              onPress={() => setTarget([-122.345, 47.612])}
            />
            <Button
              title="Repeat A"
              onPress={() => setTarget([-122.345, 47.612])}
            />
            <Button title="Clear A" onPress={() => setTarget(undefined)} />
            <Button title="Image" onPress={loadImage} />
          </ScrollView>
          <Text testID="tf07-focused-status">{status}</Text>
          <Text testID="tf07-focused-readback" numberOfLines={2}>
            {readback}
          </Text>
          <View
            style={{
              flex: 1,
              flexDirection: window.width > window.height ? "row" : "column",
            }}
          >
            {(["a", "b"] as const).map((name) => (
              <View
                key={name}
                ref={name === "a" ? firstHost : secondHost}
                collapsable={false}
                style={{ flex: name === "a" && !short ? 2 : 1 }}
              >
                <OneMap
                  id={`tf07-focus-${name}`}
                  ref={name === "a" ? first : second}
                  mapStyle={emptyStyle}
                  style={{ flex: 1 }}
                  initialViewState={{
                    longitude: targets[name][0],
                    latitude: targets[name][1],
                    zoom: name === "a" ? 11 : 12,
                    bearing: 0,
                    pitch: 0,
                  }}
                  viewState={
                    name === "a" && target
                      ? {
                          longitude: target[0],
                          latitude: target[1],
                          zoom: 11,
                          bearing: 0,
                          pitch: 0,
                        }
                      : undefined
                  }
                  interactiveLayerIds={[`focus-${name}-point`]}
                  onLoad={() => {
                    record(`${name}-load`);
                    const map = name === "a" ? first.current : second.current;
                    void map
                      ?.jumpTo({
                        center: targets[name],
                        zoom: name === "a" ? 11 : 12,
                      })
                      .catch(() => {
                        if (
                          active.current &&
                          (name === "a" ? first.current : second.current) ===
                            map
                        )
                          record(`${name}-error`);
                      });
                  }}
                  onClick={(event) => {
                    if (
                      event.features?.some(
                        (feature) =>
                          String((feature as { id?: number }).id) ===
                          (name === "a" ? "1707" : "2707")
                      )
                    )
                      record(`${name}-feature-touch`);
                  }}
                  onError={() => record(`${name}-error`)}
                >
                  <Source
                    id={`focus-${name}-source`}
                    type="geojson"
                    data={{
                      type: "Feature",
                      id: name === "a" ? 1707 : 2707,
                      properties: { fixture: `tf07-focus-${name}` },
                      geometry: { type: "Point", coordinates: targets[name] },
                    }}
                  >
                    <Layer
                      id={`focus-${name}-point`}
                      type="circle"
                      paint={{
                        "circle-color": name === "a" ? "#16a34a" : "#dc2626",
                        "circle-radius": 16,
                      }}
                    />
                  </Source>
                  <Marker
                    id={`focus-${name}-live`}
                    longitude={targets[name][0]}
                    latitude={targets[name][1]}
                    offset={[0, -60]}
                  >
                    <FocusedChild
                      name={name}
                      report={childRead}
                      fail={() => record(`${name}-error`)}
                    />
                  </Marker>
                  {name === "a" && (
                    <Marker
                      ref={annotation}
                      id="focus-image"
                      longitude={-122.35}
                      latitude={47.6}
                      renderMode="annotation"
                      onError={() => record("image-error")}
                    >
                      <View style={{ padding: 8, backgroundColor: "white" }}>
                        <Text>
                          {showImage ? "Image ready" : "Waiting image"}
                        </Text>
                        {showImage && (
                          <Image
                            source={{ uri: image }}
                            style={{
                              width: 40,
                              height: 40,
                              backgroundColor: "blue",
                            }}
                            onLoad={() => refreshImage(imageGeneration)}
                            onError={() => {
                              if (imageGeneration === imageSequence.current)
                                record("image-error");
                            }}
                          />
                        )}
                      </View>
                    </Marker>
                  )}
                </OneMap>
              </View>
            ))}
          </View>
        </SafeAreaView>
      </MapSetup>
    </Theme.Provider>
  );
};

/** Lives inside each real Marker portal, retaining provider and component state. */
const FocusedChild = ({
  name,
  report,
  fail,
}: {
  readonly name: MapName;
  readonly report: (name: MapName, value: ChildRead) => void;
  readonly fail: () => void;
}) => {
  const theme = useContext(Theme);
  const map = useMap(`tf07-focus-${name}`);
  const currentMap = useRef(map);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const [count, setCount] = useState(0);
  useLayoutEffect(() => {
    currentMap.current = map;
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, [map, theme]);
  const press = (): void => {
    const next = count + 1;
    setCount(next);
    const request = ++sequence.current;
    if (!map) {
      fail();
      return;
    }
    void Promise.all([map.getCenter(), map.getZoom()]).then(
      ([center, zoom]) => {
        if (
          mounted.current &&
          request === sequence.current &&
          currentMap.current === map
        )
          report(name, { theme, count: next, center, zoom });
      },
      () => {
        if (
          mounted.current &&
          request === sequence.current &&
          currentMap.current === map
        )
          fail();
      }
    );
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Map ${name.toUpperCase()} ${theme} ${count}`}
      onPress={press}
      style={{ padding: 8, backgroundColor: "white" }}
    >
      <Text>{`Map ${name.toUpperCase()} ${theme} ${count}`}</Text>
    </Pressable>
  );
};

/** Measures actual renderer/host geometry rather than requested camera or density labels. */
const readMap = async (map: MapRef, host: View | null, name: MapName) => {
  const [center, zoom, features, point, bounds] = await Promise.all([
    map.getCenter(),
    map.getZoom(),
    map.queryRenderedFeatures(undefined, { layers: [`focus-${name}-point`] }),
    map.project(targets[name]),
    new Promise<Bounds>((resolve, reject) => {
      if (!host) {
        reject(new Error("Focused host is detached."));
        return;
      }
      host.measureInWindow((x, y, width, height) => {
        if (
          ![x, y, width, height].every(Number.isFinite) ||
          x < 0 ||
          y < 0 ||
          width <= 0 ||
          height <= 0
        )
          reject(new Error("Focused host has invalid bounds."));
        else resolve([x, y, width, height]);
      });
    }),
  ]);
  return { center, zoom, features, point, bounds };
};
