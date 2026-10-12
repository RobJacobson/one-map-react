import { useLayoutEffect, useRef } from "react";

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
 * @returns A stable-lifetime wrapper that ignores calls after unmount.
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

  return (...args: Args) => {
    if (active.current) {
      callbackRef.current?.(...args);
    }
  };
};
