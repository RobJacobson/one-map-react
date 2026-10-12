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
  getMap: () => StyleLoadTarget;
}

export interface StyleLoadTarget {
  on: (type: string, listener: () => void) => void;
  off: (type: string, listener: () => void) => void;
  emitStyleLoad: () => void;
  emitLoad: () => void;
  emitIdle: () => void;
  emitStyleData: () => void;
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
  listenerCount: () => number;
  isStyleLoaded: () => boolean;
  touchZoomRotate: {
    disableRotation: () => void;
    enableRotation: () => void;
  };
}

interface WebMapMockProps {
  readonly children?: ReactNode;
  readonly ref?: Ref<MapHandle>;
  readonly reuseMaps?: boolean;
  readonly gl?: { readonly drawingBufferWidth: number };
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
    disableRotation.mockClear();
    enableRotation.mockClear();
    Source.mockClear();
    Layer.mockClear();
  };

  const WrapperMap = jest.fn(
    ({ children, ref, reuseMaps, gl }: WebMapMockProps) => {
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
      children,
    }: {
      readonly id: string;
      readonly children?: ReactNode;
    }) =>
      createElement(
        "div",
        { id },
        Children.map(children, (child) =>
          isValidElement<{ readonly source?: string }>(child)
            ? cloneElement(child, { source: id })
            : child
        )
      )
  );

  const Layer = jest.fn(() => createElement("div"));

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
  };
};

const createStyleTarget = (
  touchZoomRotate: StyleLoadTarget["touchZoomRotate"]
): StyleLoadTarget => {
  const listeners = new Map<string, Set<() => void>>();
  const images = new Map<string, unknown>();
  let loaded = false;
  const listenersFor = (type: string): Set<() => void> => {
    const found = listeners.get(type);

    if (found) {
      return found;
    }

    const created = new Set<() => void>();

    listeners.set(type, created);

    return created;
  };
  const emit = (type: string) => {
    loaded = true;

    for (const listener of [...listenersFor(type)]) {
      listener();
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
        listener();
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
    listenerCount: () => listeners.get("style.load")?.size ?? 0,
    isStyleLoaded: () => loaded,
    touchZoomRotate,
  };
};
