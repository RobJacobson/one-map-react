import type { CanvasSource } from "maplibre-gl";
import { useEffect, useEffectEvent } from "react";
import {
  Map as BrowserMap,
  Source as AdvancedSource,
  Layer as AdvancedLayer,
  Marker,
  type MapRef,
  useMap,
  Popup,
  GeolocateControl,
  ScaleControl,
  AttributionControl,
  NavigationControl,
  FullscreenControl,
} from "react-map-gl/maplibre";

import { GlobalStateApp } from "./global-state-app.js";
import type { Tf09Media } from "./web-tf09-media.js";
import {
  createWebAcceptance,
  readWebNamedRendering,
} from "./WebAcceptanceScene.js";

/** Exercises selected rendering and TF10 ref paths against the actual attached map. */
export const namedRendering = async (selected: MapRef) => {
  const tf10 = readWebNamedRendering(selected);
  selected.setGlobalStateProperty("rendering-fixture", 9009);
  selected.setSky({ "sky-color": "#112233" });
  return {
    tf10,
    globalState: selected.getGlobalState(),
    sky: selected.getSky(),
  };
};

const renderMedia = ({ canvas, urls, coordinates, custom }: Tf09Media) => (
  <>
    <CanvasFixture canvas={canvas} coordinates={coordinates} />
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

const CanvasFixture = ({
  canvas,
  coordinates,
}: Pick<Tf09Media, "canvas" | "coordinates">) => {
  const map = useMap().current?.getMap();
  const currentCoordinates = useEffectEvent(() => coordinates);
  useEffect(() => {
    if (!map) return;
    const mount = () => {
      if (!map.isStyleLoaded() || map.getSource("canvas")) return;
      map.addSource("canvas", {
        type: "canvas",
        canvas,
        animate: false,
        coordinates: currentCoordinates(),
      });
      map.addLayer({
        id: "canvas-layer",
        type: "raster",
        source: "canvas",
        paint: { "raster-opacity": 1 },
      });
    };
    map.on("styledata", mount);
    map.on("idle", mount);
    mount();
    return () => {
      map.off("styledata", mount);
      map.off("idle", mount);
      if (map.getLayer("canvas-layer")) map.removeLayer("canvas-layer");
      if (map.getSource("canvas")) map.removeSource("canvas");
    };
  }, [map, canvas]);
  useEffect(() => {
    map?.getSource<CanvasSource>("canvas")?.setCoordinates(coordinates);
  }, [map, coordinates]);
  return null;
};

/** Browser acceptance entry for the selected Mapbox or MapLibre renderer. */
export const App = createWebAcceptance({
  backend: "maplibre-web",
  renderer: {
    Map: BrowserMap,
    Source: AdvancedSource,
    Layer: AdvancedLayer,
    Marker,
    Popup,
    GeolocateControl,
    ScaleControl,
    AttributionControl,
    NavigationControl,
    FullscreenControl,
  },
  useMap,
  namedRendering,
  renderMedia,
  globalStateScene: GlobalStateApp,
});
