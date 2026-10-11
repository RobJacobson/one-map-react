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
  resize: () => unknown;
  getMap: () => StyleLoadTarget;
}

export interface StyleLoadTarget {
  on: (type: string, listener: () => void) => void;
  off: (type: string, listener: () => void) => void;
  emitStyleLoad: () => void;
  emitLoad: () => void;
  emitIdle: () => void;
  listenerCount: () => number;
  isStyleLoaded: () => boolean;
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
  const resize = jest.fn();
  let saved: PooledMap | null = null;
  let serial = 0;
  let currentStyleTarget: StyleLoadTarget | null = null;

  const resetWebMapMock = (): void => {
    saved = null;
    serial = 0;
    currentStyleTarget = null;
    flyTo.mockClear();
    resize.mockClear();
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
          styleTarget: createStyleTarget(),
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
          resize,
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

  const Source = ({
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
    );

  const Layer = jest.fn(() => createElement("div"));

  return {
    Map: WrapperMap,
    Source,
    Layer,
    flyTo,
    resize,
    resetWebMapMock,
    getStyleTarget: () => currentStyleTarget,
  };
};

const createStyleTarget = (): StyleLoadTarget => {
  const listeners = new Map<string, Set<() => void>>();
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
    listenerCount: () => listeners.get("style.load")?.size ?? 0,
    isStyleLoaded: () => loaded,
  };
};
