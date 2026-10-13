import type { ViewState } from "../../packages/one-map-react/src/contracts/camera-types.js";
import type { GeoJsonFeatureCollection } from "../../packages/one-map-react/src/contracts/source-types.js";
import type { StyleDocument } from "../../packages/one-map-react/src/contracts/style-types.js";
import fixture from "./map.json" with { type: "json" };

// These readers run while the module loads, so they stay above the exports.
const styleDocument = (style: {
  readonly version: number;
  readonly sources: object;
  readonly layers: readonly object[];
}): StyleDocument => {
  if (style.version !== 8) {
    throw new Error("Fixture style version must be 8.");
  }

  return {
    version: 8,
    sources: style.sources,
    layers: style.layers,
  };
};

const featureCollection = (data: {
  readonly type: string;
  readonly features: readonly { readonly type: string }[];
}): GeoJsonFeatureCollection => {
  if (data.type !== "FeatureCollection") {
    throw new Error("Fixture routes must be a FeatureCollection.");
  }

  for (const feature of data.features) {
    if (feature.type !== "Feature") {
      throw new Error("Fixture route entries must be Features.");
    }
  }

  // JSON imports widen string literals; the checks above pin the shape.
  return data as GeoJsonFeatureCollection;
};

/** Local empty style from `map.json`, checked as a style document. */
export const emptyStyle = styleDocument(fixture.emptyStyle);

/** Replacement style from `map.json`, checked as a style document. */
export const replacementStyle = styleDocument(fixture.replacementStyle);

/** Empty style for the TF06 queries scene from `map.json`. */
export const queriesStyle = styleDocument(fixture.queriesStyle);

/** Seattle camera from `map.json`. */
export const initialViewState: ViewState = fixture.initialViewState;

/** Route FeatureCollection from `map.json`. */
export const routes = featureCollection(fixture.routes);

/**
 * TF06 routes with numeric tile ids: north 1, south 2, and off-screen 3.
 * Numeric ids survive the pinned SDKs' GeoJSON-to-vector-tile conversion.
 */
export const queryRoutes: GeoJsonFeatureCollection = {
  ...routes,
  features: routes.features.map((feature, index) => ({
    ...feature,
    id: index + 1,
  })),
};

/** Point FeatureCollection from `map.json` with a `label` property. */
export const markers = featureCollection(fixture.markers);

/** Numeric-id points from `map.json` dense enough to cluster at zoom 11. */
export const clusteredPoints = featureCollection(fixture.clusteredPoints);
