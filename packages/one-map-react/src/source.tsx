import { useSelectedAdapter } from "./map-setup.js";
import type { SourceProps } from "./source-types.js";

/**
 * Shared GeoJSON source that renders the selected adapter's source.
 *
 * @param props - Source id, GeoJSON data, and nested layers.
 */
export const Source = (props: SourceProps) => {
  const { Source: AdapterSource } = useSelectedAdapter();

  return <AdapterSource {...props} />;
};
