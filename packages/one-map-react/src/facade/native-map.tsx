import {
  type ComponentType,
  type ForwardRefExoticComponent,
  type PropsWithoutRef,
  createContext,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ViewProps } from "react-native";

import { nativeLngLat, nativePoint } from "../adapters/shared/native-values.js";
import type { MapRef } from "../contracts/camera-types.js";
import type {
  NativeMapInputs,
  NativeMarkerEvent,
} from "../contracts/native-types.js";
import type { SourceProps } from "../contracts/source-types.js";
import type { MarkerProps, MarkerRef } from "../contracts/ui-types.js";
import { MapSessionContext, type NativeComponents } from "./map-context.js";
import {
  createMapRegistry,
  type MapRegistry,
  noMapSubscription,
} from "./map-registry.js";
import { type ForwardedMapMethodKey, MountedMap } from "./MountedMap.js";
import { useSourceOptions } from "./source.js";
import { useMarkerOptions } from "./ui.js";

/** Marker props supported by both native entries. */
export interface NativeMarkerProps extends Omit<
  MarkerProps,
  "draggable" | "onDragStart" | "onDrag" | "onDragEnd" | "onClick"
> {
  /** Native shared markers support programmatic coordinates and activation only. */
  readonly draggable?: false;
  /** Reports the desktop coordinate fields when activated. */
  readonly onClick?: (event: NativeMarkerEvent) => void;
  /** Attributes on the native child View. */
  readonly hostProps?: ViewProps;
}

/** Attached map handles for one native entry. */
export interface MapCollection<Handle extends MapRef> {
  /** Returns the enclosing map handle when it belongs to this entry. */
  readonly current?: Handle;
  /** Returns the matching handle in this entry's nearest MapProvider. */
  readonly [id: string]: Handle | undefined;
}

/** Children that share named lookup for a selected native entry. */
export interface MapProviderProps {
  /** Components that may attach or look up maps. */
  readonly children?: ReactNode;
}

/** Components and lookup exposed by a bound native entry. */
interface NativeMapBinding<
  Handle extends MapRef,
  Props extends NativeMapInputs,
> {
  readonly Map: ForwardRefExoticComponent<
    PropsWithoutRef<Props> & RefAttributes<Handle>
  >;
  readonly MapProvider: (props: MapProviderProps) => ReactElement;
  readonly Source: (props: SourceProps) => ReactElement;
  readonly Marker: ForwardRefExoticComponent<
    NativeMarkerProps & RefAttributes<MarkerRef>
  >;
  readonly useMap: () => MapCollection<Handle>;
}

/**
 * Binds native map access to one concrete renderer and its typed handle.
 *
 * @param implementation - Renderer component exposing the selected handle.
 * @param components - Components bound to the same renderer.
 * @returns Components and hook sharing the entry's enclosing and named map access.
 */
export const createNativeMapBinding = <
  Handle extends MapRef &
    Record<Exclude<keyof Handle, ForwardedMapMethodKey>, never>,
  Props extends NativeMapInputs,
>(
  implementation: ComponentType<Props & RefAttributes<Handle>>,
  components: NativeComponents
): NativeMapBinding<Handle, Props> => {
  const RegistryContext = createContext<MapRegistry<Handle> | null>(null);

  /** Shares attached maps by ID with descendants of this provider. */
  const MapProvider = ({ children }: MapProviderProps): ReactElement => {
    const [registry] = useState(createMapRegistry<Handle>);
    return (
      <RegistryContext.Provider value={registry}>
        {children}
      </RegistryContext.Provider>
    );
  };

  /** Reads the enclosing map and any matching maps registered by the provider. */
  const useMap = (): MapCollection<Handle> => {
    const session = useContext(MapSessionContext);
    const registry = useContext(RegistryContext);
    const named = useSyncExternalStore(
      registry?.subscribe ?? noMapSubscription,
      registry?.getSnapshot ?? noMaps,
      noMaps
    );
    // The component bundle identifies the entry that created this handle.
    const current =
      session?.components === components ? (session.map as Handle) : undefined;
    return useMemo(() => {
      // Map IDs are arbitrary strings, including names inherited from Object.prototype.
      const maps: Record<string, Handle | undefined> = Object.create(null);
      for (const [id, map] of named ?? []) maps[id] = map;
      maps.current = current;
      return maps;
    }, [named, current]);
  };

  const NativeMap = forwardRef<Handle, Props>((props, ref) => {
    const registry = useContext(RegistryContext);
    if (registry && props.id === "current") {
      throw new Error('MapProvider reserves the map id "current".');
    }
    return (
      <MountedMap
        props={props as Props}
        implementation={implementation}
        components={components}
        forwardedRef={ref}
        register={registry?.register}
      />
    );
  });

  const Marker = forwardRef<MarkerRef, NativeMarkerProps>((props, ref) => {
    const { onClick, ...marker } = props;
    const anchor = useMarkerOptions(marker, components.backend);
    return (
      <components.Marker
        {...marker}
        anchor={anchor}
        ref={ref}
        onClick={
          onClick === undefined
            ? undefined
            : ({ lngLat, point }) =>
                onClick({
                  lngLat: nativeLngLat(lngLat),
                  ...(point === undefined ? {} : { point: nativePoint(point) }),
                })
        }
      />
    );
  });

  const Source = (props: SourceProps): ReactElement => {
    useSourceOptions(props);
    return <components.Source {...props} />;
  };

  return { Map: NativeMap, MapProvider, useMap, Marker, Source };
};

const noMaps = (): undefined => undefined;
