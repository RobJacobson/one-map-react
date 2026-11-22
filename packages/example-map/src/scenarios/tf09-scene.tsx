import type { Bounds, MapLayoutStyle, MapRef, ViewState } from "one-map-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  captureRendering as captureWebRendering,
  renderingBufferOptions,
} from "./capture-web-rendering.js";
import {
  coordinateTuple,
  isBrowserMap,
  type NativeSceneComponents,
  type SceneMap,
  type WebSceneMap,
  type SceneMove,
  type WebSceneComponents,
} from "./scene-components.js";
import { cameraDispatchObservation } from "./tf10-camera-observer.js";
import {
  nativeControlledCamera,
  readNativeOrientation,
} from "./tf10-native-orientation.js";

/** Actions exposed only by the targeted renderer acceptance examples. */
export interface Tf09Probe {
  /** Changes fixture state or reads independently returned renderer values. */
  readonly command: (
    action: string,
    value?: Record<string, unknown>
  ) => Promise<unknown>;
}

const camera = { longitude: 0, latitude: 0, zoom: 2, bearing: 0, pitch: 35 };
const baseStyle = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#17324d" },
    },
  ],
};

/** Local DEM and known-feature scene shared by all six renderer environments. */
export const Tf09Scene = ({
  backend,
  components,
  style,
  attach,
  children,
  named,
}: {
  readonly backend: string;
  readonly components: WebSceneComponents | NativeSceneComponents;
  readonly style: MapLayoutStyle;
  readonly attach: (probe: Tf09Probe | null) => void;
  readonly children?: ReactNode;
  readonly named?: () => unknown;
}) => {
  const { Source, Layer } = components;
  const native = components.platform === "native";
  const ref = useRef<SceneMap>(null);
  const nativeRef = useRef<MapRef>(null);
  const attachMap = useCallback((map: WebSceneMap | MapRef | null) => {
    ref.current = map;
    nativeRef.current = map && !isBrowserMap(map) ? map : null;
  }, []);
  const countedStyle = useRef<unknown>(null);
  const nativeCameraObservation = useRef<ViewState | undefined>(undefined);
  const [controlled, setControlled] = useState<ViewState | undefined>(
    undefined
  );
  const [cameraBounds, setCameraBounds] = useState<Bounds | undefined>(
    undefined
  );
  const committedBounds = useRef<Bounds | undefined>(undefined);
  useEffect(() => {
    committedBounds.current = cameraBounds;
  }, [cameraBounds]);
  const [clamped, setClamped] = useState(false);
  const committedClamp = useRef(false);
  const acceptProposals = useRef(false);
  const cameraObservations = useRef<{
    moves: number;
    ends: number;
    origin: string;
    viewState?: ViewState;
    userMoves: number;
    userEnds: number;
    lastUserOrigin?: "user";
    lastUserViewState?: ViewState;
    lastUserProposal?: ViewState;
  }>({ moves: 0, ends: 0, origin: "unknown", userMoves: 0, userEnds: 0 });
  const controlledTarget = useRef(controlled);
  useEffect(() => {
    controlledTarget.current = controlled;
    committedClamp.current = clamped;
  }, [controlled, clamped]);
  const [lightColor, setLightColor] = useState("#ffffff");
  const [lightFixture, setLightFixture] = useState(false);
  const committedLight = useRef({ color: "#ffffff", enabled: false });
  useEffect(() => {
    committedLight.current = { color: lightColor, enabled: lightFixture };
  }, [lightColor, lightFixture]);
  const [enabled, setEnabled] = useState(false);
  const [dem, setDem] = useState(false);
  useEffect(() => {
    if (enabled || backend !== "maplibre-web" || !isBrowserMap(ref.current))
      return;
    const renderer = ref.current.getMap();
    if (renderer.getTerrain()) renderer.setTerrain(null);
  }, [enabled, backend]);
  const [shade, setShade] = useState(true);
  const [projection, setProjection] = useState<"mercator" | "globe">(
    "mercator"
  );
  const [revision, setRevision] = useState(0);
  const mapStyle = useMemo(
    () => ({ ...baseStyle, name: `rendering-${revision}` }),
    [revision]
  );
  const committed = useRef({
    terrain: false,
    dem: false,
    shade: true,
    projection: "mercator",
  });
  useEffect(() => {
    committed.current = { terrain: enabled, dem, shade, projection };
  }, [enabled, dem, shade, projection]);
  const loads = useRef(0);
  const styleLoads = useRef(0);
  const idle = useRef(0);
  useEffect(() => {
    attach({
      command: async (action, value = {}) => {
        if (action === "camera-bounds") {
          setControlled(undefined);
          setClamped(false);
          setCameraBounds(
            value.enabled === false
              ? undefined
              : value.shifted === true
                ? [
                    [30, 30],
                    [50, 50],
                  ]
                : [
                    [-20, -20],
                    [20, 20],
                  ]
          );
          return true;
        }
        if (action === "controlled-camera") {
          acceptProposals.current = value.accept === true;
          setControlled(
            value.enabled === false
              ? undefined
              : {
                  ...nativeControlledCamera,
                  ...(value.target === "changed"
                    ? { longitude: 5, latitude: 5 }
                    : {}),
                }
          );
          setClamped(value.enabled !== false && value.clamp === true);
          cameraObservations.current = {
            moves: 0,
            ends: 0,
            origin: "unknown",
            userMoves: 0,
            userEnds: 0,
          };
          return true;
        }
        if (action === "light-color") {
          const color = value.color;
          if (color !== "blue" && color !== "green" && color !== "white")
            throw new Error("Choose a known light-color fixture.");
          setLightColor(
            { blue: "#0000ff", green: "#00ff00", white: "#ffffff" }[color]
          );
          setLightFixture(true);
          return true;
        }
        if (action === "configure") {
          setDem(value.dem === true);
          setShade(value.shade !== false);
          setEnabled(value.terrain === true);
          setProjection(value.globe === true ? "globe" : "mercator");
          return true;
        }
        if (action === "replace-style") {
          setRevision((current) => current + 1);
          return true;
        }
        const map = ref.current;
        if (!map) throw new Error("Map is not attached.");
        if (action === "bounds-command") {
          const center: [number, number] =
            value.target === "edge"
              ? [-19, 19]
              : value.target === "north-west"
                ? [-100, 65]
                : value.target === "south-east"
                  ? [100, -65]
                  : value.target === "reset"
                    ? [100, 50]
                    : [0, 0];
          await map.jumpTo({
            center,
            zoom: value.target === "edge" ? 4 : 5,
            bearing: 0,
            pitch: 0,
          });
          return true;
        }
        if (action === "camera-command") {
          const target =
            value.target === "reapply"
              ? nativeControlledCamera
              : { longitude: 10, latitude: 10, zoom: 3, bearing: 0, pitch: 0 };
          await map.jumpTo({
            center: [target.longitude, target.latitude],
            zoom: target.zoom,
            bearing: target.bearing,
            pitch: target.pitch,
          });
          return true;
        }
        if (action === "camera-read")
          return {
            ...cameraObservations.current,
            controlled: controlledTarget.current,
            clamp: committedClamp.current,
            cameraBounds: committedBounds.current,
            dispatches: [...cameraDispatchObservation.events],
            center: coordinateTuple(await map.getCenter()),
            zoom: await map.getZoom(),
            ...(await readNativeOrientation(
              backend,
              map,
              nativeCameraObservation.current
            )),
          };
        if (action === "projection-view") {
          await map.jumpTo({ center: [0, 0], zoom: 0, pitch: 0 });
          setDem(false);
          setEnabled(false);
          setProjection(value.globe === true ? "globe" : "mercator");
          return true;
        }
        if (action === "light-read")
          return {
            ...committedLight.current,
            styleLoads: styleLoads.current,
            features: await map.queryRenderedFeatures(undefined, {
              layers: ["lit-building"],
            }),
          };
        if (action === "named") return named?.();
        if (action === "capture") {
          if (isBrowserMap(map)) return captureWebRendering(backend, map);
          if (!native) throw new Error("Observation map is not attached.");
          return components.captureRendering(backend, nativeRef.current);
        }
        if (action === "read") {
          let elevation: number | null = null;
          let unsupported: string | undefined;
          try {
            elevation = (await map.queryTerrainElevation?.([0, 0])) ?? null;
          } catch (error) {
            if (backend === "maplibre-native") unsupported = String(error);
            else throw error;
          }
          return {
            committed: committed.current,
            idle: idle.current,
            loads: loads.current,
            styleLoads: styleLoads.current,
            elevation,
            unsupported,
            center: coordinateTuple(await map.getCenter()),
            zoom: await map.getZoom(),
            features: await map.queryRenderedFeatures(undefined, {
              layers: ["known"],
            }),
          };
        }
        throw new Error(`Unknown rendering action: ${action}`);
      },
    });
    return () => {
      attach(null);
    };
  }, [attach, backend, components, named, native]);
  const recordCamera = (event: SceneMove, ending: boolean): void => {
    nativeCameraObservation.current = event.viewState;
    const observation = cameraObservations.current;
    if (ending) observation.ends += 1;
    else observation.moves += 1;
    const origin = event.origin ?? (event.originalEvent ? "user" : "unknown");
    observation.origin = origin;
    observation.viewState = event.viewState;
    if (origin === "user") {
      if (ending) observation.userEnds += 1;
      else observation.userMoves += 1;
      observation.lastUserOrigin = origin;
      observation.lastUserViewState = event.viewState;
      observation.lastUserProposal = event.viewState;
    }
    if (acceptProposals.current) setControlled(event.viewState);
  };

  const terrain =
    backend === "maplibre-native"
      ? undefined
      : enabled
        ? { source: "dem", exaggeration: 2 }
        : null;
  const mapProps = {
    ref: attachMap,
    mapStyle,
    initialViewState: camera,
    minZoom: clamped ? 3 : undefined,
    onMove: (event: SceneMove) => recordCamera(event, false),
    onMoveEnd: (event: SceneMove) => recordCamera(event, true),
    style,
    projection,
    light: {
      anchor: "map" as const,
      color: lightColor,
      intensity: lightFixture ? 0.25 : 0.5,
      position: [1.15, 210, 30] satisfies [number, number, number],
    },
    onIdle: () => {
      idle.current += 1;
      if (!native && countedStyle.current !== mapStyle) {
        countedStyle.current = mapStyle;
        styleLoads.current += 1;
      }
    },
    onLoad: () => {
      loads.current += 1;
    },
  };
  const scene = (
    <>
      {dem && (
        <Source
          id="dem"
          type="raster-dem"
          tiles={["http://127.0.0.1:8798/dem/{z}/{x}/{y}.png"]}
          tileSize={256}
          maxzoom={2}
        >
          {shade && (
            <Layer
              id="shade"
              type="hillshade"
              paint={{ "hillshade-exaggeration": 0.7 }}
            />
          )}
        </Source>
      )}
      <Source
        id="point"
        type="geojson"
        data={{
          type: "Feature",
          id: 9009,
          properties: {},
          geometry: { type: "Point", coordinates: [0, 0] },
        }}
      >
        <Layer
          id="known"
          type="circle"
          paint={{ "circle-radius": 12, "circle-color": "#ff5500" }}
        />
      </Source>
      {lightFixture && (
        <Source
          id="lit-building"
          type="geojson"
          data={{
            type: "Feature",
            id: 9010,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-30, -20],
                  [30, -20],
                  [30, 20],
                  [-30, 20],
                  [-30, -20],
                ],
              ],
            },
          }}
        >
          <Layer
            id="lit-building"
            type="fill-extrusion"
            paint={{
              "fill-extrusion-color": "#ffffff",
              "fill-extrusion-height": 1000000,
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false,
            }}
          />
        </Source>
      )}
      {children}
    </>
  );
  if (native) {
    return (
      <components.Map
        {...mapProps}
        viewState={controlled}
        maxBounds={cameraBounds}
        terrain={terrain}
        onStyleLoad={() => {
          styleLoads.current += 1;
        }}
      >
        {scene}
      </components.Map>
    );
  }
  const maxBounds: [number, number, number, number] | undefined = cameraBounds
    ? [...cameraBounds[0], ...cameraBounds[1]]
    : undefined;
  return (
    <components.Map
      {...mapProps}
      {...controlled}
      {...renderingBufferOptions(backend)}
      maxBounds={maxBounds}
      terrain={terrain ?? undefined}
    >
      {scene}
    </components.Map>
  );
};
