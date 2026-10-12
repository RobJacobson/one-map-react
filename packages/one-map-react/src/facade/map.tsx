import { createContext, forwardRef, useContext } from "react";

import type { MapRef } from "../contracts/camera-types.js";
import type { MapProps } from "../contracts/map-types.js";
import { useSelectedAdapter } from "./map-setup.js";

const MapEnclosureContext = createContext(false);

/**
 * Whether the caller is rendering under the shared {@link Map}.
 *
 * @returns `true` when an enclosing Map provided the context.
 */
export const useMapEnclosure = (): boolean => useContext(MapEnclosureContext);

/**
 * Shared map that renders the selected adapter's map.
 */
// Public export name matches the agreed Map component.
// biome-ignore lint/suspicious/noShadowRestrictedNames: public Map API
export const Map = forwardRef<MapRef, MapProps>((props, ref) => {
  const { Map: AdapterMap } = useSelectedAdapter();

  return (
    <MapEnclosureContext.Provider value={true}>
      <AdapterMap {...props} ref={ref} />
    </MapEnclosureContext.Provider>
  );
});
