import { type Adapter, MapSetup } from "one-map-react";
import { useCallback, useState } from "react";

import { type Tf07Action, type Tf07Probe, Tf07Scene } from "./tf07-scene.js";

declare global {
  interface Window {
    /** Test-only TF07 renderer readback and configuration changes. */
    __oneMapTf07?: Tf07Probe;
  }
}

/** Web acceptance shell opened with `?tf07=ui`. */
export const WebTf07App = ({ adapter }: { readonly adapter: Adapter }) => {
  const [status, setStatus] = useState("TF07 waiting for map");
  const attach = useCallback((probe: Tf07Probe | null) => {
    if (probe) window.__oneMapTf07 = probe;
    else delete window.__oneMapTf07;
  }, []);

  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <div style={{ padding: 8 }}>
          {(["remount", "style", "offset", "popup", "units"] as const).map(
            (action: Tf07Action) => (
              <button
                type="button"
                key={action}
                data-tf07-action={action}
                onClick={() => window.__oneMapTf07?.configure(action)}
              >
                {action}
              </button>
            )
          )}
          <span id="tf07-status">{status}</span>
        </div>
        <div id="tf07-map-host" style={{ flex: 1, position: "relative" }}>
          <Tf07Scene
            style={{ width: "100%", height: "100%" }}
            attach={attach}
            report={(event) => setStatus(`TF07 ${event}`)}
            controlContent={
              <span data-tf07="custom-control">Custom control</span>
            }
            markerContent={(kind, activate) => (
              <div data-tf07={kind} style={{ background: "white", padding: 8 }}>
                <span>{kind === "live" ? "Long press to drag" : kind}</span>
                {kind !== "annotation" && (
                  <button
                    type="button"
                    data-tf07-child={kind}
                    onClick={(event) => {
                      event.stopPropagation();
                      activate();
                    }}
                  >
                    Child button
                  </button>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </MapSetup>
  );
};
