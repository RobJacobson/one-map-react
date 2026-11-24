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
 * The copy is the value forwarded to MapLibre. Returning the caller's container
 * would let a getter change between validation and the style converter.
 * The caller's value is not mutated.
 *
 * @param value - Expression, style object, or other field forwarded to the wrapper.
 * @returns A new array or record, or the original primitive when the value is not a container.
 */
export const omitUndefinedFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    for (const member of value) copy.push(omitUndefinedFields(member));
    return copy;
  }
  if (!value || typeof value !== "object") return value;

  const entries: [string, unknown][] = [];
  for (const [key, member] of Object.entries(value)) {
    if (member === undefined) continue;
    entries.push([key, omitUndefinedFields(member)]);
  }
  return Object.fromEntries(entries);
};

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
