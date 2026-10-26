import {
  Control,
  GeolocateControl,
  Layer,
  type LngLat,
  type MapLayoutStyle,
  type MapRef,
  Marker,
  NavigationControl,
  Map as OneMap,
  ScaleControl,
  Source,
} from "one-map-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  emptyStyle,
  initialViewState,
  replacementStyle,
} from "../../tests/fixtures/map-fixture.js";

/** Configuration changes driven by the acceptance toolbar. */
export type Tf07Action = "remount" | "style" | "offset" | "popup" | "units";

/** Named geographic targets for real pointer and touch input. */
export type Tf07Target = "live" | "annotation" | "source";

/** Test-only readback, independent of the requested camera position. */
export interface Tf07Observation {
  /** Number of physical interactions received by each component. */
  readonly events: Readonly<Record<string, number>>;
  /** Last coordinate proposals from real drag events. */
  readonly positions: Readonly<Record<string, LngLat>>;
  /** Renderer camera center. */
  readonly center: LngLat;
  /** Renderer camera zoom. */
  readonly zoom: number;
  /** Renderer features belonging to the known fixture layer. */
  readonly features: readonly object[];
  /** Current map attachment generation. */
  readonly generation: number;
  /** Current source propagation configuration. */
  readonly stopSourcePropagation: boolean;
}

/** Test-only controls published by the mounted acceptance scene. */
export interface Tf07Probe {
  /** Reads actual renderer state and collected interaction observations. */
  readonly read: () => Promise<Tf07Observation>;
  /** Projects an input target into logical map-view units. */
  readonly project: (target: Tf07Target) => Promise<readonly [number, number]>;
  /** Changes React configuration; never fabricates a pointer or touch event. */
  readonly configure: (action: Tf07Action) => void;
  /** Toggles source-to-map propagation for the next physical source press. */
  readonly stopSource: (stop: boolean) => void;
}

interface Tf07SceneProps {
  readonly native?: boolean;
  readonly style: MapLayoutStyle;
  readonly markerContent: (
    kind: "live" | "annotation" | "popup",
    activateChild: () => void
  ) => ReactNode;
  readonly controlContent: ReactNode;
  readonly renderPopup: (
    children: ReactNode,
    onOpen: () => void,
    onClose: () => void
  ) => ReactNode;
  readonly report: (event: string) => void;
  readonly attach: (probe: Tf07Probe | null) => void;
}

const targets: Readonly<Record<Tf07Target, LngLat>> = {
  live: [-122.34, 47.61],
  annotation: [-122.38, 47.61],
  source: [-122.34, 47.58],
};

const location = { lngLat: [-122.33, 47.62] as LngLat, accuracy: 12 };

/**
 * Shared local-style scene for TF07 interaction acceptance.
 *
 * Both hosts provide their own child UI. The probe records events and reads
 * the renderer; it does not dispatch callbacks or certify visual behavior.
 */
