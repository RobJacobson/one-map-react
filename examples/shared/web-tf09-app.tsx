import { type Adapter, MapSetup } from "one-map-react";
import type { MapRef } from "one-map-react";
import { useCallback, useState, type ReactNode } from "react";

import { Tf09Scene, type Tf09Probe } from "./tf09-scene.js";
import { WebTf09Media, type Tf09Media } from "./web-tf09-media.js";

declare global {
  interface Window {
    /** Targeted advanced rendering acceptance actions. */
    __oneMapTf09?: Tf09Probe;
  }
}

/** Browser entry selected by ?tf09=rendering. */
export const WebTf09App = ({
  adapter,
  renderMedia,
  probe,
  named,
}: {
  readonly adapter: Adapter;
  readonly renderMedia: (media: Tf09Media) => ReactNode;
  readonly probe: ReactNode;
  readonly named: (map: MapRef) => unknown;
}) => {
  const [media, setMedia] = useState(false);
  const [moved, setMoved] = useState(false);
  const attach = useCallback((probe: Tf09Probe | null) => {
    if (probe)
      window.__oneMapTf09 = {
        command: async (action, value) => {
          if (action === "media") {
            setMedia(value?.enabled === true);
            setMoved(value?.moved === true);
            return true;
          }
          return probe.command(action, value);
        },
      };
    else delete window.__oneMapTf09;
  }, []);
  return (
    <MapSetup adapter={adapter}>
      <Tf09Scene
        backend={adapter.backend}
        attach={attach}
        named={named}
        style={{ width: "100vw", height: "100vh" }}
      >
        {probe}
        <WebTf09Media enabled={media} moved={moved} render={renderMedia} />
      </Tf09Scene>
    </MapSetup>
  );
};
