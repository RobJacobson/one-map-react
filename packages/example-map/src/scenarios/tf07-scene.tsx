import type { LngLat, MapLayoutStyle, MapRef } from "one-map-react";
import {
  type ComponentType,
  type ComponentProps,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  emptyStyle,
  initialViewState,
  replacementStyle,
} from "./map-fixture.js";
import type { NativeLocationButtonProps } from "./native-location-button.js";
import {
  coordinateTuple,
  isBrowserMap,
  pointTuple,
  type NativeSceneComponents,
  type SceneMap,
  type WebSceneComponents,
  type WebSceneMap,
} from "./scene-components.js";
import { WebPosition } from "./web-position.js";

/** Configuration changes driven by the acceptance toolbar. */
export type Tf07Action = "remount" | "style" | "offset" | "popup" | "units";

/** Named geographic targets for real pointer and touch input. */
export type Tf07Target = "live" | "annotation" | "source" | "popup";

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
}

/** Test-only controls published by the mounted acceptance scene. */
export interface Tf07Probe {
  /** Reads actual renderer state and collected interaction observations. */
  readonly read: () => Promise<Tf07Observation>;
  /** Projects an input target into logical map-view units. */
  readonly project: (target: Tf07Target) => Promise<readonly [number, number]>;
  /** Changes React configuration; never fabricates a pointer or touch event. */
  readonly configure: (action: Tf07Action) => void;
}

interface Tf07SceneProps {
  readonly renderLocation: ComponentType<NativeLocationButtonProps>;
  readonly components: WebSceneComponents | NativeSceneComponents;
  readonly nativeOrnaments?: ComponentProps<
    NativeSceneComponents["Map"]
  >["options"];
  readonly renderScale?: (unit: "metric" | "imperial") => ReactNode;
  readonly renderNavigation: ComponentType<{
    readonly mapRef: RefObject<MapRef | null>;
    readonly onError: (error: unknown) => void;
  }>;
  readonly style: MapLayoutStyle;
  readonly markerContent: (
    kind: "live" | "annotation" | "popup",
    activateChild: () => void
  ) => ReactNode;
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
  popup: [-122.3, 47.63],
};

const location = { lngLat: [-122.33, 47.62] as LngLat, accuracy: 12 };

/**
 * Shared local-style scene for TF07 interaction acceptance.
 *
 * Both hosts provide their own child UI. The probe records events and reads
 * the renderer; it does not dispatch callbacks or certify visual behavior.
 */
