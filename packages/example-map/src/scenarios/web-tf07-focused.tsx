import {
  UserLocation,
  type GeolocationPosition,
  MapSetup,
  type Adapter,
  type LngLat,
  type MapRef,
} from "one-map-react";
import { Map as MapboxMap } from "one-map-react/mapbox-web";
import { Map as MaplibreMap } from "one-map-react/maplibre-web";
import {
  type ReactNode,
  type ComponentType,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { NativeLocationButtonProps } from "./native-location-button.js";

type FocusAction = "remove" | "restore" | "theme";
interface FocusRead {
  readonly load: number;
  readonly error: number;
  readonly location: number;
  readonly clicks: number;
  readonly center: LngLat | undefined;
  readonly zoom: number | undefined;
}
declare global {
  interface Window {
    /** Application configuration and actual public-ref observations for the focused UI cases. */
    __tf07Focused?: {
      readonly read: () => Promise<FocusRead>;
      readonly configure: (action: FocusAction) => void;
    };
  }
}
const Theme = createContext("initial");
const style = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#e2e8f0" },
    },
  ],
};
const ThemeChild = ({ activate }: { readonly activate: () => void }) => {
  const theme = useContext(Theme);
  return (
    <button type="button" data-focused-theme onClick={activate}>
      {theme}
    </button>
  );
};

/**
 * Exercises application provider context, fullscreen and selected browser location.
 * @param props - The selected browser adapter.
 * @returns One focused map with configuration-only test actions.
 */
export const WebTf07Focused = ({
  adapter,
  controls,
  renderLocation: Location,
}: {
  readonly adapter: Adapter;
  readonly renderLocation: ComponentType<
    Pick<NativeLocationButtonProps, "onError" | "onGeolocate">
  >;
  readonly controls: ReactNode;
}) => {
  const map = useRef<MapRef>(null);
  const attach = useCallback((instance: MapRef | null) => {
    map.current = instance;
  }, []);
  const SelectedMap =
    adapter.backend === "mapbox-web" ? MapboxMap : MaplibreMap;
  const counts = useRef({
    load: 0,
    error: 0,
    location: 0,
    clicks: 0,
  });
  const [mounted, setMounted] = useState(true);
  const [theme, setTheme] = useState("initial");
  const [displayPosition, setDisplayPosition] = useState<GeolocationPosition>();
  useEffect(() => {
    const probe = {
      configure: (action: FocusAction) => {
        if (action === "remove") setMounted(false);
        else if (action === "restore") setMounted(true);
        else if (action === "theme") setTheme("updated");
        else throw new Error("Unknown focused UI action.");
      },
      read: async () => {
        const [center, zoom] = await Promise.all([
          map.current?.getCenter(),
          map.current?.getZoom(),
        ]);
        return { ...counts.current, center, zoom };
      },
    };
    window.__tf07Focused = probe;
    return () => {
      if (window.__tf07Focused === probe) delete window.__tf07Focused;
    };
  }, []);
  return (
    <>
      <Theme.Provider value={theme}>
        <MapSetup adapter={adapter}>
          <SelectedMap
            ref={attach}
            mapStyle={style}
            initialViewState={{
              longitude: -122.34,
              latitude: 47.61,
              zoom: 11,
              bearing: 0,
              pitch: 0,
            }}
            style={{ width: "100%", height: "100vh" }}
            hostProps={{
              role: "region",
              "aria-label": "Focused acceptance map",
            }}
            onLoad={() => {
              counts.current.load += 1;
            }}
          >
            {controls}
            {mounted && (
              <UserLocation position={displayPosition} showAccuracyCircle />
            )}
            {mounted && (
              <Location
                onError={() => {
                  counts.current.error += 1;
                }}
                onGeolocate={(position) => {
                  setDisplayPosition(position);
                  counts.current.location += 1;
                }}
              />
            )}
          </SelectedMap>
          <div style={{ position: "absolute", bottom: 40, right: 8 }}>
            <ThemeChild
              activate={() => {
                counts.current.clicks += 1;
              }}
            />
          </div>
        </MapSetup>
      </Theme.Provider>
    </>
  );
};
