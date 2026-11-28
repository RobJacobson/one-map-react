import { useCallback, useLayoutEffect, useRef } from "react";

import { requireAttachedMap } from "../adapters/index.js";
import type { MapRef } from "../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../contracts/event-types.js";
import type { MapProps } from "../contracts/map-types.js";

type QueryMap = Pick<MapRef, "queryRenderedFeatures">;

type TapResult<Event> =
  | { readonly kind: "click"; readonly event: Event }
  | { readonly kind: "error"; readonly error: unknown };

interface TapQueue {
  readonly owner: QueryMap | null;
  readonly cancellations: Map<Promise<void>, () => void>;
  tail?: Promise<void>;
}

/**
 * Owns committed map callbacks and delivers tap results in receipt order.
 *
 * @param props - Callbacks and interactive layers from the committed map render.
 * @param mapRef - The concrete renderer attachment, captured before queries.
 * @returns Movement and click handlers that suppress obsolete delivery.
 */
export const useMapInteractions = <Event extends ClickEvent>(
  props: Pick<MapProps, "onMove" | "onError" | "interactiveLayerIds"> & {
    readonly onClick?: (event: Event) => void;
  },
  mapRef: { readonly current: QueryMap | null }
): {
  /** Delivers movement only while its map attachment remains active. */
  readonly move: (event: MoveEvent) => void;
  /** Resolves after delivery or teardown, or rejects if the user callback throws. */
  readonly click: (event: Event) => Promise<void>;
  /** Releases clicks for a renderer attachment that has changed. */
  readonly syncAttachment: () => void;
} => {
  const propsRef = useRef(props);
  const active = useRef(true);
  const queueRef = useRef<TapQueue | null>(null);

  const syncAttachment = useCallback((): void => {
    const queue = queueRef.current;
    if (queue && queue.owner !== mapRef.current) {
      queueRef.current = null;
      discardTaps(queue);
    }
  }, [mapRef]);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      const queue = queueRef.current;
      queueRef.current = null;
      if (queue) discardTaps(queue);
    };
  }, []);

  const move = (event: MoveEvent): void => {
    if (active.current) propsRef.current.onMove?.(event);
  };

  const click = async (event: Event): Promise<void> => {
    if (!active.current) return;

    syncAttachment();
    const layers = propsRef.current.interactiveLayerIds;
    if (!layers && !queueRef.current?.tail) {
      propsRef.current.onClick?.(event);
      return;
    }
    const queue: TapQueue = queueRef.current ?? {
      owner: mapRef.current,
      cancellations: new Map(),
    };
    queueRef.current = queue;
    return deliverInTapOrder(queue, event, layers, (result) => {
      if (queueRef.current !== queue || mapRef.current !== queue.owner) return;
      if (result.kind === "click") propsRef.current.onClick?.(result.event);
      else propsRef.current.onError?.({ error: result.error });
    });
  };

  return { move, click, syncAttachment };
};

/** Starts the query now and waits for preceding taps before invoking the callback. */
const deliverInTapOrder = async <Event extends ClickEvent>(
  queue: TapQueue,
  event: Event,
  layers: readonly string[] | undefined,
  deliver: (result: TapResult<Event>) => void
): Promise<void> => {
  // Reserve this tap's turn before an SDK call can dispatch another tap.
  const previous = queue.tail;
  let advance!: () => void;
  const turn = new Promise<void>((resolve) => {
    advance = resolve;
  });
  queue.tail = turn;
  try {
    const result = await new Promise<TapResult<Event> | undefined>(
      (resolve) => {
        queue.cancellations.set(turn, () => resolve(undefined));
        if (layers) void queryTap(queue.owner, event, layers).then(resolve);
        else resolve({ kind: "click", event });
      }
    );
    if (previous) await previous;
    if (result) deliver(result);
  } finally {
    queue.cancellations.delete(turn);
    if (queue.tail === turn) queue.tail = undefined;
    advance();
  }
};

/** Captures query failures separately from errors thrown by application callbacks. */
const queryTap = async <Event extends ClickEvent>(
  map: QueryMap | null,
  event: Event,
  layers: readonly string[]
): Promise<TapResult<Event>> => {
  try {
    return {
      kind: "click",
      event: {
        ...event,
        features: await requireAttachedMap(map).queryRenderedFeatures(
          event.point,
          { layers }
        ),
      },
    };
  } catch (error) {
    return { kind: "error", error };
  }
};

/** Releases all waiting turns when an SDK query outlives its attachment. */
const discardTaps = (queue: TapQueue): void => {
  for (const cancel of queue.cancellations.values()) cancel();
  queue.cancellations.clear();
};
