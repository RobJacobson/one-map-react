import type { MapView } from "@rnmapbox/maps";
import {
  type ComponentProps,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  type NativeGestureSelection,
  normalizeNativeGestures,
} from "../index.js";

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
}): ReactElement => (
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
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  gestureSettings?: GestureSettings;
} => {
  const contextSettings = useContext(MapboxGestureSettingsContext);
  const selected = mergeGestureSettings(
    options?.gestureSettings,
    contextSettings
  );
  const { dragPan, touchZoom, touchRotate, touchPitch, doubleTapZoom } =
    normalizeNativeGestures(selection);
  const isAndroid = Platform.OS === "android";
  // RNMapbox's zoom scalar and dictionary setters can overwrite the same
  // recognizers. Resolve their precedence together and write each field once.
  const zoom = touchZoom ?? options?.zoomEnabled;
  const quickZoom =
    selection.interactive === false ? false : selected?.quickZoomEnabled;
  const zoomSettings = useRestoredZoomSettings({
    pinchZoomEnabled:
      touchZoom ?? selected?.pinchZoomEnabled ?? options?.zoomEnabled,
    quickZoomEnabled: quickZoom ?? (isAndroid ? undefined : zoom),
    doubleTapToZoomInEnabled:
      doubleTapZoom ?? selected?.doubleTapToZoomInEnabled ?? zoom,
    doubleTouchToZoomOutEnabled:
      doubleTapZoom ??
      selected?.doubleTouchToZoomOutEnabled ??
      (isAndroid ? zoom : undefined),
  });

  return {
    ...(dragPan === undefined ? {} : { scrollEnabled: dragPan }),
    ...(touchRotate === undefined ? {} : { rotateEnabled: touchRotate }),
    ...(touchPitch === undefined ? {} : { pitchEnabled: touchPitch }),
    gestureSettings: mergeGestureSettings(selected, zoomSettings),
  };
};

const zoomGestureNames = [
  "pinchZoomEnabled",
  "quickZoomEnabled",
  "doubleTapToZoomInEnabled",
  "doubleTouchToZoomOutEnabled",
] as const;

type ZoomGestureName = (typeof zoomGestureNames)[number];

/** Restores the enabled defaults only for fields this map has already set. */
const useRestoredZoomSettings = (
  settings: Pick<GestureSettings, ZoomGestureName>
): GestureSettings | undefined => {
  const [managed, setManaged] = useState<ReadonlySet<ZoomGestureName>>(
    () => new Set()
  );
  const nextManaged = new Set(managed);
  const resolved: GestureSettings = {};
  for (const name of zoomGestureNames) {
    const enabled = settings[name];
    if (enabled !== undefined) nextManaged.add(name);
    if (nextManaged.has(name)) resolved[name] = enabled ?? true;
  }
  if (nextManaged.size !== managed.size) setManaged(nextManaged);

  return nextManaged.size === 0 ? undefined : resolved;
};

const mergeGestureSettings = (
  base: GestureSettings | undefined,
  overrides: GestureSettings | undefined
): GestureSettings | undefined => {
  if (base === undefined && overrides === undefined) {
    return undefined;
  }

  return { ...base, ...overrides };
};
