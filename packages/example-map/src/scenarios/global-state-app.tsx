import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { Map as OneMap, type MapRef } from "react-map-gl/maplibre";

import { captureRendering } from "./capture-web-rendering.js";
import type { Tf09Probe } from "./tf09-scene.js";

const options = {
  reuseMaps: false,
  canvasContextAttributes: { preserveDrawingBuffer: true },
};

/** Exercises style state defaults and renderer-owned style replacement. */
export const GlobalStateApp = () => {
  const map = useRef<MapRef>(null);
  const [revision, setRevision] = useState(0);
  const loads = useRef(0);
  const observedRevision = useRef(-1);
  const styleLoads = useRef(0);
  useEffect(() => {
    const probe: Tf09Probe = {
      command: async (action, value = {}) => {
        if (!map.current) throw new Error("Global-state map is not attached.");
        if (action === "replace-style") {
          setRevision((current) => current + 1);
          return true;
        }
        if (action === "set") {
          const wrapper = map.current;
          wrapper.setGlobalStateProperty(
            "color",
            value.color === null ? null : String(value.color)
          );
          return true;
        }
        if (action === "read") {
          const wrapper = map.current;
          return {
            loads: loads.current,
            styleLoads: styleLoads.current,
            globalState: wrapper.getGlobalState(),
            style: wrapper.getStyle(),
          };
        }
        if (action === "capture")
          return captureRendering("maplibre-web", map.current);
        throw new Error(`Unknown global-state action: ${action}`);
      },
    };
    window.__oneMapTf09 = probe;
    return () => {
      delete window.__oneMapTf09;
    };
  }, []);
  const mapStyle = {
    ...baseStyle,
    name: `global-state-${revision}`,
    state: {
      color: { default: revision ? "#00ffff" : "#ff00ff" },
      initial: { default: 6014 },
    },
  };
  return (
    <OneMap
      ref={map}
      {...options}
      mapStyle={mapStyle}
      initialViewState={{
        longitude: 0,
        latitude: 0,
        zoom: 2,
        bearing: 0,
        pitch: 0,
      }}
      style={{ width: "100vw", height: "100vh" }}
      onLoad={() => {
        loads.current += 1;
      }}
      onIdle={() => {
        if (observedRevision.current === revision) return;
        observedRevision.current = revision;
        styleLoads.current += 1;
      }}
    />
  );
};

const baseStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": ["coalesce", ["global-state", "color"], "#17324d"],
      },
    },
  ],
};
