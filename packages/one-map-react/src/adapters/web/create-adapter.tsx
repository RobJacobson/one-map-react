import type { Adapter, Backend } from "../../contracts/adapter.js";
import type { WebWrapper } from "./contracts.js";
import { createWebImages } from "./images.js";
import { browserLocation } from "./location.js";
import { createWebMap } from "./map.js";
import { createWebSource } from "./sources.js";
import { createWebUi } from "./ui.js";

export type { WebForwardedProps } from "./contracts.js";

/**
 * Builds a web adapter that delegates to a react-map-gl Map, Source, and Layer.
 *
 * @param wrapper - Selected react-map-gl entry components and backend name.
 * @returns An adapter for {@link MapSetup}.
 */
export const createWebAdapter = <
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
>(
  wrapper: WebWrapper<Name>
): Adapter & { readonly backend: Name } => {
  const WebMap = createWebMap(wrapper);
  const WebImages = createWebImages(wrapper);

  return {
    backend: wrapper.backend,
    services: { location: browserLocation },
    Map: WebMap,
    Source: createWebSource(wrapper),
    Layer: wrapper.Layer,
    Images: WebImages,
    ...createWebUi(wrapper),
  };
};
