import {
  type ComponentType,
  type CSSProperties,
  forwardRef,
  type ReactNode,
  type Ref,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { Adapter, Backend } from "./adapter.js";
import type { MapRef, ViewState } from "./camera-types.js";
import { toWebFlyToOptions, toWebInitialViewState } from "./convert-camera.js";
import { moveEventFromWeb } from "./convert-move-event.js";
import { invokeWrapper } from "./invoke-wrapper.js";
import type { ExternalDrawingContext, MapProps } from "./map-types.js";
import { missingCameraError } from "./missing-camera.js";
import type { LayerProps, SourceProps } from "./source-types.js";
import { useActiveCallback } from "./use-active-callback.js";
import { useFrozenValue } from "./use-frozen-value.js";

interface StyleLoadTarget {
  on: (type: "style.load" | "load" | "idle", listener: () => void) => void;
  off: (type: "style.load" | "load" | "idle", listener: () => void) => void;
  isStyleLoaded: () => boolean;
}

interface WebMapHandle {
  flyTo: (options: {
    center: readonly [number, number];
    duration: number;
  }) => unknown;
  resize: () => unknown;
  getMap: () => StyleLoadTarget;
}

interface WebMoveNotice {
  readonly viewState: ViewState;
  readonly originalEvent?: unknown;
}

interface WebErrorNotice {
  readonly error?: unknown;
}

interface WebMapProps {
  readonly mapStyle: MapProps["mapStyle"];
  readonly initialViewState: ViewState;
  readonly style?: CSSProperties;
  readonly reuseMaps?: boolean;
  readonly gl?: ExternalDrawingContext;
  readonly onMove?: (event: WebMoveNotice) => void;
  readonly onLoad?: () => void;
  readonly onError?: (event: WebErrorNotice) => void;
  readonly onResize?: () => void;
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
    (
      {
        mapStyle,
        initialViewState,
        style,
        onMove,
        onLoad,
        onStyleLoad,
        onError,
        onResize,
        reuseMaps,
        gl,
        children,
      },
      ref
    ) => {
      const mapRef = useRef<WebMapHandle | null>(null);
      const [styleMap, setStyleMap] = useState<StyleLoadTarget | null>(null);
      const frozenViewState = useFrozenValue(initialViewState);
      const reportMove = useActiveCallback(onMove);
      const reportLoad = useActiveCallback(onLoad);
      const reportStyleLoad = useActiveCallback(onStyleLoad);
      const reportError = useActiveCallback(onError);
      const reportResize = useActiveCallback(onResize);
      const reportStyleLoadRef = useRef(reportStyleLoad);
      const setMapHandle = useCallback((handle: WebMapHandle | null) => {
        mapRef.current = handle;
        const next = handle?.getMap() ?? null;

        setStyleMap((current) => (current === next ? current : next));
      }, []);

      useImperativeHandle(ref, () => ({
        flyTo: async (options) => {
          const map = mapRef.current;

          if (!map) {
            throw missingCameraError();
          }

          await invokeWrapper(map.flyTo(toWebFlyToOptions(options)));
        },
        resize: async () => {
          const map = mapRef.current;

          if (!map) {
            throw missingMapError();
          }

          await invokeWrapper(map.resize());
        },
      }));

      useLayoutEffect(() => {
        reportStyleLoadRef.current = reportStyleLoad;
      });

      // style.load is style completion. react-map-gl onStyleData is activity
      // and is not this callback. A fresh map can finish style.load before
      // this commit, while isStyleLoaded() is still false; the map load that
      // follows then reports once. reuse() can fire that load before this
      // listener exists and still leave isStyleLoaded() false, so the next
      // idle reports once when the style is loaded. The listener is
      // facade-owned, so logical unmount removes it even when reuseMaps
      // keeps the renderer.
      useLayoutEffect(() => {
        if (!styleMap) {
          return;
        }

        let sawStyleLoad = false;
        const onStyleLoadEvent = () => {
          sawStyleLoad = true;
          reportStyleLoadRef.current();
        };
        const reportMissedStyleLoad = () => {
          if (sawStyleLoad || !styleMap.isStyleLoaded()) {
            return;
          }

          sawStyleLoad = true;
          reportStyleLoadRef.current();
        };

        styleMap.on("style.load", onStyleLoadEvent);

        if (styleMap.isStyleLoaded()) {
          sawStyleLoad = true;
          reportStyleLoadRef.current();
        } else {
          styleMap.on("load", reportMissedStyleLoad);
          styleMap.on("idle", reportMissedStyleLoad);
        }

        return () => {
          styleMap.off("style.load", onStyleLoadEvent);
          styleMap.off("load", reportMissedStyleLoad);
          styleMap.off("idle", reportMissedStyleLoad);
        };
      }, [styleMap]);

      return (
        <wrapper.Map
          ref={setMapHandle}
          mapStyle={mapStyle}
          initialViewState={toWebInitialViewState(frozenViewState)}
          style={style}
          reuseMaps={reuseMaps}
          gl={gl}
          onLoad={() => {
            reportLoad();
          }}
          onError={(event) => {
            reportError({ error: event.error });
          }}
          onResize={() => {
            reportResize();
          }}
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

/**
 * Error thrown when `resize()` has no web map to measure.
 *
 * @returns An error describing the missing map.
 */
const missingMapError = (): Error => new Error("Map is not attached.");
