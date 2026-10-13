import { jest } from "@jest/globals";
import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from "react";

interface PooledMap {
  readonly id: string;
  readonly contextWidth: string;
  readonly styleTarget: StyleLoadTarget;
}

interface MapHandle {
  flyTo: () => unknown;
  jumpTo: () => unknown;
  easeTo: () => unknown;
  fitBounds: () => unknown;
  zoomTo: () => unknown;
  stop: () => unknown;
  resize: () => unknown;
  getCenter: () => unknown;
  getZoom: () => unknown;
  getBearing: () => unknown;
  getPitch: () => unknown;
  getPadding: () => unknown;
  getBounds: () => unknown;
  getMinZoom: () => unknown;
  getMaxZoom: () => unknown;
  getMaxBounds: () => unknown;
  project: () => unknown;
  unproject: () => unknown;
  queryRenderedFeatures: (geometry?: unknown, options?: object) => unknown;
  querySourceFeatures: (sourceId: string, params?: object) => unknown;
  getSource: (id: string) => unknown;
  getLayer: (id: string) => unknown;
  setFeatureState: (target: object, state: object) => unknown;
  getFeatureState: (target: object) => unknown;
  removeFeatureState: (target: object, key?: string) => unknown;
  getMap: () => StyleLoadTarget;
}

/** Cluster methods the mock GeoJSON source exposes. */
export interface ClusterSourceMock {
  readonly getClusterExpansionZoom: jest.Mock<
    (
      clusterId: number,
      callback?: (error: unknown, zoom: number) => void
    ) => unknown
  >;
  readonly getClusterChildren: jest.Mock<
    (
      clusterId: number,
      callback?: (error: unknown, features: readonly object[]) => void
    ) => unknown
  >;
  readonly getClusterLeaves: jest.Mock<
    (
      clusterId: number,
      limit: number,
      offset: number,
      callback?: (error: unknown, features: readonly object[]) => void
    ) => unknown
  >;
}

/** Mutable handler names updated by the pinned react-map-gl entries. */
export const webHandlerNames = [
  "dragPan",
  "scrollZoom",
  "doubleClickZoom",
  "dragRotate",
  "boxZoom",
  "keyboard",
  "touchZoomRotate",
  "touchPitch",
] as const;

type WebHandlerName = (typeof webHandlerNames)[number];
type ErrorNotice = { readonly error?: unknown };
type HandlerProps = Partial<Record<WebHandlerName, boolean>>;

export interface StyleLoadTarget {
  on: (type: string, listener: (event: ErrorNotice) => void) => void;
  off: (type: string, listener: (event: ErrorNotice) => void) => void;
  emitStyleLoad: () => void;
  emitLoad: () => void;
  emitIdle: () => void;
  emitStyleData: () => void;
  emitError: (error: unknown) => void;
  clearImages: () => void;
  hasImage: (name: string) => boolean;
  addImage: jest.Mock<
    (name: string, image: unknown, options?: { sdf?: boolean }) => void
  >;
  removeImage: jest.Mock<(name: string) => void>;
  loadImage: jest.Mock<
    (
      url: string,
      callback?: (error: unknown, image?: unknown) => void
    ) => unknown
  >;
  listenerCount: (type?: string) => number;
  handlers: Record<WebHandlerName, { isEnabled: () => boolean }>;
  applyHandlerProps: (props: HandlerProps) => void;
  isStyleLoaded: () => boolean;
  touchZoomRotate: {
    disableRotation: () => void;
    enableRotation: () => void;
  };
}

interface WebMapMockProps extends HandlerProps {
  readonly children?: ReactNode;
  readonly ref?: Ref<MapHandle>;
  readonly reuseMaps?: boolean;
  readonly gl?: { readonly drawingBufferWidth: number };
  readonly onError?: (event: ErrorNotice) => void;
}

