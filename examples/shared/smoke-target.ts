declare const process: {
  env: { ONE_MAP_SMOKE?: string };
};

/**
 * Selects the native example sequence.
 *
 * Metro inlines this from `ONE_MAP_SMOKE` while it builds the bundle.
 * Unset and any other value keep the TF03 lifecycle sequence.
 */
export const smokeTarget =
  process.env.ONE_MAP_SMOKE === "tf09"
    ? "tf09"
    : process.env.ONE_MAP_SMOKE === "tf08-storage"
      ? "tf08-storage"
      : process.env.ONE_MAP_SMOKE === "tf08"
        ? "tf08"
        : process.env.ONE_MAP_SMOKE === "tf07"
          ? "tf07"
          : process.env.ONE_MAP_SMOKE === "tf06-lifetimes"
            ? "tf06-lifetimes"
            : process.env.ONE_MAP_SMOKE === "tf06"
              ? "tf06"
              : process.env.ONE_MAP_SMOKE === "tf05"
                ? "tf05"
                : process.env.ONE_MAP_SMOKE === "tf04"
                  ? "tf04"
                  : "tf03";
