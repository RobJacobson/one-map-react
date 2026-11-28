/**
 * Converts a portable style field name to the native wrappers' camelCase key.
 *
 * @param key - Paint or layout field name.
 * @returns The native style key.
 */
export const toNativeLayerStyleKey = (key: string): string =>
  key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
