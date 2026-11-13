import { Map as OneMap, type MapLayoutStyle, type MapRef } from "one-map-react";
import {
  CustomLocationProvider,
  LocationPuck,
} from "one-map-react/mapbox-native";
import { useEffect, useRef, useState } from "react";

import { captureRendering } from "./capture-rendering.js";
import type { Tf09Probe } from "./tf09-scene.js";

const presets = {
  hidden: undefined,
  visible: {
    uri: "http://127.0.0.1:8798/model-magenta.glb",
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    opacity: 1,
  },
  scaled: {
    uri: "http://127.0.0.1:8798/model-magenta.glb",
    scale: [2, 2, 2],
    rotation: [0, 0, 0],
    opacity: 1,
  },
  rotated: {
    uri: "http://127.0.0.1:8798/model-magenta.glb",
    scale: [2, 2, 2],
    rotation: [0, 0, 90],
    opacity: 1,
  },
  transparent: {
    uri: "http://127.0.0.1:8798/model-magenta.glb",
    scale: [2, 2, 2],
    rotation: [0, 0, 90],
    opacity: 0,
  },
  replaced: {
    uri: "http://127.0.0.1:8798/model-cyan.glb",
    scale: [2, 2, 2],
    rotation: [0, 0, 90],
    opacity: 1,
  },
};

/** Selected model fixture for RNMapbox 10.3.8; not applicable to 10.3.7. */
export const NativeModelScene = ({
  attach,
  style,
}: {
  readonly backend: string;
  readonly style: MapLayoutStyle;
  readonly attach: (probe: Tf09Probe | null) => void;
}) => {
  const map = useRef<MapRef>(null);
  const loads = useRef(0);
  const [preset, setPreset] = useState<keyof typeof presets>("hidden");
  const committed = useRef(preset);
  useEffect(() => {
    committed.current = preset;
  }, [preset]);
  useEffect(() => {
    attach({
      command: async (action, value = {}) => {
        if (action === "model") {
          const name = value.preset;
          if (typeof name !== "string" || !Object.hasOwn(presets, name))
            throw new Error("Unknown model preset.");
          setPreset(name as keyof typeof presets);
          return true;
        }
        if (!map.current) throw new Error("Model map is not attached.");
        if (action === "capture")
          return captureRendering("mapbox-native", map.current);
        if (action === "read")
          return {
            loads: loads.current,
            preset: committed.current,
            center: await map.current.getCenter(),
            zoom: await map.current.getZoom(),
          };
        throw new Error(`Unknown model action: ${action}`);
      },
    });
    return () => attach(null);
  }, [attach]);
  return (
    <OneMap
      ref={map}
      mapStyle={{
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#17324d" },
          },
        ],
      }}
      initialViewState={{
        longitude: 0,
        latitude: 0,
        zoom: 18,
        pitch: 0,
        bearing: 0,
      }}
      style={style}
      onLoad={() => {
        loads.current += 1;
      }}
    >
      <CustomLocationProvider coordinate={[0, 0]} />
      <LocationPuck
        visible={preset !== "hidden"}
        puckBearingEnabled={false}
        model={presets[preset]}
      />
    </OneMap>
  );
};
