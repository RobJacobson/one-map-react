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
 * Converts a portable style field name to the native wrappers' camelCase key.
 *
 * @param key - Paint or layout field name.
 * @returns The native style key.
 */
export const toNativeLayerStyleKey = (key: string): string =>
  key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/**
 * Recreates only the wrapper layer when a field must return to its SDK default.
 * @param styleKeys - Distinct style keys as seen by the selected wrapper.
 * @param settings - Wrapper layer settings that can require a reset.
 * @returns The React key for the wrapper layer.
 */
export const useNativeLayerKey = (
  styleKeys: Iterable<string>,
  settings: LayerSettings
): number => {
  const fields = [
    ...styleKeys,
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
