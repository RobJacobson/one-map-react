import { useCallback, useLayoutEffect, useRef } from "react";

import type { MapRef } from "../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../contracts/event-types.js";
import type { MapProps } from "../contracts/map-types.js";
import type { MapSession } from "./map-context.js";

/** Owns map notifications, subscriptions, and pending-query teardown. */
export const useMapInteractions = (
  props: MapProps,
  mapRef: { readonly current: MapRef | null }
): Pick<MapSession, "subscribe"> & {
  readonly emit: (
    event: "click" | "move",
    payload: ClickEvent | MoveEvent
  ) => void;
  /** Delivers movement only while its map attachment remains active. */
  readonly move: (event: MoveEvent) => void;
  readonly click: (event: ClickEvent) => Promise<void>;
} => {
  const listeners = useRef({
    click: new Set<(event: ClickEvent | MoveEvent) => void>(),
    move: new Set<(event: ClickEvent | MoveEvent) => void>(),
  });
  const propsRef = useRef(props);
  const active = useRef(true);
  const generation = useRef(0);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  useLayoutEffect(() => {
    active.current = true;
    const eventListeners = listeners.current;
    return () => {
      active.current = false;
      generation.current += 1;
      eventListeners.click.clear();
      eventListeners.move.clear();
    };
  }, []);
  const emit = useCallback(
    (event: "click" | "move", payload: ClickEvent | MoveEvent) => {
      // eslint-disable-next-line unicorn/no-useless-spread -- Callbacks may change subscriptions during delivery.
      for (const listener of [...listeners.current[event]]) listener(payload);
    },
    []
  );
  const move = (event: MoveEvent): void => {
    const currentGeneration = generation.current;
    emit("move", event);
    if (active.current && generation.current === currentGeneration)
      propsRef.current.onMove?.(event);
  };

  const subscribe = useCallback(
    (
      event: "click" | "move",
      listener: (event: ClickEvent | MoveEvent) => void
    ) => {
      let listening = true;
      const started = generation.current;
      const registered = (payload: ClickEvent | MoveEvent): void => {
        if (listening && active.current && generation.current === started)
          listener(payload);
      };
      listeners.current[event].add(registered);
      return () => {
        listening = false;
        listeners.current[event].delete(registered);
      };
    },
    []
  );
  const click = async (event: ClickEvent): Promise<void> => {
    const currentGeneration = generation.current;
    const map = mapRef.current;
    const isCurrent = (): boolean =>
      active.current &&
      generation.current === currentGeneration &&
      mapRef.current === map;
    let hit = event;
    try {
      const layers = propsRef.current.interactiveLayerIds;
      if (layers) {
        // Capture the concrete owner before awaiting a query that can outlive it.
        hit = {
          ...event,
          features: await requireAttachedMap(map).queryRenderedFeatures(
            event.point,
            { layers }
          ),
        };
      }
    } catch (error) {
      if (isCurrent()) propsRef.current.onError?.({ error });
      return;
    }
    if (!isCurrent()) return;
    emit("click", hit);
    if (isCurrent()) propsRef.current.onClick?.(hit);
  };
  return { emit, move, subscribe, click };
};

const requireAttachedMap = (map: MapRef | null): MapRef => {
  if (!map) throw new Error("Map is not attached.");
  return map;
};
