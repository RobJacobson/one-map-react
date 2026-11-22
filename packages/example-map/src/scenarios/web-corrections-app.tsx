import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { emptyStyle, initialViewState } from "./map-fixture.js";
import type { WebSceneComponents, WebSceneMap } from "./scene-components.js";
import { useWebStyleImage } from "./web-style-image.js";

interface WebCorrectionsAppProps {
  readonly components: WebSceneComponents;
  readonly probe: ReactNode;
}

interface CorrectionGestures {
  readonly interactive?: boolean;
  readonly dragPan?: boolean;
  readonly scrollZoom?: boolean;
  readonly doubleTapZoom?: boolean;
  readonly dragRotate?: boolean;
  readonly boxZoom?: boolean;
  readonly keyboard?: boolean;
  readonly touchZoom?: boolean;
  readonly touchRotate?: boolean;
  readonly touchPitch?: boolean;
}

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
  components: { Map: MapView, Source, Layer },
  probe,
}: WebCorrectionsAppProps) => {
  const [padding, setPadding] = useState(24);
  const [gestures, setGestures] = useState<CorrectionGestures>({
    touchRotate: false,
    doubleTapZoom: false,
  });
  const [visible, setVisible] = useState(true);
  const [image, setImage] = useState<"none" | "owned" | "delayed" | "held">(
    "none"
  );
  const [heldSource, setHeldSource] = useState(false);
  const [error, setError] = useState("none");
  const [loadedMap, setLoadedMap] = useState<WebSceneMap | null>(null);
  const mapRef = useRef<WebSceneMap | null>(null);
  const attachMap = useCallback((instance: WebSceneMap | null) => {
    mapRef.current = instance;
  }, []);
  const onImageError = useCallback(
    (error: unknown) => setError(String(error)),
    []
  );
  useEffect(() => {
    if (!visible || !loadedMap || gestures.touchRotate !== false) return;
    const rotation = loadedMap.getMap().touchZoomRotate;
    rotation.disableRotation();
    return () => rotation.enableRotation();
  }, [gestures.touchRotate, loadedMap, visible]);
  useWebStyleImage(
    visible ? loadedMap : null,
    image === "none" ? undefined : image,
    image === "none" ? undefined : correctionImageUrl(image),
    onImageError
  );
  const enabled = gestures.interactive !== false;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <p id="corrections-error">{error}</p>
      <div>
        <button
          id="padding-update"
          type="button"
          onClick={() => setPadding(64)}
        >
          Update padding
        </button>
        <button id="padding-reset" type="button" onClick={() => setPadding(0)}>
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
              setLoadedMap(null);
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
        <button id="image-held" type="button" onClick={() => setImage("held")}>
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
              ["interaction-off", "interaction-on", "interaction-clear"][index]
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
        <MapView
          ref={attachMap}
          mapStyle={emptyStyle}
          initialViewState={initialViewState}
          padding={{ top: padding, right: 0, bottom: 0, left: 0 }}
          dragPan={enabled && (gestures.dragPan ?? true)}
          scrollZoom={enabled && (gestures.scrollZoom ?? true)}
          doubleClickZoom={enabled && (gestures.doubleTapZoom ?? true)}
          dragRotate={enabled && (gestures.dragRotate ?? true)}
          boxZoom={enabled && (gestures.boxZoom ?? true)}
          keyboard={enabled && (gestures.keyboard ?? true)}
          touchPitch={enabled && (gestures.touchPitch ?? true)}
          touchZoomRotate={enabled && (gestures.touchZoom ?? true)}
          onIdle={() => setLoadedMap(mapRef.current)}
          reuseMaps
          style={{ width: "100%", height: "100%", flex: 1 }}
          onError={(event) => setError(String(event.error))}
        >
          {probe}
          {heldSource && (
            <Source
              id="held-loading-source"
              type="geojson"
              data="http://127.0.0.1:8798/held-points.geojson"
            >
              <Layer id="held-loading-layer" type="circle" />
            </Source>
          )}
        </MapView>
      )}
    </div>
  );
};