/**
 * Builds a react-map-gl Map mock with a one-slot reuse pool.
 *
 * A remount with `reuseMaps` keeps the previous map id, the drawing-context
 * width captured at construction, and the style target. A later `gl` prop is
 * forwarded and does not replace that width. `isStyleLoaded()` stays with the
 * retained target.
 *
 * @returns The mocked Map, Source, and Layer plus pool controls.
 */
export const createWebMapMock = () => {
  const flyTo = jest.fn(() => ({ id: "map" }));
  const jumpTo = jest.fn();
  const easeTo = jest.fn();
  const fitBounds = jest.fn();
  const zoomTo = jest.fn();
  const stop = jest.fn();
  const resize = jest.fn();
  const getCenter = jest.fn(() => ({ lng: -122.34, lat: 47.61 }));
  const getZoom = jest.fn(() => 11);
  const getBearing = jest.fn(() => 4);
  const getPitch = jest.fn(() => 1);
  const getPadding = jest.fn(() => ({
    top: 1,
    right: 2,
    bottom: 3,
    left: 4,
  }));
  const getBounds = jest.fn(() => ({
    getWest: () => 170,
    getSouth: () => -10,
    getEast: () => -170,
    getNorth: () => 10,
  }));
  const getMinZoom = jest.fn(() => 2);
  const getMaxZoom = jest.fn(() => 18);
  const getMaxBounds = jest.fn(() => null);
  const project = jest.fn(() => ({ x: 12, y: 34 }));
  const unproject = jest.fn(() => ({ lng: -122.34, lat: 47.61 }));
  const queriedFeatures = [
    { type: "Feature", id: 1, properties: { kind: "route" } },
    { type: "Feature", id: 1, properties: { kind: "route" } },
  ];
  const queryRenderedFeatures = jest.fn(() => queriedFeatures);
  const querySourceFeatures = jest.fn(() => queriedFeatures.slice(0, 1));
  const clusterSource: ClusterSourceMock = {
    // Mapbox GL reports through a trailing callback; call it so the
    // mapbox-web adapter's promise resolves.
    getClusterExpansionZoom: jest.fn(
      (
        _clusterId: number,
        callback?: (error: unknown, zoom: number) => void
      ) => {
        callback?.(null, 13);

        return undefined;
      }
    ),
    getClusterChildren: jest.fn(
      (
        _clusterId: number,
        callback?: (error: unknown, features: readonly object[]) => void
      ) => {
        callback?.(null, [{ type: "Feature", id: 11 }]);

        return undefined;
      }
    ),
    getClusterLeaves: jest.fn(
      (
        _clusterId: number,
        _limit: number,
        _offset: number,
        callback?: (error: unknown, features: readonly object[]) => void
      ) => {
        callback?.(null, [
          { type: "Feature", id: 21 },
          { type: "Feature", id: 22 },
        ]);

        return undefined;
      }
    ),
  };
  const sources = new Map<string, unknown>();
  const getSource = jest.fn((id: string) => sources.get(id));
  const layers = new Map<string, object>();
  const getLayer = jest.fn((id: string) => layers.get(id));
  const setFeatureState = jest.fn();
  const featureState = new Map<string, Record<string, unknown>>();
  const getFeatureState = jest.fn(
    (target: { source?: string; id?: string | number }) => {
      const key = `${target?.source}/${target?.id}`;

      return featureState.get(key) ?? {};
    }
  );
  const removeFeatureState = jest.fn(
    (target: { source?: string; id?: string | number }, key?: string) => {
      const stateKey = `${target?.source}/${target?.id}`;
      const current = featureState.get(stateKey);

      if (!current) {
        return;
      }

      if (key === undefined) {
        featureState.delete(stateKey);
        return;
      }

      delete current[key];
    }
  );
  const disableRotation = jest.fn();
  const enableRotation = jest.fn();
  let saved: PooledMap | null = null;
  let serial = 0;
  let currentStyleTarget: StyleLoadTarget | null = null;

  const resetWebMapMock = (): void => {
    saved = null;
    serial = 0;
    currentStyleTarget = null;
    flyTo.mockClear();
    jumpTo.mockClear();
    easeTo.mockClear();
    fitBounds.mockClear();
    zoomTo.mockClear();
    stop.mockClear();
    resize.mockClear();
    getCenter.mockClear();
    getZoom.mockClear();
    getBearing.mockClear();
    getPitch.mockClear();
    getPadding.mockClear();
    getBounds.mockClear();
    getMinZoom.mockClear();
    getMaxZoom.mockClear();
    getMaxBounds.mockClear();
    project.mockClear();
    unproject.mockClear();
    queryRenderedFeatures.mockClear();
    querySourceFeatures.mockClear();
    clusterSource.getClusterExpansionZoom.mockClear();
    clusterSource.getClusterChildren.mockClear();
    clusterSource.getClusterLeaves.mockClear();
    sources.clear();
    getSource.mockClear();
    layers.clear();
    getLayer.mockClear();
    setFeatureState.mockClear();
    featureState.clear();
    getFeatureState.mockClear();
    removeFeatureState.mockClear();
    disableRotation.mockClear();
    enableRotation.mockClear();
    Source.mockClear();
    Layer.mockClear();
  };

  const WrapperMap = jest.fn(
    ({
      children,
      ref,
      reuseMaps,
      gl,
      onError,
      ...handlerProps
    }: WebMapMockProps) => {
      const [record] = useState(() => {
        if (reuseMaps && saved) {
          const reused = saved;
          saved = null;

          return { ...reused, constructed: false };
        }

        serial += 1;

        return {
          id: String(serial),
          contextWidth: gl === undefined ? "" : String(gl.drawingBufferWidth),
          styleTarget: createStyleTarget({
            disableRotation,
            enableRotation,
          }),
          constructed: true,
        };
      });

      currentStyleTarget = record.styleTarget;

      useLayoutEffect(() => {
        record.styleTarget.applyHandlerProps(handlerProps);
      });

      useLayoutEffect(() => {
        if (!onError) return;
        record.styleTarget.on("error", onError);
        return () => record.styleTarget.off("error", onError);
      }, [record.styleTarget, onError]);

      useEffect(
        () => () => {
          if (reuseMaps) {
            saved = {
              id: record.id,
              contextWidth: record.contextWidth,
              styleTarget: record.styleTarget,
            };
          }
        },
        [record.contextWidth, record.id, record.styleTarget, reuseMaps]
      );

      useImperativeHandle(
        ref,
        () => ({
          flyTo,
          jumpTo,
          easeTo,
          fitBounds,
          zoomTo,
          stop,
          resize,
          getCenter,
          getZoom,
          getBearing,
          getPitch,
          getPadding,
          getBounds,
          getMinZoom,
          getMaxZoom,
          getMaxBounds,
          project,
          unproject,
          queryRenderedFeatures,
          querySourceFeatures,
          getSource,
          getLayer,
          setFeatureState,
          getFeatureState,
          removeFeatureState,
          getMap: () => record.styleTarget,
        }),
        [record.styleTarget]
      );

      return createElement(
        "div",
        {
          "data-testid": "wrapper-map",
          "data-map-id": record.id,
          "data-constructed": record.constructed ? "true" : "false",
          "data-context-width": record.contextWidth,
        },
        children
      );
    }
  );

  const Source = jest.fn(
    ({
      id,
      type,
      children,
    }: {
      readonly id: string;
      readonly type?: string;
      readonly children?: ReactNode;
    }) => {
      useEffect(() => {
        const entry = { type };
        if (!sources.has(id)) sources.set(id, entry);
        return () => {
          if (sources.get(id) === entry) sources.delete(id);
        };
      }, [id, type]);
      return createElement(
        "div",
        { id },
        Children.map(children, (child) =>
          isValidElement<{ readonly source?: string }>(child)
            ? cloneElement(child, { source: id })
            : child
        )
      );
    }
  );

  const Layer = jest.fn(({ id }: { readonly id: string }) => {
    useEffect(() => {
      const entry = { id };
      layers.set(id, entry);
      return () => {
        if (layers.get(id) === entry) layers.delete(id);
      };
    }, [id]);
    return createElement("div");
  });

  const useMap = () => ({
    current: currentStyleTarget
      ? { getMap: () => currentStyleTarget }
      : undefined,
  });

  return {
    Map: WrapperMap,
    Source,
    Layer,
    useMap,
    flyTo,
    jumpTo,
    easeTo,
    fitBounds,
    zoomTo,
    stop,
    resize,
    getCenter,
    disableRotation,
    enableRotation,
    resetWebMapMock,
    getStyleTarget: () => currentStyleTarget,
    queryRenderedFeatures,
    querySourceFeatures,
    getSource,
    getLayer,
    setFeatureState,
    getFeatureState,
    removeFeatureState,
    clusterSource,
    registerMockSource: (id: string, source: unknown): void => {
      sources.set(id, source);
    },
  };
};

