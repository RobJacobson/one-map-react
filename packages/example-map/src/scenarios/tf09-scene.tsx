import {
  type Bounds,
  Layer,
  Map as OneMap,
  type MapLayoutStyle,
  type MapRef,
  type MoveEvent,
  type ViewState,
  Source,
} from "one-map-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  captureRendering,
  renderingBufferOptions,
} from "./capture-rendering.js";
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
      type: "background",
      paint: { "background-color": "#17324d" },
    },
  ],
};

/** Local DEM and known-feature scene shared by all six renderer environments. */
export const Tf09Scene = ({
  backend,
  style,
  attach,
  children,
  named,
}: {
  readonly backend: string;
  readonly style: MapLayoutStyle;
  readonly attach: (probe: Tf09Probe | null) => void;
  readonly children?: ReactNode;
  readonly named?: (map: MapRef) => unknown;
}) => {
  const ref = useRef<MapRef>(null);
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
          const center =
            value.target === "edge"
              ? ([-19, 19] as const)
              : value.target === "north-west"
                ? ([-100, 65] as const)
                : value.target === "south-east"
                  ? ([100, -65] as const)
                  : value.target === "reset"
                    ? ([100, 50] as const)
                    : ([0, 0] as const);
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
            center: await map.getCenter(),
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
        if (action === "named") return named?.(map);
        if (action === "capture") return captureRendering(backend, map);
        if (action === "read") {
          let elevation: number | null = null;
          let unsupported: string | undefined;
          try {
            elevation = await map.queryTerrainElevation([0, 0]);
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
            center: await map.getCenter(),
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
  }, [attach, backend, named]);
  const recordCamera = (event: MoveEvent, ending: boolean): void => {
    nativeCameraObservation.current = event.viewState;
    const observation = cameraObservations.current;
    if (ending) observation.ends += 1;
    else observation.moves += 1;
    observation.origin = event.origin;
    observation.viewState = event.viewState;
    if (event.origin === "user") {
      if (ending) observation.userEnds += 1;
      else observation.userMoves += 1;
      observation.lastUserOrigin = event.origin;
      observation.lastUserViewState = event.viewState;
      observation.lastUserProposal = event.viewState;
    }
    if (acceptProposals.current) setControlled(event.viewState);
  };

  return (
    <OneMap
      ref={ref}
      mapStyle={mapStyle}
      initialViewState={camera}
      viewState={controlled}
      minZoom={clamped ? 3 : undefined}
      maxBounds={cameraBounds}
      onMove={(event) => recordCamera(event, false)}
      onMoveEnd={(event) => recordCamera(event, true)}
      {...{ options: renderingBufferOptions(backend) }}
      style={style}
      projection={projection}
      terrain={
        backend === "maplibre-native"
          ? undefined
          : enabled
            ? { source: "dem", exaggeration: 2 }
            : null
      }
      light={{
        anchor: "map",
        color: lightColor,
        // Keep shadowed faces tinted; full contrast produces complementary ambient colors.
        intensity: lightFixture ? 0.25 : 0.5,
        position: [1.15, 210, 30],
      }}
      onIdle={() => {
        idle.current += 1;
      }}
      onStyleLoad={() => {
        styleLoads.current += 1;
      }}
      onLoad={() => {
        loads.current += 1;
      }}
    >
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
    </OneMap>
  );
};
