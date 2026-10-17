import { type Adapter, type MapRef, MapSetup } from "one-map-react";
import { useEffect, useRef } from "react";

import { useCameraSmoke } from "./camera-smoke.js";
import { RouteMap } from "./route-map.js";

interface WebCameraAppProps {
  readonly adapter: Adapter;
}

/**
 * Web example shell for the TF04 camera smoke.
 *
 * @remarks
 * Open `/?tf04=camera`. The page fits the north end of the route, clicks
 * the canvas center, cancels a flight, then tries to jump away from a
 * controlled `viewState`.
 */
export const WebCameraApp = ({ adapter }: WebCameraAppProps) => {
  const mapRef = useRef<MapRef>(null);
  const smoke = useCameraSmoke({
    mapRef,
    platform: "web",
    doubleTap: false,
  });

  useEffect(() => {
    console.log(smoke.status);
  }, [smoke.status]);

  useEffect(() => {
    if (smoke.phase !== "await-click") {
      return;
    }

    const timer = setTimeout(clickCanvasCenter, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [smoke.phase]);

  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <p id="tf04-status" style={{ margin: 0, padding: 8 }}>
          {smoke.status}
        </p>
        <RouteMap
          ref={mapRef}
          style={{ width: "100%", height: "100%", flex: 1 }}
          viewState={smoke.viewState}
          onLoad={smoke.onLoad}
          onMove={smoke.onMove}
          onMoveEnd={smoke.onMoveEnd}
          onClick={smoke.onClick}
        />
      </div>
    </MapSetup>
  );
};

const clickCanvasCenter = () => {
  const canvas = document.querySelector(
    ".mapboxgl-canvas, .maplibregl-canvas, canvas"
  );

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const rectangle = canvas.getBoundingClientRect();
  const clientX = rectangle.left + rectangle.width / 2;
  const clientY = rectangle.top + rectangle.height / 2;
  const position = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  };

  canvas.dispatchEvent(new PointerEvent("pointerdown", position));
  canvas.dispatchEvent(new PointerEvent("pointerup", position));
  canvas.dispatchEvent(new MouseEvent("click", position));
  canvas.parentElement?.dispatchEvent(new MouseEvent("click", position));
};