export const Tf07Scene = ({
  components,
  nativeOrnaments,
  renderScale,
  renderLocation: Location,
  style,
  markerContent,
  renderPopup,
  renderNavigation: Navigation,
  report,
  attach,
}: Tf07SceneProps) => {
  const { Map: MapView, Marker, Source, Layer } = components;
  const native = components.platform === "native";
  const [displayPosition, setDisplayPosition] =
    useState<import("one-map-react").GeolocationPosition>();
  const mapRef = useRef<SceneMap>(null);
  const nativeMapRef = useRef<MapRef>(null);
  const attachMap = useCallback((map: WebSceneMap | MapRef | null) => {
    mapRef.current = map;
    nativeMapRef.current = !isBrowserMap(map) ? map : null;
  }, []);
  const countedStyle = useRef<{ style: unknown; generation: number } | null>(
    null
  );
  const observations = useRef<Record<string, number>>({});
  const lastPositions = useRef<Record<string, LngLat>>({});
  const generationRef = useRef(0);
  const popupOwnerMounted = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [mapStyle, setMapStyle] = useState(emptyStyle);
  const [live, setLive] = useState(targets.live);
  const [annotation, setAnnotation] = useState(targets.annotation);
  const [offset, setOffset] = useState<[number, number] | undefined>();
  const [popup, setPopup] = useState(true);
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");

  // Map teardown can emit raw popup callbacks before the child unsubscribes.
  useLayoutEffect(() => {
    popupOwnerMounted.current = true;
    return () => {
      popupOwnerMounted.current = false;
    };
  }, []);

  const record = (name: string): void => {
    observations.current[name] = (observations.current[name] ?? 0) + 1;
    report(name);
  };

  const fail = (error: unknown): void => {
    record("error");
    // Keep raw renderer errors and service credentials out of fixture logs.
    report(error instanceof Error ? error.name : "operation-failed");
  };

  const loaded = async (): Promise<void> => {
    record("load");
    // Establish the fixture viewport on RNMapbox before exercising marker interactions.
    const map = mapRef.current;
    try {
      await map?.jumpTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        bearing: initialViewState.bearing,
        pitch: initialViewState.pitch,
      });
    } catch (error) {
      if (mapRef.current === map) fail(error);
    }
  };

  const configure = useCallback(
    (action: Tf07Action): void => {
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

      if (!native)
        setUnit((current) => (current === "metric" ? "imperial" : "metric"));
    },
    [native, setAnnotation, setPopup]
  );

  useEffect(() => {
    const requireMap = (): SceneMap => {
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
          center: coordinateTuple(center),
          zoom,
          features,
          generation: generationRef.current,
        };
      },
      project: async (target) =>
        pointTuple(await requireMap().project([...targets[target]])),
      configure,
    });

    return () => attach(null);
  }, [attach, configure]);

  const liveMarker = {
    longitude: live[0],
    latitude: live[1],
    offset,
    onClick: () => record("marker-click"),
    // eslint-disable-next-line react/refs -- The callback reads observations only when activated.
    children: markerContent("live", () => record("child-click")),
  };
  const annotationMarker = {
    longitude: annotation[0],
    latitude: annotation[1],
    onClick: () => record("annotation-click"),
    children: markerContent("annotation", () => undefined),
  };

  return (
    <>
      <MapView
        key={generation}
        id="tf07-map"
        ref={attachMap}
        {...(!native
          ? {
              onIdle: () => {
                if (
                  countedStyle.current?.style === mapStyle &&
                  countedStyle.current.generation === generation
                )
                  return;
                countedStyle.current = { style: mapStyle, generation };
                record("style");
              },
            }
          : { onStyleLoad: () => record("style") })}
        mapStyle={mapStyle}
        {...(native ? { options: nativeOrnaments } : {})}
        initialViewState={initialViewState}
        style={style}
        interactiveLayerIds={["tf07-point"]}
        onLoad={loaded}
        onMove={() => record("move")}
        onClick={(event) => {
          if (
            event.features?.some(
              (feature) =>
                String((feature as { id?: string | number }).id) === "707"
            )
          )
            record("source-click");
          record("map-click");
        }}
        onError={fail}
      >
        <Source
          id="tf07-source"
          type="geojson"
          data={{
            type: "Feature",
            id: 707,
            properties: { fixture: "tf07" },
            geometry: { type: "Point", coordinates: [...targets.source] },
          }}
        >
          <Layer
            id="tf07-point"
            type="circle"
            paint={{ "circle-color": "#16a34a", "circle-radius": 16 }}
          />
        </Source>
        <Marker
          {...(native && { id: "tf07-default" })}
          longitude={-122.38}
          latitude={47.63}
        />
        {native ? (
          <>
            <components.Marker id="tf07-live" onError={fail} {...liveMarker} />
            <components.Marker
              id="tf07-annotation"
              renderMode="annotation"
              onError={fail}
              {...annotationMarker}
            />
          </>
        ) : (
          <>
            <components.Marker
              {...liveMarker}
              draggable
              onDragStart={() => record("live-start")}
              onDrag={(event) => {
                lastPositions.current.live = coordinateTuple(event.lngLat);
                setLive(coordinateTuple(event.lngLat));
                record("live-drag");
              }}
              onDragEnd={(event) => {
                lastPositions.current.live = coordinateTuple(event.lngLat);
                setLive(coordinateTuple(event.lngLat));
                record("live-end");
              }}
            />
            <components.Marker
              {...annotationMarker}
              draggable
              onDragStart={() => record("annotation-start")}
              onDrag={(event) => setAnnotation(coordinateTuple(event.lngLat))}
              onDragEnd={(event) => {
                lastPositions.current.annotation = coordinateTuple(
                  event.lngLat
                );
                setAnnotation(coordinateTuple(event.lngLat));
                record("annotation-end");
              }}
            />
          </>
        )}
        {/* eslint-disable react/refs -- Host renderers receive event callbacks; observation refs are read only when activated. */}
        {popup &&
          renderPopup(
            markerContent("popup", () => record("popup-child")),
            () => {
              if (
                !popupOwnerMounted.current ||
                generation !== generationRef.current
              )
                return;
              record("popup-open");
            },
            () => {
              if (
                !popupOwnerMounted.current ||
                generation !== generationRef.current
              )
                return;
              record("popup-close");
              setPopup(false);
            }
          )}
        {/* eslint-enable react/refs */}
        {!native && <Navigation mapRef={nativeMapRef} onError={fail} />}
        {native ? (
          <components.UserLocation
            position={displayPosition}
            showAccuracyCircle
          />
        ) : (
          <WebPosition components={components} position={displayPosition} />
        )}
        {!native && (
          <Location
            key={generation}
            mapRef={nativeMapRef}
            getCurrentPosition={async () => location}
            zoom={11}
            onGeolocate={(position) => {
              setDisplayPosition(position);
              record("location");
            }}
            onError={fail}
          />
        )}
        {!native && renderScale?.(unit)}
      </MapView>
      {native && (
        <>
          <Navigation mapRef={nativeMapRef} onError={fail} />
          <Location
            key={generation}
            mapRef={nativeMapRef}
            getCurrentPosition={async () => location}
            zoom={11}
            onGeolocate={(position) => {
              setDisplayPosition(position);
              record("location");
            }}
            onError={fail}
          />
        </>
      )}
    </>
  );
};
