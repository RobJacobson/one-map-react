import type { MapRef } from "one-map-react";
import {
  Source as AdvancedSource,
  Layer as AdvancedLayer,
  type WebMapRef,
} from "one-map-react/maplibre-web";
import {
  adapter,
  WrapperPopup,
  WrapperGeolocateControl,
  WrapperScaleControl,
  WrapperAttributionControl,
  WrapperNavigationControl,
  WrapperFullscreenControl,
} from "one-map-react/maplibre-web";
import { type ReactNode, useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import { GlobalStateApp } from "./global-state-app.js";
import type { NativeLocationButtonProps } from "./native-location-button.js";
import { WebCameraApp } from "./web-camera-app.js";
import {
  useWebCorrectionProbe,
  WebCorrectionsApp,
} from "./web-corrections-app.js";
import { WebLifecycleApp } from "./web-lifecycle-app.js";
import { useWebQueriesProbe, WebQueriesApp } from "./web-queries-app.js";
import { WebSourcesApp } from "./web-sources-app.js";
import { WebTf07App } from "./web-tf07-app.js";
import { WebTf07Focused } from "./web-tf07-focused.js";
import { WebTf08App } from "./web-tf08-app.js";
import { WebTf09App } from "./web-tf09-app.js";
import type { Tf09Media } from "./web-tf09-media.js";

export const App = ({
  scenario,
}: {
  readonly scenario: AcceptanceScenario;
}) => {
  if (
    scenario === "tf09-model" ||
    scenario === "tf06-lifetimes" ||
    scenario === "tf08-storage"
  )
    throw new Error("This selected fixture is native-only.");
  if (scenario === "global-state") return <GlobalStateApp />;
  if (scenario === "tf09")
    return (
      <WebTf09App
        adapter={adapter}
        probe={<RenderingProbe />}
        renderMedia={renderMedia}
        named={namedRendering}
      />
    );
  if (scenario === "tf08")
    return (
      <WebTf08App
        renderLocation={WebLocationControl}
        navigationControl={<WrapperNavigationControl position="top-right" />}
        ornamentControls={
          <>
            <WrapperAttributionControl position="bottom-right" />
            <WrapperScaleControl position="bottom-left" />
          </>
        }
        adapter={adapter}
        renderCoveragePopup={renderCoveragePopup}
      />
    );
  if (scenario === "tf07-focused")
    return (
      <WebTf07Focused
        renderLocation={WebLocationControl}
        controls={
          <>
            <WrapperNavigationControl />
            <WrapperFullscreenControl />
          </>
        }
        adapter={adapter}
      />
    );
  if (scenario === "tf07")
    return (
      <WebTf07App
        renderLocation={WebLocationControl}
        renderNavigation={renderNavigation}
        renderScale={renderScale}
        adapter={adapter}
        renderPopup={renderPopup}
      />
    );
  if (scenario === "corrections") {
    return <WebCorrectionsApp adapter={adapter} probe={<CorrectionProbe />} />;
  }

  if (scenario === "tf06") {
    return <WebQueriesApp adapter={adapter} probe={<QueriesProbe />} />;
  }

  if (scenario === "tf05") {
    return <WebSourcesApp adapter={adapter} />;
  }

  if (scenario === "tf04") {
    return <WebCameraApp adapter={adapter} />;
  }

  return <WebLifecycleApp adapter={adapter} />;
};

const CorrectionProbe = () => {
  useWebCorrectionProbe(useMap().current?.getMap());
  return null;
};

const QueriesProbe = () => {
  useWebQueriesProbe(useMap().current?.getMap());
  return null;
};

const renderMedia = ({ canvas, urls, coordinates, custom }: Tf09Media) => (
  <>
    <AdvancedSource
      id="canvas"
      type="canvas"
      canvas={canvas}
      animate={false}
      coordinates={coordinates}
    >
      <AdvancedLayer
        id="canvas-layer"
        type="raster"
        paint={{ "raster-opacity": 1 }}
      />
    </AdvancedSource>
    <AdvancedSource
      id="video"
      type="video"
      urls={urls}
      coordinates={
        coordinates.map(([longitude, latitude]) => [
          longitude,
          latitude - 25,
        ]) as Tf09Media["coordinates"]
      }
    >
      <AdvancedLayer id="video-layer" type="raster" />
    </AdvancedSource>
    <AdvancedLayer id="custom" type="custom" renderingMode="2d" {...custom} />
  </>
);

/** Exercises selected rendering and TF10 ref paths against the actual attached map. */
export const namedRendering = async (map: MapRef) => {
  const selected = await (map as WebMapRef).getWrapperMap();
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
  const tf10 = {
    dragPan: { before, disabled, restored: handler.isEnabled() },
    source: !!selected.getSource("point"),
    layer: !!selected.getLayer("known"),
    canvas: selected.getCanvas().tagName === "CANVAS",
    styleLayer: selected
      .getStyle()
      .layers.some((layer) => layer.id === "known"),
    eventCalls,
  };
  selected.setGlobalStateProperty("rendering-fixture", 9009);
  selected.setSky({ "sky-color": "#112233" });
  return {
    tf10,
    globalState: selected.getGlobalState(),
    sky: selected.getSky(),
  };
};

const RenderingProbe = () => {
  const map = useMap().current;
  useEffect(() => {
    if (!map) return;
    let renderedFrames = 0;
    let frameShade: boolean | undefined;
    const observeFrame = () => {
      renderedFrames += 1;
      frameShade = !!map.getLayer("shade");
    };
    map.on("render", observeFrame);
    window.__oneMapTf09Inspect = () => ({
      shade: !!map.getLayer("shade"),
      frameShade,
      renderedFrames,
      canvas: !!map.getSource("canvas"),
      video: !!map.getSource("video"),
      videoState: (() => {
        const video = (
          map.getSource("video") as
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
      custom: !!map.getLayer("custom"),
      canvasCoordinates: map.getSource("canvas")?.serialize(),
      terrain: map.getTerrain(),
      projection: map.getProjection(),
      light: map.getLight(),
    });
    return () => {
      map.off("render", observeFrame);
      delete window.__oneMapTf09Inspect;
    };
  }, [map]);
  return null;
};

const renderPopup = (
  children: ReactNode,
  onOpen: () => void,
  onClose: () => void
): ReactNode => (
  <WrapperPopup
    longitude={-122.3}
    latitude={47.63}
    closeOnClick={false}
    closeOnMove={false}
    onOpen={onOpen}
    onClose={onClose}
  >
    {children}
  </WrapperPopup>
);

const renderCoveragePopup = (children: ReactNode): ReactNode => (
  <WrapperPopup
    longitude={-122.35}
    latitude={47.61}
    closeButton={false}
    closeOnClick={false}
  >
    {children}
  </WrapperPopup>
);

const renderNavigation = () => (
  <WrapperNavigationControl position="top-right" />
);

const renderScale = (unit: "metric" | "imperial") => (
  <WrapperScaleControl position="bottom-left" unit={unit} />
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
  <WrapperGeolocateControl
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
