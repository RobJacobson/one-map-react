import type { StyleSpecification } from "maplibre-gl";
import { MapSetup } from "one-map-react";
import {
  adapter,
  Map as OneMap,
  type WebMapRef,
} from "one-map-react/maplibre-web";
import { useEffect, useRef, useState } from "react";

import { captureRendering } from "./capture-rendering.js";
import type { Tf09Probe } from "./tf09-scene.js";

const options = {
  reuseMaps: false,
  canvasContextAttributes: { preserveDrawingBuffer: true },
};

/** Exercises style state defaults and renderer-owned style replacement. */
export const GlobalStateApp = () => {
  const map = useRef<WebMapRef>(null);
  const [revision, setRevision] = useState(0);
  const loads = useRef(0);
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
          const wrapper = await map.current.getWrapperMap();
          wrapper.setGlobalStateProperty(
            "color",
            value.color === null ? null : String(value.color)
          );
          return true;
        }
        if (action === "read") {
          const wrapper = await map.current.getWrapperMap();
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
    <MapSetup adapter={adapter}>
      <OneMap
        ref={map}
        options={options}
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
        onStyleLoad={() => {
          styleLoads.current += 1;
        }}
      />
    </MapSetup>
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
