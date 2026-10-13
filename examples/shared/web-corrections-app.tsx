import {
  type Adapter,
  Images,
  Layer,
  type MapProps,
  MapSetup,
  Map as OneMap,
  type Padding,
  Source,
} from "one-map-react";
import { type ReactNode, useLayoutEffect, useState } from "react";

import {
  emptyStyle,
  initialViewState,
} from "../../tests/fixtures/map-fixture.js";

interface WebCorrectionsAppProps {
  readonly adapter: Adapter;
  readonly probe: ReactNode;
}

type CorrectionGestures = Pick<
  MapProps,
  | "interactive"
  | "dragPan"
  | "scrollZoom"
  | "doubleTapZoom"
  | "dragRotate"
  | "boxZoom"
  | "keyboard"
  | "touchZoom"
  | "touchRotate"
  | "touchPitch"
>;

const correctionImageUrl = (name: "owned" | "delayed" | "held"): string => {
  const file = name === "owned" ? "marker.png" : `${name}-marker.png`;

  return `http://127.0.0.1:8798/${file}`;
};

declare global {
  interface Window {
    /** Test-only renderer inspection, outside the production facade API. */
    __oneMapCorrectionRenderer?: object;
  }
}

/** Publishes the selected wrapper's actual renderer for the scoped smoke driver. */
export const useWebCorrectionProbe = (map: object | undefined): void => {
  useLayoutEffect(() => {
    window.__oneMapCorrectionRenderer = map;
    return () => {
      if (window.__oneMapCorrectionRenderer === map)
        delete window.__oneMapCorrectionRenderer;
    };
  }, [map]);
};

/** Controls the TF04 camera and TF05 pending-image correction scenarios. */
export const WebCorrectionsApp = ({
  adapter,
  probe,
}: WebCorrectionsAppProps) => {
  const [padding, setPadding] = useState<Padding | undefined>({ top: 24 });
  const [gestures, setGestures] = useState<CorrectionGestures>({
    touchRotate: false,
    doubleTapZoom: false,
  });
  const [visible, setVisible] = useState(true);
  const [image, setImage] = useState<"none" | "owned" | "delayed" | "held">(
    "none"
  );
  const [heldSource, setHeldSource] = useState(false);
  const [mapStyle, setMapStyle] = useState<string | typeof emptyStyle>(
    emptyStyle
  );
  const [error, setError] = useState("none");
  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <p id="corrections-error">{error}</p>
        <div>
          <button
            id="padding-update"
            type="button"
            onClick={() => setPadding({ top: 64 })}
          >
            Update padding
          </button>
          <button
            id="padding-reset"
            type="button"
            onClick={() => setPadding(undefined)}
          >
            Reset padding
          </button>
          <button
            id="gesture-reset"
            type="button"
            onClick={() => {
              setGestures((current) => ({
                ...current,
                touchRotate: undefined,
                touchZoom: false,
              }));
            }}
          >
            Reset rotation, disable pinch
          </button>
          <button
            id="gesture-enable"
            type="button"
            onClick={() => {
              setGestures((current) => ({
                ...current,
                touchZoom: true,
                doubleTapZoom: true,
              }));
            }}
          >
            Enable zoom gestures
          </button>
          <button
            id="rotation-disable"
            type="button"
            onClick={() =>
              setGestures((current) => ({ ...current, touchRotate: false }))
            }
          >
            Disable rotation
          </button>
          <button
            id="map-toggle"
            type="button"
            onClick={() => {
              if (visible) {
                setGestures((current) => ({
                  ...current,
                  touchRotate: undefined,
                }));
                setImage("none");
                setHeldSource(false);
              }
              setVisible((current) => !current);
            }}
          >
            Unmount or reuse map
          </button>
          <button
            id="image-start"
            type="button"
            onClick={() => setImage("delayed")}
          >
            Load delayed image
          </button>
          <button
            id="style-loading"
            type="button"
            onClick={() =>
              setMapStyle("http://127.0.0.1:8798/delayed-style.json")
            }
          >
            Load delayed style
          </button>
          <button
            id="image-remove"
            type="button"
            onClick={() => setImage("none")}
          >
            Remove delayed image
          </button>
          <button
            id="image-register"
            type="button"
            onClick={() => setImage("owned")}
          >
            Register owned image
          </button>
          <button
            id="image-held"
            type="button"
            onClick={() => setImage("held")}
          >
            Load held image
          </button>
          <button
            id="resource-start"
            type="button"
            onClick={() => setHeldSource(true)}
          >
            Hold source loading
          </button>
          <button
            id="resource-stop"
            type="button"
            onClick={() => setHeldSource(false)}
          >
            Release held source
          </button>
          {([false, true, undefined] as const).map((interactive, index) => (
            <button
              key={String(interactive)}
              id={
                ["interaction-off", "interaction-on", "interaction-clear"][
                  index
                ]
              }
              type="button"
              onClick={() =>
                setGestures((current) => ({ ...current, interactive }))
              }
            >
              {String(interactive)} interaction
            </button>
          ))}
          <button
            id="interaction-individual"
            type="button"
            onClick={() =>
              setGestures((current) => ({
                ...current,
                dragPan: true,
                scrollZoom: true,
                doubleTapZoom: true,
                dragRotate: true,
                boxZoom: true,
                keyboard: true,
                touchZoom: true,
                touchPitch: true,
              }))
            }
          >
            Enable individual gestures
          </button>
          <button
            id="interaction-explicit"
            type="button"
            onClick={() =>
              setGestures((current) => ({
                ...current,
                dragPan: false,
                scrollZoom: false,
                touchZoom: false,
                touchRotate: undefined,
              }))
            }
          >
            Disable pan, scroll, and pinch explicitly
          </button>
          <button
            id="interaction-defaults"
            type="button"
            onClick={() =>
              setGestures((current) => ({ interactive: current.interactive }))
            }
          >
            Clear gesture overrides
          </button>
        </div>
        {visible && (
          <OneMap
            mapStyle={mapStyle}
            initialViewState={initialViewState}
            padding={padding}
            {...gestures}
            reuseMaps
            style={{ width: "100%", height: "100%", flex: 1 }}
            onError={(event) => setError(String(event.error))}
          >
            {probe}
            <Images
              images={
                image !== "none" ? { [image]: correctionImageUrl(image) } : {}
              }
            />
            {heldSource && (
              <Source
                id="held-loading-source"
                type="geojson"
                data="http://127.0.0.1:8798/held-points.geojson"
              >
                <Layer id="held-loading-layer" type="circle" />
              </Source>
            )}
          </OneMap>
        )}
      </div>
    </MapSetup>
  );
};