const createStyleTarget = (
  touchZoomRotate: StyleLoadTarget["touchZoomRotate"]
): StyleLoadTarget => {
  const listeners = new Map<string, Set<(event: ErrorNotice) => void>>();
  const images = new Map<string, unknown>();
  const enabled = new Map<WebHandlerName, boolean>(
    webHandlerNames.map((name) => [name, true])
  );
  const handlers = Object.fromEntries(
    webHandlerNames.map((name) => [
      name,
      {
        isEnabled: () => enabled.get(name) === true,
      },
    ])
  ) as StyleLoadTarget["handlers"];
  let loaded = false;
  const listenersFor = (type: string): Set<(event: ErrorNotice) => void> => {
    const found = listeners.get(type);

    if (found) {
      return found;
    }

    const created = new Set<(event: ErrorNotice) => void>();

    listeners.set(type, created);

    return created;
  };
  const emit = (type: string) => {
    loaded = true;

    for (const listener of [...listenersFor(type)]) {
      listener({});
    }
  };

  return {
    on: (type, listener) => {
      listenersFor(type).add(listener);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    emitStyleLoad: () => {
      emit("style.load");
    },
    emitLoad: () => {
      emit("load");
    },
    emitIdle: () => {
      emit("idle");
    },
    // styledata fires during ordinary style activity, so it does not mark
    // the style loaded the way the completion events do.
    emitStyleData: () => {
      for (const listener of [...listenersFor("styledata")]) {
        listener({});
      }
    },
    emitError: (error) => {
      for (const listener of [...listenersFor("error")]) {
        listener({ error });
      }
    },
    clearImages: () => {
      images.clear();
    },
    hasImage: (name) => images.has(name),
    addImage: jest.fn((name: string, image: unknown) => {
      images.set(name, image);
    }),
    removeImage: jest.fn((name: string) => {
      images.delete(name);
    }),
    // Mapbox GL loads through a callback and MapLibre GL through a promise;
    // this one double serves both calling conventions.
    loadImage: jest.fn(
      (url: string, callback?: (error: unknown, image?: unknown) => void) => {
        const image = { url, width: 1, height: 1 };

        if (callback) {
          callback(null, image);
          return undefined;
        }

        return Promise.resolve({ data: image });
      }
    ),
    listenerCount: (type = "style.load") => listeners.get(type)?.size ?? 0,
    handlers,
    // Pinned wrappers default omitted handler props to true on updates. The
    // master interactive prop is constructor-only and is not read here.
    applyHandlerProps: (props) => {
      for (const name of webHandlerNames) {
        enabled.set(name, props[name] ?? true);
      }
    },
    isStyleLoaded: () => loaded,
    touchZoomRotate,
  };
};
