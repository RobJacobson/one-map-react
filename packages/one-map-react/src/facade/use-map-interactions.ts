import { useCallback, useLayoutEffect, useRef } from "react";

import type { Backend } from "../contracts/adapter.js";
import type { MapRef } from "../contracts/camera-types.js";
import type {
  ClickEvent,
  MoveEvent,
  SourceClickEvent,
} from "../contracts/event-types.js";
import type { MapProps } from "../contracts/map-types.js";
import type { MapSession } from "./map-context.js";

/** Owns source hits, common propagation, subscriptions, and pending-hit teardown. */
export const useMapInteractions = (
  props: MapProps,
  backend: Backend,
  mapRef: { readonly current: MapRef | null }
): Pick<
  MapSession,
  "emit" | "subscribe" | "registerSource" | "dispatchSource"
> & {
  readonly click: (event: ClickEvent) => Promise<void>;
} => {
  const listeners = useRef({
    click: new Set<(event: ClickEvent | MoveEvent) => void>(),
    move: new Set<(event: ClickEvent | MoveEvent) => void>(),
  });
  const sources = useRef(
    new globalThis.Map<
      string,
      {
        readonly callback: (event: SourceClickEvent) => void;
        readonly attachment: object;
      }
    >()
  );
  const propsRef = useRef(props);
  const active = useRef(true);
  const generation = useRef(0);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  useLayoutEffect(() => {
    active.current = true;
    const sourceRegistry = sources.current;
    const eventListeners = listeners.current;
    return () => {
      active.current = false;
      generation.current += 1;
      sourceRegistry.clear();
      eventListeners.click.clear();
      eventListeners.move.clear();
    };
  }, []);
  const emit = useCallback(
    (event: "click" | "move", payload: ClickEvent | MoveEvent) => {
      for (const listener of listeners.current[event]) listener(payload);
    },
    []
  );
  const reportClick = useCallback(
    (event: ClickEvent) => {
      emit("click", event);
      propsRef.current.onClick?.(event);
    },
    [emit]
  );
  const queryHit = useCallback(
    async (event: ClickEvent): Promise<ClickEvent> => {
      const layers = propsRef.current.interactiveLayerIds;
      if (!layers) return event;
      const map = mapRef.current;
      if (!map) throw new Error("Map is not attached.");
      return {
        ...event,
        features: await map.queryRenderedFeatures(event.point, { layers }),
      };
    },
    [mapRef]
  );
  const dispatchSource = useCallback(
    (id: string, event: ClickEvent) => {
      let stopped = false;
      const source = sources.current.get(id);
      source?.callback({
        ...event,
        sourceId: id,
        stopPropagation: () => {
          stopped = true;
        },
      });
      if (stopped) return;
      const currentGeneration = generation.current;
      void queryHit(event)
        .then((hit) => {
          if (
            active.current &&
            generation.current === currentGeneration &&
            sources.current.get(id)?.attachment === source?.attachment
          )
            reportClick(hit);
        })
        .catch((error: unknown) => {
          if (
            active.current &&
            generation.current === currentGeneration &&
            sources.current.get(id)?.attachment === source?.attachment
          )
            propsRef.current.onError?.({ error });
        });
    },
    [queryHit, reportClick]
  );
  const registerSource = useCallback(
    (
      id: string,
      callback: (event: SourceClickEvent) => void,
      attachment: object
    ) => {
      const registration = { callback, attachment };
      sources.current.set(id, registration);
      return () => {
        if (sources.current.get(id) === registration)
          sources.current.delete(id);
      };
    },
    []
  );
  const subscribe = useCallback(
    (
      event: "click" | "move",
      listener: (event: ClickEvent | MoveEvent) => void
    ) => {
      listeners.current[event].add(listener);
      return () => {
        listeners.current[event].delete(listener);
      };
    },
    []
  );
  const click = async (event: ClickEvent) => {
    const currentGeneration = generation.current;
    const sourceAttachments = new globalThis.Map(sources.current);
    let hit = event;
    let sourceHit = event;
    try {
      if (!backend.endsWith("native") && sources.current.size > 0) {
        const map = mapRef.current;
        if (!map) throw new Error("Map is not attached.");
        // Source activation owns its hit region independently of the map's
        // interactiveLayerIds. Native wrappers already perform this query.
        sourceHit = {
          ...event,
          features: await map.queryRenderedFeatures(event.point),
        };
      }
      if (propsRef.current.interactiveLayerIds) hit = await queryHit(event);
    } catch (error) {
      if (active.current && generation.current === currentGeneration)
        propsRef.current.onError?.({ error });
      return;
    }
    if (!active.current || generation.current !== currentGeneration) return;
    let stopped = false;
    const topSource = sourceHit.features
      ?.map((feature) => (feature as { source?: string }).source)
      .find((id) => id !== undefined && sourceAttachments.has(id));
    if (topSource) {
      if (
        sources.current.get(topSource)?.attachment !==
        sourceAttachments.get(topSource)?.attachment
      )
        return;
      const features = sourceHit.features?.filter(
        (feature) => (feature as { source?: string }).source === topSource
      );
      sources.current.get(topSource)?.callback({
        ...sourceHit,
        features,
        sourceId: topSource,
        stopPropagation: () => {
          stopped = true;
        },
      });
      if (!propsRef.current.interactiveLayerIds) hit = { ...hit, features };
    }
    if (!stopped) reportClick(hit);
  };
  return { emit, subscribe, registerSource, dispatchSource, click };
};
