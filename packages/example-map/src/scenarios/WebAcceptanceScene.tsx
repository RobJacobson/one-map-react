import {
  type ComponentProps,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  useEffect,
} from "react";
import type { MapRef as MapboxMapRef } from "react-map-gl/mapbox";
import type { MapRef as MaplibreMapRef } from "react-map-gl/maplibre";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import type { NativeLocationButtonProps } from "./native-location-button.js";
import type { WebBackend, WebSceneComponents } from "./scene-components.js";
import { WebCameraApp } from "./web-camera-app.js";
import {
  useWebCorrectionProbe,
  WebCorrectionsApp,
} from "./web-corrections-app.js";
import { WebLifecycleApp } from "./web-lifecycle-app.js";
import { WebQueriesApp } from "./web-queries-app.js";
import { WebSourcesApp } from "./web-sources-app.js";
import { WebTf07App } from "./web-tf07-app.js";
import { WebTf07Focused } from "./web-tf07-focused.js";
import { WebTf08App } from "./web-tf08-app.js";
import { WebTf09App } from "./web-tf09-app.js";

type BrowserMapRef = MapboxMapRef | MaplibreMapRef;

interface RenderedSources {
  getSource(id: string): { serialize(): unknown } | undefined;
}

interface RenderingMap extends RenderedSources {
  on(event: "render", listener: () => void): unknown;
  off(event: "render", listener: () => void): unknown;
  getLayer(id: string): unknown;
  getTerrain(): unknown;
  getProjection(): unknown;
  getLight(): unknown;
}

type Renderer = Pick<
  typeof import("react-map-gl/mapbox") | typeof import("react-map-gl/maplibre"),
  | "Map"
  | "Source"
  | "Layer"
  | "Marker"
  | "Popup"
  | "GeolocateControl"
  | "ScaleControl"
  | "AttributionControl"
  | "NavigationControl"
  | "FullscreenControl"
>;

interface WebAcceptanceOptions<Handle extends BrowserMapRef> {
  readonly backend: WebBackend;
  readonly renderer: Renderer;
  readonly useMap: () => { readonly current?: Handle };
  readonly namedRendering: (map: Handle) => Promise<unknown>;
  readonly renderMedia: ComponentProps<typeof WebTf09App>["renderMedia"];
  readonly globalStateScene?: ComponentType;
}

/**
 * Binds web acceptance routes and controls to one react-map-gl entry.
 *
 * @param options - Selected renderer components and backend-specific probes.
 * @returns The acceptance screen for the selected backend.
 */
