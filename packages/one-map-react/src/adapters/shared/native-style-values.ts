import { isRecord } from "./wrapper-values.js";

/**
 * Copies arrays and objects, dropping object fields whose values are undefined.
 *
 * @param value - Expression, style object, or other field forwarded to the wrapper.
 * @returns A snapshot with undefined object fields removed.
 */
export const omitUndefinedFields = (value: unknown): unknown =>
  snapshotNativeStyleValue(value, true);

/**
 * Copies the arrays and enumerable string-keyed fields the style bridge reads.
 * A getter cannot change the forwarded value after validation.
 *
 * @param value - Expression, style object, or other field forwarded to the wrapper.
 * @param skipUndefinedFields - Drop undefined object fields for managed inputs.
 * @returns A copied array or record, or the original value for a non-container.
 */
export const snapshotNativeStyleValue = (
  value: unknown,
  skipUndefinedFields = false
): unknown => {
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    for (const member of value)
      copy.push(snapshotNativeStyleValue(member, skipUndefinedFields));
    return copy;
  }
  if (!isRecord(value)) return value;

  const entries: [string, unknown][] = [];
  for (const [key, member] of Object.entries(value)) {
    if (skipUndefinedFields && member === undefined) continue;
    entries.push([key, snapshotNativeStyleValue(member, skipUndefinedFields)]);
  }
  return Object.fromEntries(entries);
};
