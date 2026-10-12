import type { ComponentType } from "react";

import type { LayerProps } from "../../contracts/layer-types.js";
import type { WebWrapper } from "./contracts.js";

/**
 * Builds a web Layer component that forwards to a react-map-gl Layer.
 *
 * @param wrapper - Selected react-map-gl entry components.
 * @returns A Layer component for the web adapter record.
 */
export const createWebLayer = (
  wrapper: Pick<WebWrapper<"mapbox-web">, "Layer">
): ComponentType<LayerProps> => {
  const WebLayer = (props: LayerProps) => <wrapper.Layer {...props} />;

  return WebLayer;
};
