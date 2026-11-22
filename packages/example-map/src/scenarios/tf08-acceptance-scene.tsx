import type {
  GeolocationPosition,
  MapLayoutStyle,
  MapRef,
  MarkerRef,
} from "one-map-react";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  captureRendering as captureWebRendering,
  renderingBufferOptions,
} from "./capture-web-rendering.js";
import type { NativeLocationButtonProps } from "./native-location-button.js";
import {
  coordinateTuple,
  isBrowserMap,
  type NativeSceneComponents,
  type SceneMap,
  type WebSceneMap,
  type SceneStyle,
  type WebSceneComponents,
} from "./scene-components.js";
import { WebPosition } from "./web-position.js";

/** Commands expose application actions and independent renderer readback only. */
export interface Tf08AcceptanceProbe {
  /** Executes a test action against the mounted map or selected public service. */
  readonly command: (
    action: string,
    value?: Record<string, unknown>
  ) => Promise<unknown>;
}

interface Tf08AcceptanceSceneProps {
  readonly renderLocation: ComponentType<NativeLocationButtonProps>;
  readonly requestLocationPermission: (
    signal?: AbortSignal
  ) => Promise<unknown>;
  readonly getCurrentPosition: (
    signal?: AbortSignal,
    timeoutMs?: number
  ) => Promise<GeolocationPosition>;
  readonly backend: string;
  readonly components: WebSceneComponents | NativeSceneComponents;
  readonly style: MapLayoutStyle;
  readonly overlay: ReactNode;
  readonly renderCoveragePopup: (children: ReactNode) => ReactNode;
  readonly attach: (probe: Tf08AcceptanceProbe | null) => void;
  readonly fixtureUrl: string;
  readonly externalContext?: WebGLRenderingContext;
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

const localStyle: SceneStyle = {
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
  requestLocationPermission,
  getCurrentPosition,
  renderLocation: Location,
  backend,
  components,
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
  const { Map: MapView, Marker, Source, Layer } = components;
  const native = components.platform === "native";
  const mapRef = useRef<SceneMap>(null);
  const nativeMapRef = useRef<MapRef>(null);
  const attachMap = useCallback((map: WebSceneMap | MapRef | null) => {
    mapRef.current = map;
    nativeMapRef.current = map && !isBrowserMap(map) ? map : null;
  }, []);
  const annotationRef = useRef<MarkerRef>(null);
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [mode, setMode] = useState("injected");
  const [mapStyle, setMapStyle] = useState<SceneStyle | string>(localStyle);
  // Offline coverage is deliberately bounded to the downloaded region and zooms.
  const camera =
    typeof mapStyle === "string" && mapStyle.includes("/offline-style.json")
      ? { ...initialCamera, longitude: 0, latitude: 0, zoom: 1 }
      : initialCamera;
  const observations = useRef({
    loads: 0,
    fixes: 0,
    errors: 0,
    moving: false,
    moveEnds: 0,
    moves: [] as {
      origin: string;
      center: readonly [number, number];
      zoom: number;
    }[],
  });
  const lastPosition = useRef<GeolocationPosition | undefined>(undefined);
  const [displayPosition, setDisplayPosition] = useState<GeolocationPosition>();

  useEffect(() => {
    const requests = new Set<AbortController>();
    const requireMap = (): SceneMap => {
      if (!mapRef.current) throw new Error("Acceptance map is detached.");
      return mapRef.current;
    };
    const command: Tf08AcceptanceProbe["command"] = async (
      action,
      value = {}
    ) => {
      if (action === "observations") return { ...observations.current };
      if (action === "read") {
        const map = requireMap();
        const [center, zoom, features] = await Promise.all([
          map.getCenter(),
          map.getZoom(),
          map.queryRenderedFeatures(undefined),
        ]);
        return {
          ...observations.current,
          center: coordinateTuple(center),
          zoom,
          features,
          position: lastPosition.current,
        };
      }
      if (action === "configure") {
        const next = String(value.mode ?? "injected");
        setDisplayPosition(undefined);
        setMode(next);
        setMounted(next !== "detached");
        setGeneration((current) => current + 1);
        setMapStyle(value.mapStyle ? String(value.mapStyle) : localStyle);
        return null;
      }
      if (action === "capture") {
        const map = mapRef.current;
        const output = value.output === "file" ? "file" : "data-url";
        if (isBrowserMap(map)) return captureWebRendering(backend, map, output);
        if (!native) throw new Error("Observation map is not attached.");
        return components.captureRendering(
          backend,
          nativeMapRef.current,
          output
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
      if (action === "permission" || action === "position") {
        const requestedAt = Date.now();
        const controller = new AbortController();
        requests.add(controller);
        try {
          if (action === "permission") {
            const permission = await requestLocationPermission(
              controller.signal
            );
            if (controller.signal.aborted)
              throw new Error("Location request owner disposed.");
            return permission;
          }
          const position = await getCurrentPosition(controller.signal, 12000);
          if (controller.signal.aborted)
            throw new Error("Location request owner disposed.");
          return { ...position, requestedAt, completedAt: Date.now() };
        } finally {
          requests.delete(controller);
        }
      }
      throw new Error("Unknown acceptance action.");
    };
    attach({ command });
    return () => {
      attach(null);
      for (const controller of requests) controller.abort();
    };
  }, [
    attach,
    backend,
    components,
    native,
    fixtureUrl,
    requestLocationPermission,
    getCurrentPosition,
  ]);

  if (!mounted) return null;
  const locationControl = (
    <Location
      key={`${generation}-${mode}`}
      mapRef={nativeMapRef}
      corner="right"
      getCurrentPosition={(signal) =>
        mode === "default"
          ? getCurrentPosition(signal)
          : Promise.resolve({
              lngLat: [-122.33, 47.62],
              timestamp: Date.now(),
              accuracy: 25,
            })
      }
      zoom={12}
      onGeolocate={(position) => {
        observations.current.fixes += 1;
        lastPosition.current = position;
        setDisplayPosition(position);
      }}
      onError={() => {
        observations.current.errors += 1;
      }}
    />
  );
  return (
    <>
      <MapView
        key={generation}
        ref={attachMap}
        mapStyle={mapStyle}
        style={style}
        initialViewState={camera}
        {...(!native && mode !== "unpreserved"
          ? renderingBufferOptions(backend)
          : {})}
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
                      compassPosition: { top: 64, right: 8 },
                      scaleBarEnabled: mode === "coverage-ornaments",
                    }
                  : {
                      logo: mode === "coverage-ornaments",
                      attribution: mode === "coverage-ornaments",
                      compass: mode === "coverage-ornaments",
                      compassHiddenFacingNorth: false,
                      compassPosition: { top: 64, right: 8 },
                      scaleBar: mode === "coverage-ornaments",
                    },
            }
          : {})}
        onLoad={async () => {
          observations.current.loads += 1;
          const map = mapRef.current;
          try {
            await map?.jumpTo({
              center: [camera.longitude, camera.latitude],
              zoom: camera.zoom,
            });
          } catch {
            if (mapRef.current === map) observations.current.errors += 1;
          }
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
              origin:
                "origin" in event && event.origin
                  ? event.origin
                  : "originalEvent" in event && event.originalEvent
                    ? "user"
                    : "unknown",
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
        {!(backend.endsWith("native") && mode === "coverage-puck") &&
          (native ? (
            <components.UserLocation
              position={displayPosition}
              showAccuracyCircle
            />
          ) : (
            <WebPosition components={components} position={displayPosition} />
          ))}
        {backend.endsWith("web") && locationControl}

        {(!mode.startsWith("coverage") || mode === "coverage-annotation") && (
          <Marker
            {...(native && {
              ref: annotationRef,
              renderMode:
                mode === "coverage-annotation"
                  ? ("annotation" as const)
                  : ("view" as const),
            })}
            longitude={-122.35}
            latitude={47.61}
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
      </MapView>
      {backend.endsWith("native") && locationControl}
    </>
  );
};
