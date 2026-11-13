export const pendingOfflineOperations = (engine) => [
  ...(engine === "mapbox" ? [] : ["ambient-invalidate"]),
  "ambient-clear",
  ...(engine === "mapbox" ? [] : ["ambient-size"]),
  "tile-limit",
  "throttle",
  ...(engine === "mapbox"
    ? [
        "quota",
        "migrate",
        "legacy-list",
        "legacy-migrate",
        "legacy-limit",
        "legacy-reset",
      ]
    : []),
];
