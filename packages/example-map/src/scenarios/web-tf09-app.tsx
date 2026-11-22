import { useCallback, useState, type ComponentType, useRef } from "react";

import type { WebBackend, WebSceneComponents } from "./scene-components.js";
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
  components,
  backend,
  renderMedia,
  renderProbe: RenderingProbe,
}: {
  readonly components: WebSceneComponents;
  readonly backend: WebBackend;
  readonly renderMedia: (media: Tf09Media) => import("react").ReactNode;
  readonly renderProbe: ComponentType<{
    readonly attachNamed: (read: (() => unknown) | undefined) => void;
  }>;
}) => {
  const namedRef = useRef<(() => unknown) | undefined>(undefined);
  const attachNamed = useCallback((read: (() => unknown) | undefined) => {
    namedRef.current = read;
  }, []);
  const readNamed = useCallback(() => {
    if (!namedRef.current) throw new Error("The rendering probe is detached.");
    return namedRef.current();
  }, []);
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
    <Tf09Scene
      backend={backend}
      components={components}
      attach={attach}
      named={readNamed}
      style={{ width: "100vw", height: "100vh" }}
    >
      <RenderingProbe attachNamed={attachNamed} />
      <WebTf09Media enabled={media} moved={moved} render={renderMedia} />
    </Tf09Scene>
  );
};
