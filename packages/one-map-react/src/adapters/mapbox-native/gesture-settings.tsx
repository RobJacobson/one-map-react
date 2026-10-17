import type { MapView } from "@rnmapbox/maps";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from "react";

/**
 * RNMapbox touch-gesture settings.
 *
 * @remarks
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
 * @remarks
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
 * Reads the enclosing {@link MapboxGestureSettings} value.
 *
 * @returns The supplied settings, or `undefined` when none encloses the map.
 */
export const useMapboxGestureSettings = (): GestureSettings | undefined =>
  useContext(MapboxGestureSettingsContext);
