import type { ComponentProps } from "react";

import { emptyStyle, initialViewState, routes } from "./map-fixture.js";
import type { WebSceneComponents } from "./scene-components.js";

/** Route fixture drawn with the selected upstream browser components. */
export const WebRouteMap = ({
  components: { Map: MapView, Source, Layer },
  ...props
}: Omit<
  ComponentProps<WebSceneComponents["Map"]>,
  "mapStyle" | "initialViewState"
> & {
  readonly components: WebSceneComponents;
}) => (
  <MapView mapStyle={emptyStyle} initialViewState={initialViewState} {...props}>
    <Source id="routes" type="geojson" data={routes}>
      <Layer
        id="route-line"
        type="line"
        paint={{ "line-color": "#2563eb", "line-width": 3 }}
        layout={{ "line-cap": "round" }}
      />
    </Source>
  </MapView>
);
