import { useRef } from "react";

/**
 * Throws when a creation option of an owned resource changes between renders.
 *
 * Sources and layers own renderer resources whose creation inputs cannot be
 * updated in place on every adapter. The first render's values win for the
 * component's lifetime; a later change fails instead of silently applying on
 * one backend and being ignored on another.
 *
 * @param owner - Description of the owned resource, such as `Source "routes"`.
 * @param options - Creation options captured for this render.
 * @throws When an option value differs from the first render.
 */
export const useStableOptions = (
  owner: string,
  options: Readonly<Record<string, unknown>>
): void => {
  const initial = useRef<Readonly<Record<string, unknown>> | null>(null);

  if (initial.current === null) {
    initial.current = options;
    return;
  }

  // eslint-disable-next-line react/refs -- Compare against immutable creation inputs during render to reject unsupported resource replacement.
  const changed = changedOptionKey(initial.current, options);

  if (changed !== undefined) {
    throw new Error(
      `${owner} changed the creation option "${changed}". ` +
        "Remount it with a new React key to recreate the resource."
    );
  }
};

/**
 * Returns the first key whose value differs between two option objects, or
 * `undefined` when they match. Nested arrays and objects compare by value.
 *
 * @param previous - Options captured on the first render.
 * @param next - Options from the current render.
 * @returns The first changed key, or `undefined`.
 */
export const changedOptionKey = (
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>
): string | undefined => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const key of keys) {
    if (!optionValueEquals(previous[key], next[key])) {
      return key;
    }
  }

  return undefined;
};

const optionValueEquals = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => optionValueEquals(value, right[index]))
    );
  }

  if (isPlainRecord(left) && isPlainRecord(right)) {
    return changedOptionKey(left, right) === undefined;
  }

  return false;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
