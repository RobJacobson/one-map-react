import { useLayoutEffect, useRef } from "react";

import type { MapRef } from "../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../contracts/event-types.js";
import type { MapProps } from "../contracts/map-types.js";

/**
 * Owns committed map callbacks and pending-query teardown.
 *
 * @param props - Callbacks and interactive layers from the committed map render.
 * @param mapRef - The concrete renderer attachment, captured before queries.
 * @returns Movement and click handlers that suppress obsolete delivery.
 */
export const useMapInteractions = (
  props: MapProps,
  mapRef: { readonly current: MapRef | null }
): {
  /** Delivers movement only while its map attachment remains active. */
  readonly move: (event: MoveEvent) => void;
  readonly click: (event: ClickEvent) => Promise<void>;
} => {
  const propsRef = useRef(props);
  const active = useRef(true);
  const generation = useRef(0);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current += 1;
    };
  }, []);

  const move = (event: MoveEvent): void => {
    if (active.current) propsRef.current.onMove?.(event);
  };

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
    propsRef.current.onClick?.(hit);
  };

  return { move, click };
};

const requireAttachedMap = (map: MapRef | null): MapRef => {
  if (!map) throw new Error("Map is not attached.");
  return map;
};
