import {
  GeolocateControl,
  type GeolocationPosition,
  Layer,
  type LocationService,
  type MapLayoutStyle,
  type MapProps,
  type MapRef,
  type MapServices,
  type MapStyle,
  Marker,
  type MarkerRef,
  Map as OneMap,
  Source,
} from "one-map-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  captureRendering,
  renderingBufferOptions,
} from "./capture-rendering.js";

/** Commands expose application actions and independent renderer readback only. */
export interface Tf08AcceptanceProbe {
  /** Executes a test action against the mounted map or selected public service. */
  readonly command: (
    action: string,
    value?: Record<string, unknown>
  ) => Promise<unknown>;
}

interface Tf08AcceptanceSceneProps {
  readonly services: MapServices;
  readonly backend: string;
  readonly style: MapLayoutStyle;
  readonly overlay: ReactNode;
  readonly renderCoveragePopup: (children: ReactNode) => ReactNode;
  readonly attach: (probe: Tf08AcceptanceProbe | null) => void;
  readonly fixtureUrl: string;
  readonly externalContext?: MapProps["gl"];
  readonly nativePuck?: ReactNode;
  readonly navigationControl?: ReactNode;
  readonly ornamentControls?: ReactNode;
}

const initialCamera = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

const localStyle: MapStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "tf08-background",
      type: "background",
      paint: { "background-color": "#0f1928" },
    },
  ],
};

