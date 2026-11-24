import type { MapView } from "@rnmapbox/maps";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { Platform } from "react-native";

import type { NativeGestureSelection } from "../native-gestures.js";
import { toRnmapboxGestures } from "./convert-gestures.js";

/**
 * RNMapbox touch-gesture settings.
 *
 * This is the wrapper's `gestureSettings` object. It is not a common map prop.
 * Supply it with {@link MapboxGestureSettings} around a mapbox-native map.
 */
export type GestureSettings = NonNullable<
  ComponentProps<typeof MapView>["gestureSettings"]
>;

const MapboxGestureSettingsContext = createContext<GestureSettings | undefined>(
  undefined
);

/**
 * Supplies RNMapbox `gestureSettings` to the mapbox-native map inside it.
 *
 * Common `doubleTapZoom` overwrites the double-tap fields from `settings`.
 * Another adapter does not read this context.
 *
 * @param props - Settings and the map tree that should receive them.
 * @returns The children under the settings context.
 */
export const MapboxGestureSettings = ({
  settings,
  children,
}: {
  /** RNMapbox gesture settings applied to the enclosing mapbox-native map. */
  readonly settings: GestureSettings;
  /** Map tree rendered with those settings. */
  readonly children?: ReactNode;
}) => (
  <MapboxGestureSettingsContext.Provider value={settings}>
    {children}
  </MapboxGestureSettingsContext.Provider>
);

/**
 * Resolves wrapper gesture props and restores fields from retired overrides.
 *
 * @param selection - Portable gesture flags.
 * @param options - Explicitly selected RNMapbox options.
 * @returns Gesture props for the mounted RNMapbox map.
 */
export const useRnmapboxGestures = (
  selection: NativeGestureSelection,
  options:
    | {
        readonly gestureSettings?: GestureSettings;
        readonly zoomEnabled?: boolean;
      }
    | undefined
): {
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  gestureSettings?: GestureSettings;
} => {
  const contextSettings = useContext(MapboxGestureSettingsContext);
  const selected = mergeGestureSettings(
    options?.gestureSettings,
    contextSettings
  );
  const { gestureSettings: portable, ...scalars } =
    toRnmapboxGestures(selection);
  const isAndroid = Platform.OS === "android";
  // Android requires a boolean and its zoom setter also toggles both tap gestures.
  const zoomEnabled =
    scalars.zoomEnabled ??
    options?.zoomEnabled ??
    (isAndroid ? true : undefined);
  const useScalarLock =
    isAndroid &&
    selection.interactive === false &&
    selected === undefined &&
    selection.doubleTapZoom === undefined;
  const override = useScalarLock ? undefined : portable;
  const [hasAppliedDoubleTapOverride, setHasAppliedDoubleTapOverride] =
    useState(false);
  if (override !== undefined && !hasAppliedDoubleTapOverride) {
    setHasAppliedDoubleTapOverride(true);
  }

  const restored =
    hasAppliedDoubleTapOverride && override === undefined
      ? restoredDoubleTapSettings(selected, zoomEnabled ?? true, isAndroid)
      : undefined;

  return {
    ...scalars,
    zoomEnabled,
    gestureSettings: mergeGestureSettings(selected, override ?? restored),
  };
};

/** RNMapbox retains both double-tap fields when a dictionary key is removed. */
const restoredDoubleTapSettings = (
  selected: GestureSettings | undefined,
  zoomEnabled: boolean,
  isAndroid: boolean
): GestureSettings => ({
  doubleTapToZoomInEnabled: selected?.doubleTapToZoomInEnabled ?? zoomEnabled,
  doubleTouchToZoomOutEnabled:
    selected?.doubleTouchToZoomOutEnabled ?? (isAndroid ? zoomEnabled : true),
});

const mergeGestureSettings = (
  base: GestureSettings | undefined,
  overrides: GestureSettings | undefined
): GestureSettings | undefined => {
  if (base === undefined && overrides === undefined) {
    return undefined;
  }

  return { ...base, ...overrides };
};
