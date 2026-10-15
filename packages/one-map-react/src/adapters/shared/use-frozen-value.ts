import { useRef } from "react";

/**
 * Returns the first value passed to the hook for the lifetime of the component.
 *
 * @param value - Value captured on first render.
 * @returns The first `value`.
 */
export const useFrozenValue = <Value>(value: Value): Value =>
  // eslint-disable-next-line react/refs -- Creation inputs deliberately retain their first value for this component lifetime.
  useRef(value).current;
