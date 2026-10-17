import { useCallback, useLayoutEffect, useRef, useState } from "react";

type CallbackRecord = Record<string, ((...args: never[]) => void) | undefined>;

type ActiveCallbacks<Callbacks extends CallbackRecord> = {
  readonly [Key in keyof Callbacks]-?: (
    ...args: Parameters<NonNullable<Callbacks[Key]>>
  ) => void;
};

/**
 * Shares one committed callback snapshot and lifetime across a fixed set of names.
 *
 * @param callbacks - Fixed callback names; their optional functions may change.
 * @returns Stable handlers with each callback's argument types and teardown guard.
 */
export const useActiveCallbacks = <Callbacks extends CallbackRecord>(
  callbacks: Callbacks
): ActiveCallbacks<Callbacks> => {
  const dispatch = useActiveCallback((key: string, args: unknown[]) => {
    // Dynamic keys erase the argument relationship retained by ActiveCallbacks.
    const callback = callbacks[key] as
      | ((...values: unknown[]) => void)
      | undefined;
    callback?.(...args);
  });
  const [handlers] = useState(
    () =>
      // Object.fromEntries cannot retain each fixed key's argument tuple.
      Object.fromEntries(
        Object.keys(callbacks).map((key) => [
          key,
          (...args: unknown[]) => dispatch(key, args),
        ])
      ) as unknown as ActiveCallbacks<Callbacks>
  );

  return handlers;
};

/**
 * Returns a function that calls `callback` only while the component is mounted.
 *
 * The live callback is stored during commit so an uncommitted render, including
 * a suspended transition, cannot replace the handler on a still-visible map.
 * Mount and unmount update the guard in a layout effect, so a parent layout
 * effect in the same unmount commit cannot call the handler after the map is
 * removed.
 *
 * @param callback - Latest user callback, which may be omitted.
 * @returns A stable function that reads the committed callback and ignores calls after unmount.
 */
export const useActiveCallback = <Args extends unknown[]>(
  callback: ((...args: Args) => void) | undefined
): ((...args: Args) => void) => {
  const callbackRef = useRef(callback);
  const active = useRef(true);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  useLayoutEffect(() => {
    active.current = true;

    return () => {
      active.current = false;
    };
  }, []);

  return useCallback((...args: Args) => {
    if (active.current) {
      callbackRef.current?.(...args);
    }
  }, []);
};
