import type { ViewState } from "../../packages/one-map-react/src/camera-types.js";
import type { GeoJsonFeatureCollection } from "../../packages/one-map-react/src/source-types.js";
import type { StyleDocument } from "../../packages/one-map-react/src/style-types.js";
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
  readonly features: readonly object[];
}): GeoJsonFeatureCollection => {
  if (data.type !== "FeatureCollection") {
    throw new Error("Fixture routes must be a FeatureCollection.");
  }

  return {
    type: "FeatureCollection",
    features: data.features,
  };
};

/** Local empty style from `map.json`, checked as a style document. */
export const emptyStyle = styleDocument(fixture.emptyStyle);

/** Seattle camera from `map.json`. */
export const initialViewState: ViewState = fixture.initialViewState;

/** Route FeatureCollection from `map.json`. */
export const routes = featureCollection(fixture.routes);
