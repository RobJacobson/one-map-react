import {
  type ComponentType,
  forwardRef,
  useContext,
  useCallback,
  type ForwardedRef,
  type ReactElement,
  type Ref,
  type RefAttributes,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useActiveCallback } from "../adapters/shared/use-active-callback.js";
import type { Adapter } from "../contracts/adapter.js";
import type { MapRef } from "../contracts/camera-types.js";
import type { ClickEvent } from "../contracts/event-types.js";
import type { MapProps } from "../contracts/map-types.js";
import { type MapSession, MapSessionContext } from "./map-context.js";
import {
  type MapRegistry,
  useMapRegistry,
  useNamedMap,
  useSelectedAdapter,
} from "./map-setup.js";
import { useMapInteractions } from "./use-map-interactions.js";
import { useStableOptions } from "./use-stable-options.js";

/** Whether a shared map encloses the caller. */
export const useMapEnclosure = (): boolean =>
  useContext(MapSessionContext) !== null;

/**
 * Returns the enclosing common map ref.
 *
 * @returns A stable ref to the enclosing Map.
 * @throws When the enclosing Map is missing.
 */
export function useMap(): MapRef;
/**
 * Reads a named map under the same MapSetup and follows its attachment.
 *
 * @param id - Map ID, or undefined to read the enclosing Map.
 * @returns The map ref, or undefined while a named map is not attached.
 * @throws When named lookup lacks MapSetup, or id is omitted outside a Map.
 */
export function useMap(id: string | undefined): MapRef | undefined;
// Overloads keep enclosing access required and named access optional without casts.
export function useMap(id?: string): MapRef | undefined {
  const session = useContext(MapSessionContext);
  const named = useNamedMap(id);
  if (id !== undefined) return named;
  if (session) return session.map;
  throw new Error("useMap() must render inside Map.");
}

/** Shared map with scoped callbacks and named map attachment. */
// eslint-disable-next-line one-map/no-shadow-language-globals -- public Map API
export const Map = forwardRef<MapRef, MapProps>((props, forwardedRef) => {
  const adapter = useSelectedAdapter();
  return (
    <MountedMap
      props={props}
      implementation={adapter.Map}
      adapter={adapter}
      forwardedRef={forwardedRef}
    />
  );
});

type MountedMapOptions<Event extends ClickEvent = ClickEvent> = Pick<
  MapProps,
  | "id"
  | "onLoad"
  | "onMove"
  | "projection"
  | "terrain"
  | "interactiveLayerIds"
  | "onError"
> & { readonly onClick?: (event: Event) => void };

interface MountedMapProps<
  Handle extends MapRef,
  Props,
  Event extends ClickEvent,
> {
  readonly props: Props & MountedMapOptions<Event>;
  readonly implementation: ComponentType<
    Props & MountedMapOptions<Event> & RefAttributes<Handle>
  >;
  readonly adapter: Adapter;
  readonly forwardedRef: ForwardedRef<Handle>;
  readonly register?: MapRegistry<Handle>["register"];
}

/**
 * Owns the mounted renderer attachment and its common callbacks and resources.
 *
 * @param options - Concrete implementation, props, ref, and optional map access.
 * @returns The mounted map and its context.
 */
export const MountedMap = <
  Handle extends MapRef,
  Props,
  Event extends ClickEvent,
>({
  props,
  implementation: AdapterMap,
  adapter,
  forwardedRef,
  register,
}: MountedMapProps<Handle, Props, Event>): ReactElement => {
  validateMapOptions(props);

  useStableOptions("Map", {
    id: props.id,
  });
  const { mapRef, proxy, attach } = useMapAttachment(forwardedRef);
  const legacyRegistry = useMapRegistry();
  // The native provider owns unnamed maps under "default". Legacy lookup requires an ID.
  const registerMap = register ?? legacyRegistry?.register;
  const id = props.id ?? (register ? "default" : undefined);
  useLayoutEffect(
    () => (id === undefined ? undefined : registerMap?.(id, proxy)),
    [id, registerMap, proxy]
  );
  const [ready, setReady] = useState(false);
  const load = useActiveCallback(() => {
    setReady(true);
    props.onLoad?.();
  });
  const { move, click } = useMapInteractions(props, mapRef);
  const session = useMemo<MapSession>(
    () => ({ ref: mapRef, map: proxy, ready, adapter }),
    [mapRef, proxy, ready, adapter]
  );
  return (
    <MapSessionContext.Provider value={session}>
      <AdapterMap
        {...props}
        ref={attach}
        onLoad={load}
        onMove={move}
        onClick={(event) => {
          void click(event);
        }}
      />
    </MapSessionContext.Provider>
  );
};

/** Validates portable projection and terrain inputs before adapter rendering. */
const validateMapOptions = (
  props: Pick<MapProps, "projection" | "terrain">
): void => {
  if (
    props.projection !== undefined &&
    props.projection !== "mercator" &&
    props.projection !== "globe"
  ) {
    throw new RangeError("Projection must be mercator or globe.");
  }

  if (
    props.terrain !== undefined &&
    props.terrain !== null &&
    (typeof props.terrain.source !== "string" ||
      props.terrain.source.trim() === "" ||
      (props.terrain.exaggeration !== undefined &&
        (!Number.isFinite(props.terrain.exaggeration) ||
          props.terrain.exaggeration < 0)))
  ) {
    throw new RangeError(
      "Terrain requires a nonempty source and finite nonnegative exaggeration."
    );
  }
};

/** Owns the forwarded ref and the proxy retained by map access hooks. */
const useMapAttachment = <Handle extends MapRef>(forwardedRef: Ref<Handle>) => {
  const mapRef = useRef<Handle | null>(null);
  const [proxy] = useState(
    () =>
      // Each exposed method dispatches through the attached handle of this type.
      new Proxy({} as Handle, {
        get: (_target, key) => {
          if (key === "then") return undefined;
          return (...args: unknown[]) => {
            const map = mapRef.current;
            if (!map) {
              if (key === "getSource") return undefined;
              return Promise.reject(new Error("Map is not attached."));
            }
            const method = Reflect.get(map, key) as (
              ...args: unknown[]
            ) => unknown;
            return method.apply(map, args);
          };
        },
      })
  );
  const attach = useCallback(
    (map: Handle | null) => {
      mapRef.current = map;
      const cleanup = assignMapRef(forwardedRef, map);
      if (typeof cleanup === "function") {
        return () => {
          mapRef.current = null;
          cleanup();
        };
      }
    },
    [forwardedRef]
  );
  return { mapRef, proxy, attach };
};

/** Forwards a renderer attachment, including the cleanup returned by a React 19 ref. */
const assignMapRef = <Handle extends MapRef>(
  ref: Ref<Handle>,
  map: Handle | null
) => {
  if (typeof ref === "function") return ref(map);
  if (ref) ref.current = map;
};
