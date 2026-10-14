import type { ClickEvent } from "../../contracts/event-types.js";
import { lngLatFromWrapper, pointFromWrapper } from "./wrapper-values.js";

/** Copies RNMapbox source activation fields into portable hit geometry. */
export const sourceHitFromMapbox = (event: {
  readonly coordinates: {
    readonly longitude: number;
    readonly latitude: number;
  };
  readonly point: { readonly x: number; readonly y: number };
  readonly features: readonly object[];
}): ClickEvent => ({
  lngLat: lngLatFromWrapper([
    event.coordinates.longitude,
    event.coordinates.latitude,
  ]),
  point: pointFromWrapper(event.point),
  features: event.features,
});

/** Copies MapLibre native source activation without retaining mutable tuple aliases. */
export const sourceHitFromMaplibre = (event: {
  readonly lngLat: unknown;
  readonly point: unknown;
  readonly features: readonly object[];
}): ClickEvent => ({
  lngLat: lngLatFromWrapper(event.lngLat),
  point: pointFromWrapper(event.point),
  features: event.features,
});
