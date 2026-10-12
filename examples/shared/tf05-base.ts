declare const process: {
  env: { TF05_BASE?: string };
};

/**
 * Fixture server base for the native TF05 smoke.
 *
 * Babel inlines `TF05_BASE` while Metro builds the bundle. Android emulators
 * reach the Mac through `10.0.2.2`; the iOS simulator shares the host
 * loopback, which is the default.
 */
export const tf05Base = process.env.TF05_BASE ?? "http://127.0.0.1:8798";
