import type { ComponentProps } from "react";

import { emptyStyle, initialViewState, routes } from "./map-fixture.js";
import type { NativeSceneComponents } from "./scene-components.js";

type RouteMapProps = Pick<
  ComponentProps<NativeSceneComponents["Map"]>,
  | "ref"
  | "style"
  | "viewState"
  | "touchZoom"
  | "doubleTapZoom"
  | "onMove"
  | "onMoveEnd"
  | "onClick"
  | "onLoad"
  | "onStyleLoad"
  | "onError"
> & {
  readonly components: Pick<NativeSceneComponents, "Map" | "Source" | "Layer">;
  readonly mapStyle?: ComponentProps<NativeSceneComponents["Map"]>["mapStyle"];
};

/** Seattle route map using the native shell's selected components. */
export const RouteMap = ({
  components: { Map: NativeMap, Source, Layer },
  mapStyle = emptyStyle,
  ...props
}: RouteMapProps) => (
  <NativeMap mapStyle={mapStyle} initialViewState={initialViewState} {...props}>
    <Source id="routes" type="geojson" data={routes}>
      <Layer
        id="route-line"
        type="line"
        paint={{ "line-color": "#2563eb", "line-width": 3 }}
        layout={{ "line-cap": "round" }}
      />
    </Source>
  </NativeMap>
);
