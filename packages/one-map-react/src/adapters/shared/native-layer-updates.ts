import { useState } from "react";

interface LayerSettings {
  readonly beforeId?: string;
  readonly afterId?: string;
  readonly layerIndex?: number;
  readonly filter?: boolean | readonly unknown[];
  readonly minzoom?: number;
  readonly maxzoom?: number;
}

/** Removes undefined entries before they reach the wrapper style converter. */
export const definedStyle = (
  style?: object
): Record<string, unknown> | undefined => {
  if (!style) return undefined;
  return Object.fromEntries(
    Object.entries(style).filter(([, value]) => value !== undefined)
  );
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
