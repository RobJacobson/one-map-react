import {
  Layer,
  type MapErrorEvent,
  type MapLayoutStyle,
  type MapRef,
  type MapStyle,
  Map as OneMap,
  Source,
} from "one-map-react/legacy";
import { type ReactNode, type Ref } from "react";

import { initialViewState } from "./map-fixture.js";
import { QuerySources } from "./query-sources.js";

interface QueriesMapProps {
  readonly mapStyle: MapStyle;
  readonly sourceRevision: number;
  readonly style?: MapLayoutStyle;
  readonly ref?: Ref<MapRef>;
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
  mapStyle,
  sourceRevision,
  style,
  ref,
  onLoad,
  onStyleLoad,
  onError,
  probe,
}: QueriesMapProps) => (
  <OneMap
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
  </OneMap>
);
