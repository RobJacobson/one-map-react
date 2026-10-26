import {
  type GeoJsonFeatureCollection,
  Images,
  Layer,
  type MapErrorEvent,
  type MapLayoutStyle,
  type MapStyle,
  Map as OneMap,
  Source,
} from "one-map-react";
import { useEffect, useState } from "react";

import { initialViewState, markers } from "../../tests/fixtures/map-fixture.js";

interface SourcesMapProps {
  /** Fixture server base URL for tile, overlay, and marker image URLs. */
  readonly base: string;
  readonly mapStyle: MapStyle;
  readonly routeData: GeoJsonFeatureCollection;
  /** Line paint color while set; `undefined` removes the paint key. */
  readonly lineColor: string | undefined;
  /** Whether the vector and image sources are mounted. */
  readonly showTransient: boolean;
  readonly style?: MapLayoutStyle;
  readonly onLoad?: () => void;
  readonly onStyleLoad?: () => void;
  readonly onError?: (event: MapErrorEvent) => void;
}

/** Image source corners around the Seattle fixture camera. */
const overlayCorners = [
  [-122.45, 47.7],
  [-122.2, 47.7],
  [-122.2, 47.5],
  [-122.45, 47.5],
] as const;

/**
 * Shared TF05 scene: vector, raster, image, and two GeoJSON sources under
 * fill, raster, line, circle, and symbol layers, plus one registered image.
 */
export const SourcesMap = ({
  base,
  mapStyle,
  routeData,
  lineColor,
  showTransient,
  style,
  onLoad,
  onStyleLoad,
  onError,
}: SourcesMapProps) => {
  const [mountedStyle, setMountedStyle] = useState(mapStyle);
  const [imagesReady, setImagesReady] = useState(false);
  const mountedStyleKey = styleContentKey(mountedStyle);
  const requestedStyleKey = styleContentKey(mapStyle);

  // First commit Images absence; this effect runs after its passive cleanup.
  useEffect(() => {
    if (mountedStyleKey === requestedStyleKey) return;
    // eslint-disable-next-line react/set-state-in-effect -- Style mutation needs a commit after Images cleanup.
    setImagesReady(false);
    setMountedStyle(mapStyle);
  }, [mapStyle, mountedStyleKey, requestedStyleKey]);

  return (
    <OneMap
      mapStyle={mountedStyle}
      initialViewState={initialViewState}
      style={style}
      onLoad={onLoad}
      onStyleLoad={() => {
        if (mountedStyleKey !== requestedStyleKey) return;
        setImagesReady(true);
        onStyleLoad?.();
      }}
      onError={onError}
    >
      {imagesReady && mountedStyleKey === requestedStyleKey ? (
        <Images images={{ marker: `${base}/marker.png` }} />
      ) : null}
      {showTransient ? (
        <Source id="blocks" type="vector" url={`${base}/tiles.json`}>
          <Layer
            id="blocks-fill"
            type="fill"
            source-layer="land"
            paint={{ "fill-color": "#86efac", "fill-opacity": 0.5 }}
          />
        </Source>
      ) : null}
      <Source id="sat" type="raster" url={`${base}/raster.json`} tileSize={256}>
        <Layer
          id="sat-raster"
          type="raster"
          paint={{ "raster-opacity": 0.65 }}
        />
      </Source>
      {showTransient ? (
        <Source
          id="overlay"
          type="image"
          url={`${base}/overlay.png`}
          coordinates={overlayCorners}
        >
          <Layer
            id="overlay-raster"
            type="raster"
            paint={{ "raster-opacity": 0.5 }}
          />
        </Source>
      ) : null}
      <Source id="routes" type="geojson" data={routeData}>
        <Layer
          id="route-line"
          type="line"
          paint={{
            ...(lineColor === undefined ? {} : { "line-color": lineColor }),
            "line-width": 3,
          }}
          layout={{ "line-cap": "round" }}
        />
      </Source>
      <Source id="markers" type="geojson" data={markers}>
        <Layer
          id="marker-circles"
          type="circle"
          paint={{ "circle-color": "#dc2626", "circle-radius": 6 }}
        />
        <Layer
          id="marker-labels"
          type="symbol"
          layout={{
            "icon-image": "marker",
            "icon-allow-overlap": true,
          }}
        />
      </Source>
    </OneMap>
  );
};

// Match the facade's declarative equality so equal style values need no load event.
const styleContentKey = (style: MapStyle): string =>
  JSON.stringify(style, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        )
      : value
  );
