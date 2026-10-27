import type { SourceProps } from "../contracts/source-types.js";
import { useSelectedAdapter } from "./map-setup.js";
import { useStableOptions } from "./use-stable-options.js";

/**
 * Shared source that renders the selected adapter's source component.
 *
 * Source creation inputs are stable for the component's lifetime; changing
 * one throws and requires remounting with a new React `key`.
 *
 * @param props - Source family, id, options, and nested layers.
 */
export const Source = (props: SourceProps) => {
  const { Source: AdapterSource } = useSelectedAdapter();

  useStableOptions(`Source "${props.id}"`, sourceCreationOptions(props));

  return <AdapterSource {...props} />;
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
  const { children: _children, ...options } = props;
  const rest = { ...options };

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
