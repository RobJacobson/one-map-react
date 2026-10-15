import {
  Layer,
  Map as OneMap,
  type MapLayoutStyle,
  type MapRef,
  Source,
} from "one-map-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

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
  const [enabled, setEnabled] = useState(false);
  const [dem, setDem] = useState(false);
  const [shade, setShade] = useState(true);
  const [projection, setProjection] = useState<"mercator" | "globe">(
    "mercator"
  );
  const [revision, setRevision] = useState(0);
  const committed = useRef({ terrain: false, dem: false });
  useEffect(() => {
    committed.current = { terrain: enabled, dem };
  }, [enabled, dem]);
  const loads = useRef(0);
  const styleLoads = useRef(0);
  useEffect(() => {
    attach({
      command: async (action, value = {}) => {
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
        if (action === "projection-view") {
          await map.jumpTo({ center: [0, 0], zoom: 0, pitch: 0 });
          setDem(false);
          setEnabled(false);
          setProjection(value.globe === true ? "globe" : "mercator");
          return true;
        }
        if (action === "named") return named?.(map);
        if (action === "capture")
          return map.capture({ scope: "backend", output: "data-url" });
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
    return () => attach(null);
  }, [attach, backend, named]);
  return (
    <OneMap
      ref={ref}
      mapStyle={{ ...baseStyle, name: `rendering-${revision}` }}
      initialViewState={camera}
      captureEnabled
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
        color: "#ffffff",
        intensity: 0.5,
        position: [1.15, 210, 30],
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
      {children}
    </OneMap>
  );
};
