import { type Adapter, MapSetup } from "one-map-react";
import { type ComponentProps, useCallback, useMemo } from "react";

import {
  type Tf08AcceptanceProbe,
  Tf08AcceptanceScene,
} from "./tf08-acceptance-scene.js";

declare global {
  interface Window {
    /** TF08 application actions and renderer readback for browser acceptance. */
    __oneMapTf08?: Tf08AcceptanceProbe;
  }
}

/** Browser TF08 acceptance shell, selected with ?tf08=services. */
export const WebTf08App = ({
  adapter,
  navigationControl,
  renderCoveragePopup,
}: {
  readonly adapter: Adapter;
  readonly navigationControl: ComponentProps<
    typeof Tf08AcceptanceScene
  >["navigationControl"];
  readonly renderCoveragePopup: ComponentProps<
    typeof Tf08AcceptanceScene
  >["renderCoveragePopup"];
}) => {
  const attach = useCallback((probe: Tf08AcceptanceProbe | null) => {
    if (probe) window.__oneMapTf08 = probe;
    else delete window.__oneMapTf08;
  }, []);
  const externalContext = useMemo(
    () =>
      document
        .createElement("canvas")
        .getContext("webgl2", { preserveDrawingBuffer: false }),
    []
  );
  return (
    <MapSetup adapter={adapter}>
      <div id="tf08-map-host" style={{ width: "100vw", height: "100vh" }}>
        <Tf08AcceptanceScene
          navigationControl={navigationControl}
          renderCoveragePopup={renderCoveragePopup}
          backend={adapter.backend}
          services={adapter.services}
          style={{ width: "100%", height: "100%" }}
          attach={attach}
          fixtureUrl="http://127.0.0.1:8798"
          externalContext={externalContext ?? undefined}
          overlay={
            <div
              style={{ width: 40, height: 40, backgroundColor: "#00ff00" }}
            />
          }
        />
      </div>
    </MapSetup>
  );
};