export const createWebAcceptance = <Handle extends BrowserMapRef>({
  backend,
  renderer,
  useMap,
  namedRendering,
  renderMedia,
  globalStateScene: GlobalStateScene,
}: WebAcceptanceOptions<Handle>): ComponentType<{
  readonly scenario: AcceptanceScenario;
}> => {
  const {
    Map: BrowserMap,
    Source,
    Layer,
    Marker,
    Popup,
    GeolocateControl,
    ScaleControl,
    AttributionControl,
    NavigationControl,
    FullscreenControl,
  } = renderer;
  const components: WebSceneComponents = {
    platform: "web",
    Map: BrowserMap,
    Source,
    Layer,
    Marker,
  };

  const WebAcceptanceScene = ({
    scenario,
  }: {
    readonly scenario: AcceptanceScenario;
  }): ReactElement => {
    switch (scenario) {
      case "tf03":
        return <WebLifecycleApp components={components} />;
      case "tf04":
        return <WebCameraApp components={components} />;
      case "tf05":
        return <WebSourcesApp components={components} />;
      case "tf06":
        return <WebQueriesApp Map={BrowserMap} Source={Source} Layer={Layer} />;
      case "corrections":
        return (
          <WebCorrectionsApp
            components={components}
            probe={<CorrectionProbe />}
          />
        );
      case "tf07":
        return (
          <WebTf07App
            renderLocation={WebLocationControl}
            renderNavigation={renderNavigation}
            renderScale={renderScale}
            components={components}
            renderPopup={renderPopup}
          />
        );
      case "tf07-focused":
        return (
          <WebTf07Focused
            renderLocation={WebLocationControl}
            controls={
              <>
                <NavigationControl />
                <FullscreenControl />
              </>
            }
            components={components}
          />
        );
      case "tf08":
        return (
          <WebTf08App
            renderLocation={WebLocationControl}
            navigationControl={<NavigationControl position="top-right" />}
            ornamentControls={
              <>
                <AttributionControl position="bottom-right" />
                <ScaleControl position="bottom-left" />
              </>
            }
            components={components}
            backend={backend}
            renderCoveragePopup={renderCoveragePopup}
          />
        );
      case "tf09":
        return (
          <WebTf09App
            components={components}
            backend={backend}
            renderProbe={RenderingProbe}
            renderMedia={renderMedia}
          />
        );
      case "global-state":
        if (!GlobalStateScene) {
          throw new Error(
            "This selected fixture is unavailable on Mapbox web."
          );
        }
        return <GlobalStateScene />;
      case "tf07-retained":
        throw new Error("tf07-retained requires a native acceptance host.");
      case "tf06-lifetimes":
      case "tf08-storage":
      case "tf09-model":
        throw new Error(
          backend === "mapbox-web"
            ? "This selected fixture is unavailable on Mapbox web."
            : "This selected fixture is native-only."
        );
      default:
        scenario satisfies never;
        throw new Error(`Unknown web acceptance scenario: ${scenario}`);
    }
  };

  const CorrectionProbe = () => {
    useWebCorrectionProbe(useMap().current?.getMap());
    return null;
  };

  const RenderingProbe = ({
    attachNamed,
  }: {
    readonly attachNamed: (read: (() => unknown) | undefined) => void;
  }) => {
    const map = useMap().current;
    useEffect(() => {
      if (!map) return;
      const rendering: RenderingMap = map;
      attachNamed(() => namedRendering(map));
      let renderedFrames = 0;
      let frameShade: boolean | undefined;
      const observeFrame = () => {
        renderedFrames += 1;
        frameShade = !!rendering.getLayer("shade");
      };
      rendering.on("render", observeFrame);
      window.__oneMapTf09Inspect = () => ({
        shade: !!rendering.getLayer("shade"),
        frameShade,
        renderedFrames,
        canvas: !!rendering.getSource("canvas"),
        video: !!rendering.getSource("video"),
        videoState: (() => {
          const video = (
            rendering.getSource("video") as
              | { getVideo?: () => HTMLVideoElement }
              | undefined
          )?.getVideo?.();
          return video
            ? {
                readyState: video.readyState,
                paused: video.paused,
                time: video.currentTime,
                width: video.videoWidth,
                height: video.videoHeight,
                error: video.error?.message,
              }
            : undefined;
        })(),
        custom: !!rendering.getLayer("custom"),
        canvasCoordinates: rendering.getSource("canvas")?.serialize(),
        terrain: rendering.getTerrain(),
        projection: rendering.getProjection(),
        light: rendering.getLight(),
      });
      return () => {
        rendering.off("render", observeFrame);
        delete window.__oneMapTf09Inspect;
        attachNamed(undefined);
      };
    }, [map, attachNamed]);
    return null;
  };

  const renderPopup = (
    children: ReactNode,
    onOpen: () => void,
    onClose: () => void
  ): ReactNode => (
    <Popup
      longitude={-122.3}
      latitude={47.63}
      closeOnClick={false}
      closeOnMove={false}
      onOpen={onOpen}
      onClose={onClose}
    >
      {children}
    </Popup>
  );

  const renderCoveragePopup = (children: ReactNode): ReactNode => (
    <Popup
      longitude={-122.35}
      latitude={47.61}
      closeButton={false}
      closeOnClick={false}
    >
      {children}
    </Popup>
  );

  const renderNavigation = () => <NavigationControl position="top-right" />;

  const renderScale = (unit: "metric" | "imperial") => (
    <ScaleControl position="bottom-left" unit={unit} />
  );

  /** Browser acquisition and camera behavior are owned by the selected wrapper. */
  const WebLocationControl = ({
    onGeolocate,
    onError,
    zoom,
    corner,
  }: Pick<
    NativeLocationButtonProps,
    "onGeolocate" | "onError" | "zoom" | "corner"
  >) => (
    <GeolocateControl
      position={corner === "right" ? "top-right" : "top-left"}
      showUserLocation={false}
      fitBoundsOptions={{ maxZoom: zoom ?? 14 }}
      onGeolocate={(event) =>
        onGeolocate?.({
          lngLat: [event.coords.longitude, event.coords.latitude],
          accuracy: event.coords.accuracy,
          timestamp: event.timestamp,
        })
      }
      onError={onError}
    />
  );

  return WebAcceptanceScene;
};

/**
 * Reads the renderer operations shared by the two named browser probes.
 *
 * @param selected - The attached react-map-gl handle.
 * @returns Gesture, event, style, and source observations.
 */
export const readWebNamedRendering = (
  selected: Pick<
    BrowserMapRef,
    "getMap" | "on" | "off" | "getLayer" | "getCanvas" | "getStyle"
  > &
    RenderedSources
): WebNamedRendering => {
  const renderer = selected.getMap();
  const handler = renderer.dragPan;
  const before = handler.isEnabled();
  let disabled;
  try {
    handler.disable();
    disabled = handler.isEnabled();
  } finally {
    if (before) handler.enable();
  }
  let eventCalls = 0;
  const listener = () => {
    eventCalls += 1;
  };
  Reflect.apply(selected.on, selected, ["tf10-probe", listener]);
  try {
    Reflect.apply(renderer.fire, renderer, ["tf10-probe"]);
  } finally {
    Reflect.apply(selected.off, selected, ["tf10-probe", listener]);
  }
  Reflect.apply(renderer.fire, renderer, ["tf10-probe"]);
  return {
    dragPan: { before, disabled, restored: handler.isEnabled() },
    source: !!selected.getSource("point"),
    layer: !!selected.getLayer("known"),
    canvas: selected.getCanvas().tagName === "CANVAS",
    styleLayer: selected
      .getStyle()
      .layers.some((layer) => layer.id === "known"),
    eventCalls,
  };
};

/** Gesture, event, source, and style observations from the shared browser probe. */
export interface WebNamedRendering {
  readonly dragPan: {
    readonly before: boolean;
    readonly disabled: boolean;
    readonly restored: boolean;
  };
  readonly source: boolean;
  readonly layer: boolean;
  readonly canvas: boolean;
  readonly styleLayer: boolean;
  readonly eventCalls: number;
}
