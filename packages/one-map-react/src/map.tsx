import { forwardRef } from "react";

import type { MapRef } from "./camera-types.js";
import { useSelectedAdapter } from "./map-setup.js";
import type { MapProps } from "./map-types.js";

/**
 * Shared map that renders the selected adapter's map.
 */
// Public export name matches the agreed Map component.
// biome-ignore lint/suspicious/noShadowRestrictedNames: public Map API
export const Map = forwardRef<MapRef, MapProps>((props, ref) => {
  const { Map: AdapterMap } = useSelectedAdapter();

  return <AdapterMap {...props} ref={ref} />;
});
