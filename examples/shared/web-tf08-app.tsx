import { type Adapter, MapSetup } from "one-map-react";
import { type ComponentProps, useCallback, useMemo } from "react";

import { acquireLocation, locationPosition } from "./location-acquisition.js";
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
  renderLocation,
  navigationControl,
  ornamentControls,
  renderCoveragePopup,
}: {
  readonly adapter: Adapter;
  readonly renderLocation: ComponentProps<
    typeof Tf08AcceptanceScene
  >["renderLocation"];
  readonly ornamentControls: ComponentProps<
    typeof Tf08AcceptanceScene
  >["ornamentControls"];
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
          renderLocation={renderLocation}
          navigationControl={navigationControl}
          ornamentControls={ornamentControls}
          renderCoveragePopup={renderCoveragePopup}
          backend={adapter.backend}
          requestLocationPermission={requestLocationPermission}
          getCurrentPosition={getCurrentPosition}
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

const getCurrentPosition = (signal?: AbortSignal, timeoutMs?: number) =>
  acquireLocation(
    (success, failure) => {
      const geolocation = globalThis.navigator?.geolocation;
      if (!geolocation) throw new Error("Browser geolocation is unavailable.");
      const id = geolocation.watchPosition(
        (position) => {
          try {
            success(locationPosition(position, "browser"));
          } catch (error) {
            failure(error);
          }
        },
        failure,
        { maximumAge: 0 }
      );
      return () => geolocation.clearWatch(id);
    },
    signal,
    timeoutMs
  );

const requestLocationPermission = async (signal?: AbortSignal) => {
  try {
    await getCurrentPosition(signal);
    return { status: "granted", accuracy: "unknown" };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 1
    )
      return { status: "denied", accuracy: "unknown" };
    throw error;
  }
};
