import type { ComponentType } from "react";

import type { SourceProps } from "../../contracts/source-types.js";
import type { WebWrapper } from "./contracts.js";

/**
 * Builds a web Source component that forwards to a react-map-gl Source.
 *
 * @param wrapper - Selected react-map-gl entry components.
 * @returns A Source component for the web adapter record.
 */
export const createWebSource = (
  wrapper: Pick<WebWrapper<"mapbox-web">, "Source">
): ComponentType<SourceProps> => {
  // Field names already match the web style specification; the conversion
  // copies the readonly `tiles` and `coordinates` arrays the wrapper declares
  // as mutable and drops `children`, which renders separately.
  const toWebSourceProps = (props: SourceProps): Record<string, unknown> => {
    const { children: _children, ...options } = props;
    const spec = { ...options } as Record<string, unknown>;
    delete spec.onClick;
    delete spec.hitbox;

    if (props.type === "image") {
      return {
        ...spec,
        coordinates: [
          [props.coordinates[0][0], props.coordinates[0][1]],
          [props.coordinates[1][0], props.coordinates[1][1]],
          [props.coordinates[2][0], props.coordinates[2][1]],
          [props.coordinates[3][0], props.coordinates[3][1]],
        ],
      };
    }

    if (props.type === "geojson") {
      return spec;
    }

    return {
      ...spec,
      ...(props.tiles === undefined
        ? {}
        : { tiles: props.tiles.map((template) => template) }),
    };
  };

  const WebSource = (props: SourceProps) => (
    <wrapper.Source {...toWebSourceProps(props)}>
      {props.children}
    </wrapper.Source>
  );

  return WebSource;
};