/** Real-renderer TF08 fixture; injected fixes never pretend to certify sensors. */
export const Tf08AcceptanceScene = ({
  services,
  backend,
  style,
  overlay,
  renderCoveragePopup,
  attach,
  fixtureUrl,
  externalContext,
  nativePuck,
  navigationControl,
  ornamentControls,
}: Tf08AcceptanceSceneProps) => {
  const mapRef = useRef<MapRef>(null);
  const annotationRef = useRef<MarkerRef>(null);
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [mode, setMode] = useState("injected");
  const [mapStyle, setMapStyle] = useState<MapStyle>(localStyle);
  // Offline coverage is deliberately bounded to the downloaded region and zooms.
  const camera =
    typeof mapStyle === "string" && mapStyle.includes("/offline-style.json")
      ? { ...initialCamera, longitude: 0, latitude: 0, zoom: 1 }
      : initialCamera;
  const observations = useRef({
    loads: 0,
    fixes: 0,
    errors: 0,
    watches: 0,
    releases: 0,
    moving: false,
    moveEnds: 0,
    moves: [] as {
      origin: string;
      center: readonly [number, number];
      zoom: number;
    }[],
  });
  const receiver = useRef<(position: GeolocationPosition) => void>(() => {});
  const lastPosition = useRef<GeolocationPosition | undefined>(undefined);
  const provider = useMemo<LocationService>(
    () => ({
      requestPermission: async () => ({
        status: "granted",
        accuracy: "unknown",
      }),
      getCurrentPosition: async () => ({
        lngLat: [-122.33, 47.62],
        timestamp: Date.now(),
        accuracy: 25,
      }),
      watchPosition: (position) => {
        observations.current.watches += 1;
        receiver.current = position;
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          observations.current.releases += 1;
        };
      },
    }),
    []
  );

  useEffect(() => {
    const requireMap = (): MapRef => {
      if (!mapRef.current) throw new Error("Acceptance map is detached.");
      return mapRef.current;
    };
    const command: Tf08AcceptanceProbe["command"] = async (
      action,
      value = {}
    ) => {
      if (action === "read") {
        const map = requireMap();
        const [center, zoom, features] = await Promise.all([
          map.getCenter(),
          map.getZoom(),
          map.queryRenderedFeatures(undefined),
        ]);
        return {
          ...observations.current,
          center,
          zoom,
          features,
          position: lastPosition.current,
        };
      }
      if (action === "emit") {
        receiver.current({
          lngLat: [
            Number(value.longitude ?? -122.33),
            Number(value.latitude ?? 47.62),
          ],
          accuracy: 25,
          timestamp: Date.now(),
        });
        return { ...observations.current };
      }
      if (action === "configure") {
        const next = String(value.mode ?? "injected");
        setMode(next);
        setMounted(next !== "detached");
        setGeneration((current) => current + 1);
        setMapStyle(value.mapStyle ? String(value.mapStyle) : localStyle);
        return null;
      }
      if (action === "capture") {
        return captureRendering(
          backend,
          mapRef.current,
          value.output === "file" ? "file" : "data-url"
        );
      }
      if (action === "annotation-refresh") {
        await annotationRef.current?.refresh();
        return null;
      }
      if (action === "camera") {
        await requireMap().jumpTo({
          center: [Number(value.longitude ?? 0), Number(value.latitude ?? 0)],
          zoom: Number(value.zoom ?? 1),
        });
        return null;
      }
      if (action === "permission") return services.location.requestPermission();
      if (action === "position") {
        const requestedAt = Date.now();
        const position = await services.location.getCurrentPosition({
          timeoutMs: 12000,
        });
        return { ...position, requestedAt, completedAt: Date.now() };
      }
      throw new Error("Unknown acceptance action.");
    };
    attach({ command });
    return () => {
      attach(null);
    };
  }, [attach, backend, fixtureUrl, services]);

  if (!mounted) return null;
  return (
    <OneMap
      key={generation}
      ref={mapRef}
      mapStyle={mapStyle}
      style={style}
      initialViewState={camera}
      {...{
        options:
          mode === "unpreserved" ? undefined : renderingBufferOptions(backend),
      }}
      reuseMaps={
        backend.endsWith("web") &&
        (mode === "unpreserved" || mode === "retained")
      }
      gl={mode === "external" ? externalContext : undefined}
      {...(backend.endsWith("native") && mode.startsWith("coverage")
        ? {
            options:
              backend === "mapbox-native"
                ? {
                    logoEnabled: mode === "coverage-ornaments",
                    attributionEnabled: mode === "coverage-ornaments",
                    compassEnabled: mode === "coverage-ornaments",
                    compassFadeWhenNorth: false,
                    scaleBarEnabled: mode === "coverage-ornaments",
                  }
                : {
                    logo: mode === "coverage-ornaments",
                    attribution: mode === "coverage-ornaments",
                    compass: mode === "coverage-ornaments",
                    compassHiddenFacingNorth: false,
                    scaleBar: mode === "coverage-ornaments",
                  },
          }
        : {})}
      onLoad={() => {
        observations.current.loads += 1;
        void mapRef.current
          ?.jumpTo({
            center: [camera.longitude, camera.latitude],
            zoom: camera.zoom,
          })
          .catch(() => {
            observations.current.errors += 1;
          });
      }}
      onError={() => {
        observations.current.errors += 1;
      }}
      onMoveStart={() => {
        observations.current.moving = true;
      }}
      onMove={(event) => {
        observations.current.moves = [
          ...observations.current.moves,
          {
            origin: event.origin,
            center: [
              event.viewState.longitude,
              event.viewState.latitude,
            ] as const,
            zoom: event.viewState.zoom,
          },
        ].slice(-12);
      }}
      onMoveEnd={() => {
        observations.current.moving = false;
        observations.current.moveEnds += 1;
      }}
    >
      <Source
        id="tf08-points"
        type="geojson"
        data={{
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: 8008,
              properties: { test: "tf08" },
              geometry: { type: "Point", coordinates: [-122.34, 47.61] },
            },
          ],
        }}
      >
        <Layer
          id="tf08-point"
          type="circle"
          paint={{ "circle-color": "#ff0000", "circle-radius": 14 }}
        />
      </Source>
      <GeolocateControl
        key={mode}
        locationProvider={mode === "default" ? undefined : provider}
        trackUserLocation={mode !== "default"}
        zoom={12}
        onGeolocate={(position) => {
          observations.current.fixes += 1;
          lastPosition.current = position;
        }}
        onError={() => {
          observations.current.errors += 1;
        }}
      />
      {(!mode.startsWith("coverage") || mode === "coverage-annotation") && (
        <Marker
          ref={annotationRef}
          longitude={-122.35}
          latitude={47.61}
          renderMode={mode === "coverage-annotation" ? "annotation" : "view"}
        >
          {overlay}
        </Marker>
      )}
      {mode === "coverage-popup" && renderCoveragePopup(overlay)}
      {mode === "coverage-ornaments" && (
        <>
          {backend.endsWith("web") && ornamentControls}
          {backend.endsWith("web") && navigationControl}
        </>
      )}
      {mode === "coverage-puck" && nativePuck}
    </OneMap>
  );
};
