declare const process: {
  env: { TF05_BASE?: string };
};

/**
 * Fixture server base for the native TF05 smoke.
 *
 * Babel inlines `TF05_BASE` while Metro builds the bundle. Acceptance connects
 * the assigned Android emulator through adb reverse; both native targets
 * then use the assigned host loopback port.
 */
export const tf05Base = process.env.TF05_BASE ?? "http://127.0.0.1:8798";