export const Tf07Scene = ({
  native = false,
  style,
  markerContent,
  controlContent,
  renderPopup,
  report,
  attach,
}: Tf07SceneProps) => {
  const mapRef = useRef<MapRef>(null);
  const observations = useRef<Record<string, number>>({});
  const lastPositions = useRef<Record<string, LngLat>>({});
  const generationRef = useRef(0);
  const stopSource = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [mapStyle, setMapStyle] = useState(emptyStyle);
  const [live, setLive] = useState(targets.live);
  const [annotation, setAnnotation] = useState(targets.annotation);
  const [offset, setOffset] = useState<readonly [number, number] | undefined>();
  const [popup, setPopup] = useState(true);
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");

  const record = (name: string): void => {
    observations.current[name] = (observations.current[name] ?? 0) + 1;
    report(name);
  };

  const fail = (error: unknown): void => {
    record("error");
    // Keep raw renderer errors and service credentials out of fixture logs.
    report(error instanceof Error ? error.name : "operation-failed");
  };

  const loaded = (): void => {
    record("load");
    // TF07 tests attachment UI, not the pinned Mapbox Android opening-camera
    // behavior. Establish the fixture viewport through an actual camera command.
    void mapRef.current
      ?.jumpTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        bearing: initialViewState.bearing,
        pitch: initialViewState.pitch,
      })
      .catch(fail);
  };

  const configure = useCallback((action: Tf07Action): void => {
    if (action === "remount") {
      generationRef.current += 1;
      setGeneration(generationRef.current);
      setLive(targets.live);
      setAnnotation(targets.annotation);
      setPopup(true);
      return;
    }

    if (action === "style") {
      setMapStyle((current) =>
        current === emptyStyle ? replacementStyle : emptyStyle
      );
      return;
    }

    if (action === "offset") {
      setOffset((current) => (current ? undefined : [24, -12]));
      return;
    }

    if (action === "popup") {
      setPopup((current) => !current);
      return;
    }

    setUnit((current) => (current === "metric" ? "imperial" : "metric"));
  }, []);

  useEffect(() => {
    const requireMap = (): MapRef => {
      if (!mapRef.current) throw new Error("TF07 map is not attached.");
      return mapRef.current;
    };

    attach({
      read: async () => {
        const map = requireMap();
        const [center, zoom, features] = await Promise.all([
          map.getCenter(),
          map.getZoom(),
          map.queryRenderedFeatures(undefined, { layers: ["tf07-point"] }),
        ]);

        return {
          events: { ...observations.current },
          positions: { ...lastPositions.current },
          center,
          zoom,
          features,
          generation: generationRef.current,
          stopSourcePropagation: stopSource.current,
        };
      },
      project: (target) => requireMap().project(targets[target]),
      configure,
      stopSource: (stop) => {
        stopSource.current = stop;
      },
    });

    return () => attach(null);
  }, [attach, configure]);

  return (
    <OneMap
      key={generation}
      id="tf07-map"
      ref={mapRef}
      mapStyle={mapStyle}
      initialViewState={initialViewState}
      style={style}
      interactiveLayerIds={["tf07-point"]}
      onLoad={loaded}
      onStyleLoad={() => record("style")}
      onMove={() => record("move")}
      onClick={() => record("map-click")}
      onError={fail}
    >
      <Source
        id="tf07-source"
        type="geojson"
        data={{
          type: "Feature",
          id: 707,
          properties: { fixture: "tf07" },
          geometry: { type: "Point", coordinates: targets.source },
        }}
        onClick={(event) => {
          record("source-click");
          if (stopSource.current) event.stopPropagation();
        }}
      >
        <Layer
          id="tf07-point"
          type="circle"
          paint={{ "circle-color": "#16a34a", "circle-radius": 16 }}
        />
      </Source>
      <Marker id="tf07-default" longitude={-122.38} latitude={47.63} />
      <Marker
        id="tf07-live"
        longitude={live[0]}
        latitude={live[1]}
        offset={offset}
        onClick={() => record("marker-click")}
        {...(!native && {
          draggable: true,
          onDragStart: () => record("live-start"),
          onDrag: (event) => {
            setLive(event.lngLat);
            record("live-drag");
          },
          onDragEnd: (event) => {
            lastPositions.current.live = event.lngLat;
            setLive(event.lngLat);
            record("live-end");
          },
        })}
        onError={fail}
      >
        {/* eslint-disable-next-line react/refs -- markerContent receives an event callback; the callback reads observation refs only when clicked. */}
        {markerContent("live", () => record("child-click"))}
      </Marker>
      <Marker
        id="tf07-annotation"
        longitude={annotation[0]}
        latitude={annotation[1]}
        renderMode="annotation"
        onClick={() => record("annotation-click")}
        {...(!native && {
          draggable: true,
          onDragStart: () => record("annotation-start"),
          onDrag: (event) => setAnnotation(event.lngLat),
          onDragEnd: (event) => {
            lastPositions.current.annotation = event.lngLat;
            setAnnotation(event.lngLat);
            record("annotation-end");
          },
        })}
        onError={fail}
      >
        {markerContent("annotation", () => undefined)}
      </Marker>
      {/* eslint-disable react/refs -- Host renderers receive event callbacks; observation refs are read only when activated. */}
      {popup &&
        renderPopup(
          markerContent("popup", () => record("popup-child")),
          () => record("popup-open"),
          () => {
            record("popup-close");
            setPopup(false);
          }
        )}
      {/* eslint-enable react/refs */}
      <NavigationControl position="top-right" onError={fail} />
      <GeolocateControl
        position="top-left"
        getCurrentPosition={async () => location}
        zoom={11}
        onGeolocate={() => record("location")}
        onError={fail}
      />
      <ScaleControl position="bottom-left" unit={unit} onError={fail} />
      <Control position="bottom-right">{controlContent}</Control>
    </OneMap>
  );
};
