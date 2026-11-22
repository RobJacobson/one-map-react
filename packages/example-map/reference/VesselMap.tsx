import {
  type ComponentRef,
  type ComponentType,
  type JSX,
  useRef,
  useState,
} from "react";

import { Layer, Map as VesselMapView, Marker, Source } from "./maps.js";
import { vesselData, vesselPosition, vesselStyle } from "./vessel-fixture.js";

/** Values and action for the host's camera controls and hit readout. */
export interface VesselControlsProps {
  /** Starts a flight to the vessel. */
  readonly flyToVessel: () => void;
  /** First feature ID at the clicked point, if one was found. */
  readonly hitFeatureId: string | number | undefined;
  /** Latest zoom reported by the map, or the initial zoom before it moves. */
  readonly zoom: number;
}

/** Highlight state and action for a host-rendered marker child. */
export interface VesselMarkerProps {
  /** Whether the vessel and route are highlighted. */
  readonly highlighted: boolean;
  /** Changes the vessel and route highlight. */
  readonly toggleHighlight: () => void;
}

interface VesselMapProps {
  readonly MarkerContent: ComponentType<VesselMarkerProps>;
  readonly Controls: ComponentType<VesselControlsProps>;
}

const initialView = { longitude: -122.47, latitude: 47.609, zoom: 12 };
const interactiveLayers = ["vessel-position", "vessel-route"];
const paintTransition = { duration: 450, delay: 0 };

/**
 * Renders a vessel and route using the selected platform's map components.
 *
 * @param props - Host controls and marker presentation.
 * @returns The map and its host-rendered controls.
 */
export const VesselMap = ({
  MarkerContent,
  Controls,
}: VesselMapProps): JSX.Element => {
  const mapRef = useRef<ComponentRef<typeof VesselMapView>>(null);
  const [highlighted, setHighlighted] = useState(false);
  const [hitFeatureId, setHitFeatureId] = useState<string | number>();
  const [zoom, setZoom] = useState(initialView.zoom);

  const flyToVessel = () => {
    mapRef.current?.flyTo({ center: vesselPosition, zoom: 14, duration: 900 });
  };
  const toggleHighlight = () => setHighlighted((previous) => !previous);

  return (
    <>
      <VesselMapView
        ref={mapRef}
        mapStyle={vesselStyle}
        initialViewState={initialView}
        interactiveLayerIds={interactiveLayers}
        onClick={(event) => setHitFeatureId(event.features?.[0]?.id)}
        onMove={(event) => setZoom(event.viewState.zoom)}
      >
        <Source id="vessels" type="geojson" data={vesselData}>
          <Layer
            id="vessel-route"
            type="line"
            filter={["==", ["geometry-type"], "LineString"]}
            paint={{
              "line-color": "#146783",
              "line-width": highlighted ? 8 : 3,
              "line-width-transition": paintTransition,
            }}
          />
          <Layer
            id="vessel-position"
            type="circle"
            filter={["==", ["geometry-type"], "Point"]}
            paint={{
              "circle-color": "#146783",
              "circle-radius": highlighted ? 12 : 7,
              "circle-radius-transition": paintTransition,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": highlighted ? 4 : 1,
              "circle-stroke-width-transition": paintTransition,
            }}
          />
        </Source>
        <Marker
          longitude={vesselPosition[0]}
          latitude={vesselPosition[1]}
          anchor="bottom"
          offset={[0, -14]}
        >
          <MarkerContent
            highlighted={highlighted}
            toggleHighlight={toggleHighlight}
          />
        </Marker>
      </VesselMapView>
      <Controls
        flyToVessel={flyToVessel}
        hitFeatureId={hitFeatureId}
        zoom={zoom}
      />
    </>
  );
};
