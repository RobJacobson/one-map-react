import { useSelectedAdapter } from "./map-setup.js";
import type { LayerProps } from "./source-types.js";

/**
 * Shared line layer that renders the selected adapter's layer.
 *
 * Remains the direct child of the wrapper source so injected `source` or
 * `sourceID` reaches the wrapper layer.
 *
 * @param props - Layer id, line style, and any parent-injected source id.
 */
export const Layer = (props: LayerProps) => {
  const { Layer: AdapterLayer } = useSelectedAdapter();

  return <AdapterLayer {...props} />;
};
