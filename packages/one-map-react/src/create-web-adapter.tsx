import {
  type ComponentType,
  type CSSProperties,
  forwardRef,
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useRef,
} from "react";

import type { Adapter, Backend } from "./adapter.js";
import type { MapRef, ViewState } from "./camera-types.js";
import { toWebFlyToOptions, toWebInitialViewState } from "./convert-camera.js";
import { moveEventFromWeb } from "./convert-move-event.js";
import { invokeWrapper } from "./invoke-wrapper.js";
import type { MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

interface WebMapHandle {
  flyTo: (options: {
    center: readonly [number, number];
    duration: number;
  }) => unknown;
}

interface WebMoveNotice {
  readonly viewState: ViewState;
  readonly originalEvent?: unknown;
}

interface WebMapProps {
  readonly mapStyle: MapProps["mapStyle"];
  readonly initialViewState: ViewState;
  readonly style?: CSSProperties;
  readonly onMove?: (event: WebMoveNotice) => void;
  readonly children?: ReactNode;
  readonly ref?: Ref<WebMapHandle>;
}

interface WebSourceProps {
  readonly id: string;
  readonly type: "geojson";
  readonly data: SourceProps["data"];
  readonly children?: ReactNode;
}

interface WebLayerProps {
  readonly id: string;
  readonly type: "line";
  readonly source?: string;
  readonly paint: LayerProps["paint"];
  readonly layout?: LayerProps["layout"];
}

interface WebWrapper<
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
> {
  readonly backend: Name;
  readonly Map: ComponentType<WebMapProps>;
  readonly Source: ComponentType<WebSourceProps>;
  readonly Layer: ComponentType<WebLayerProps>;
}

/**
 * Builds a web adapter that delegates to a react-map-gl Map, Source, and Layer.
 *
 * @param wrapper - Selected react-map-gl entry components and backend name.
 * @returns An adapter for {@link MapSetup}.
 */
export const createWebAdapter = <
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
>(
  wrapper: WebWrapper<Name>
): Adapter & { readonly backend: Name } => {
  const WebMap = forwardRef<MapRef, MapProps>(
    ({ mapStyle, initialViewState, style, onMove, children }, ref) => {
      const mapRef = useRef<WebMapHandle>(null);
      const frozenViewState = useFrozenValue(initialViewState);
      const reportMove = useActiveCallback(onMove);

      useImperativeHandle(ref, () => ({
        flyTo: async (options) => {
          const map = mapRef.current;

          if (!map) {
            throw missingCameraError();
          }

          await invokeWrapper(map.flyTo(toWebFlyToOptions(options)));
        },
      }));

      return (
        <wrapper.Map
          ref={mapRef}
          mapStyle={mapStyle}
          initialViewState={toWebInitialViewState(frozenViewState)}
          style={style}
          onMove={(event) => {
            reportMove(moveEventFromWeb(event.viewState, event.originalEvent));
          }}
        >
          {children}
        </wrapper.Map>
      );
    }
  );

  const WebSource = ({ id, data, children }: SourceProps) => (
    <wrapper.Source id={id} type="geojson" data={data}>
      {children}
    </wrapper.Source>
  );

  const WebLayer = ({ id, paint, layout, source }: LayerProps) => (
    <wrapper.Layer
      id={id}
      type="line"
      source={source}
      paint={paint}
      layout={layout}
    />
  );

  return {
    backend: wrapper.backend,
    Map: WebMap,
    Source: WebSource,
    Layer: WebLayer,
  };
};
