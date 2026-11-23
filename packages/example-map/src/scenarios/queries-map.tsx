import type { MapErrorEvent, MapLayoutStyle, MapStyle } from "one-map-react";
import { type ReactNode, type RefCallback } from "react";

import { initialViewState } from "./map-fixture.js";
import { QuerySources } from "./query-sources.js";
import type {
  NativeSceneComponents,
  NativeSceneMap,
} from "./scene-components.js";

interface QueriesMapProps {
  readonly components: Pick<NativeSceneComponents, "Map" | "Source" | "Layer">;
  readonly mapStyle: MapStyle;
  readonly sourceRevision: number;
  readonly style?: MapLayoutStyle;
  readonly ref?: RefCallback<NativeSceneMap>;
  readonly onLoad?: () => void;
  readonly onStyleLoad?: () => void;
  readonly onError?: (event: MapErrorEvent) => void;
  readonly probe?: ReactNode;
}

/**
 * Shared TF06 scene: numeric-id routes under a feature-state paint
 * expression plus a clustered points source. Numeric route ids survive
 * the SDKs' tile encoding and support independent known-feature assertions.
 */
export const QueriesMap = ({
  components: { Map: NativeMap, Source, Layer },
  mapStyle,
  sourceRevision,
  style,
  ref,
  onLoad,
  onStyleLoad,
  onError,
  probe,
}: QueriesMapProps) => (
  <NativeMap
    ref={ref}
    mapStyle={mapStyle}
    initialViewState={initialViewState}
    style={style}
    onLoad={onLoad}
    onStyleLoad={onStyleLoad}
    onError={onError}
  >
    {probe}
    <QuerySources
      Source={Source}
      Layer={Layer}
      sourceRevision={sourceRevision}
    />
  </NativeMap>
);
