import { useState } from "react";

interface LayerSettings {
  readonly beforeId?: string;
  readonly afterId?: string;
  readonly layerIndex?: number;
  readonly filter?: boolean | readonly unknown[];
  readonly minzoom?: number;
  readonly maxzoom?: number;
}

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
  if (!value || typeof value !== "object") return value;

  const entries: [string, unknown][] = [];
  for (const [key, member] of Object.entries(value)) {
    if (skipUndefinedFields && member === undefined) continue;
    entries.push([key, snapshotNativeStyleValue(member, skipUndefinedFields)]);
  }
  return Object.fromEntries(entries);
};

/**
 * Converts a portable style field name to the native wrappers' camelCase key.
 *
 * @param key - Paint or layout field name.
 * @returns The native style key.
 */
export const toNativeLayerStyleKey = (key: string): string =>
  key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/** Recreates only the wrapper layer when a setting must return to its SDK default. */
export const useNativeLayerKey = (
  style: object,
  settings: LayerSettings
): number => {
  const fields = [
    ...Object.keys(style),
    ...resettableSettings.filter((name) => settings[name] !== undefined),
  ].sort();
  const signature = JSON.stringify(fields);
  const [previous, setPrevious] = useState(() => ({
    fields,
    signature,
    revision: 0,
  }));
  if (previous.signature === signature) return previous.revision;

  // The pinned native setters update present fields and cannot reliably clear
  // an omitted style property, zoom limit or insertion constraint in place.
  const removed = previous.fields.some((field) => !fields.includes(field));
  const revision = previous.revision + Number(removed);
  setPrevious({ fields, signature, revision });
  return revision;
};

const resettableSettings = [
  "beforeId",
  "afterId",
  "layerIndex",
  "filter",
  "minzoom",
  "maxzoom",
] as const;
