import type { SourceProps } from "../contracts/source-types.js";
import { useStableOptions } from "./use-stable-options.js";

/**
 * Enforces the stable creation inputs for a mounted source.
 *
 * @param props - Source props from this render.
 * @throws When a creation option changes without remounting the source.
 */
export const useSourceOptions = (props: SourceProps): void => {
  useStableOptions(`Source "${props.id}"`, sourceCreationOptions(props));
};

/**
 * Captures the creation inputs of a source for change detection.
 *
 * Excludes the options that may change between renders (`data` for GeoJSON,
 * `url` and `coordinates` for images) and `children`, so only stable
 * creation options are compared between renders.
 *
 * @param props - Source props from the current render.
 * @returns Options passed to {@link useStableOptions}.
 */
const sourceCreationOptions = (props: SourceProps): Record<string, unknown> => {
  const { children: _children, ...rest } = props;

  if (rest.type === "geojson") {
    const { data: _data, ...creation } = rest;
    return creation;
  }

  if (rest.type === "image") {
    const { url: _url, coordinates: _coordinates, ...creation } = rest;
    return creation;
  }

  return rest;
};
