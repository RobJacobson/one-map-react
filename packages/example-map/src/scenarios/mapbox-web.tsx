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
} from "react-map-gl/mapbox";

import type { Tf09Media } from "./web-tf09-media.js";
import {
  createWebAcceptance,
  readWebNamedRendering,
} from "./WebAcceptanceScene.js";

/** Exercises selected rendering and TF10 ref paths against the actual attached map. */
export const namedRendering = async (selected: MapRef) => {
  const tf10 = readWebNamedRendering(selected);
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

/** Browser acceptance entry for the selected Mapbox or MapLibre renderer. */
export const App = createWebAcceptance({
  backend: "mapbox-web",
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
});
