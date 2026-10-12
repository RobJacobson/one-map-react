import { useRef } from "react";

/**
 * Returns the first value passed to the hook for the lifetime of the component.
 *
 * @param value - Value captured on first render.
 * @returns The first `value`.
 */
export const useFrozenValue = <Value>(value: Value): Value =>
  useRef(value).current;
