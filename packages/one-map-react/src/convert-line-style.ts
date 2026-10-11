import type { LineLayout, LinePaint } from "./source-types.js";

/**
 * Converts style-spec line paint and layout into RNMapbox camelCase `style`.
 *
 * @param paint - Style-spec line paint.
 * @param layout - Optional style-spec line layout.
 * @returns RNMapbox `lineColor`, `lineWidth`, and optional `lineCap`.
 */
export const toRnmapboxLineStyle = (paint: LinePaint, layout?: LineLayout) => ({
  lineColor: paint["line-color"],
  lineWidth: paint["line-width"],
  ...(layout?.["line-cap"] === undefined
    ? {}
    : { lineCap: layout["line-cap"] }),
});
