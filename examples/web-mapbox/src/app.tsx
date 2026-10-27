import type { MapRef } from "one-map-react";
import {
  Source as AdvancedSource,
  Layer as AdvancedLayer,
  type WebMapRef,
} from "one-map-react/mapbox-web";
import {
  adapter,
  WrapperPopup,
  WrapperGeolocateControl,
  WrapperScaleControl,
  WrapperAttributionControl,
  WrapperNavigationControl,
} from "one-map-react/mapbox-web";
import { type ReactNode, useEffect } from "react";
import { useMap } from "react-map-gl/mapbox";

import type { NativeLocationButtonProps } from "../../shared/native-location-button.js";
import { WebCameraApp } from "../../shared/web-camera-app.js";
import {
  useWebCorrectionProbe,
  WebCorrectionsApp,
} from "../../shared/web-corrections-app.js";
import { WebLifecycleApp } from "../../shared/web-lifecycle-app.js";
import {
  useWebQueriesProbe,
  WebQueriesApp,
} from "../../shared/web-queries-app.js";
import { WebSourcesApp } from "../../shared/web-sources-app.js";
import { WebTf07App } from "../../shared/web-tf07-app.js";
import { WebTf08App } from "../../shared/web-tf08-app.js";
import { WebTf09App } from "../../shared/web-tf09-app.js";
import type { Tf09Media } from "../../shared/web-tf09-media.js";

const cameraSmoke = new URLSearchParams(window.location.search).get("tf04");
const sourcesSmoke = new URLSearchParams(window.location.search).get("tf05");
const queriesSmoke = new URLSearchParams(window.location.search).get("tf06");

export const App = () => {
  if (new URLSearchParams(window.location.search).get("tf09") === "rendering")
    return (
      <WebTf09App
        adapter={adapter}
        probe={<RenderingProbe />}
        renderMedia={renderMedia}
        named={namedRendering}
      />
    );
  if (new URLSearchParams(window.location.search).get("tf08") === "services")
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
  if (new URLSearchParams(window.location.search).get("tf07") === "ui")
    return (
      <WebTf07App
        renderLocation={WebLocationControl}
        renderNavigation={renderNavigation}
        renderScale={renderScale}
        adapter={adapter}
        renderPopup={renderPopup}
      />
    );
  if (cameraSmoke === "corrections" || sourcesSmoke === "corrections") {
    return <WebCorrectionsApp adapter={adapter} probe={<CorrectionProbe />} />;
  }

  if (queriesSmoke === "queries") {
    return <WebQueriesApp adapter={adapter} probe={<QueriesProbe />} />;
  }

  if (sourcesSmoke === "sources") {
    return <WebSourcesApp adapter={adapter} />;
  }

  if (cameraSmoke === "camera") {
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
  selected.setRain({ density: 0 });
  selected.setSnow({ density: 0 });
  selected.setScaleFactor(1.2);
  return {
    tf10,
    rain: selected.getRain(),
    snow: selected.getSnow(),
    scale: selected.getScaleFactor(),
  };
};

const RenderingProbe = () => {
  const map = useMap().current;
  useEffect(() => {
    if (!map) return;
    window.__oneMapTf09Inspect = () => ({
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
