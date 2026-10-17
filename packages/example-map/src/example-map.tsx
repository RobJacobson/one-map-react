import { Map as OneMap, MapSetup, type MapLayoutStyle } from "one-map-react";

import type { useExampleMap } from "./use-example-map.js";

/** Inputs for the shared map rendered by either application shell. */
interface ExampleMapProps {
  /** Engine selection, attachment camera, and callbacks owned by useExampleMap. */
  readonly model: ReturnType<typeof useExampleMap>;
  /** Container dimensions supplied by the web or native application shell. */
  readonly style: MapLayoutStyle;
}

/** Shared basemap; application shells own layout and platform controls. */
export const ExampleMap = ({ model, style }: ExampleMapProps) => (
  <MapSetup key={model.attachment.generation} adapter={model.adapter}>
    <OneMap
      ref={model.attachMap}
      initialViewState={
        // eslint-disable-next-line react/refs -- This is plain React state; the model exposes callbacks rather than mutable refs.
        model.attachment.camera
      }
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      projection="mercator"
      style={style}
      interactive={model.status === "ready"}
      onLoad={() => {
        void model.onLoad();
      }}
      onMove={model.onMove}
      onMoveEnd={model.onMove}
      onError={model.onError}
    />
  </MapSetup>
);
