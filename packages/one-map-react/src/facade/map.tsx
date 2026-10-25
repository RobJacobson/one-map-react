import {
  forwardRef,
  useContext,
  useImperativeHandle,
  type ForwardedRef,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MapRef } from "../contracts/camera-types.js";
import type { MapProps } from "../contracts/map-types.js";
import { type MapSession, MapSessionContext } from "./map-context.js";
import {
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
 * @throws When MapSetup or the enclosing Map is missing.
 */
export function useMap(): MapRef;
/**
 * Reads a named map under the same MapSetup and follows its attachment.
 *
 * @param id - Map ID, or undefined to read the enclosing Map.
 * @returns The map ref, or undefined while a named map is not attached.
 * @throws When MapSetup is missing, or id is omitted outside a Map.
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

/** Shared map with scoped UI notifications and named map attachment. */
// eslint-disable-next-line one-map/no-shadow-language-globals -- public Map API
export const Map = forwardRef<MapRef, MapProps>((props, forwardedRef) => {
  const { Map: AdapterMap, backend } = useSelectedAdapter();
  validateMapOptions(props);

  useStableOptions("Map", {
    id: props.id,
  });
  const { mapRef, proxy } = useMapAttachment(props.id, forwardedRef);
  const [ready, setReady] = useState(false);
  const { move, subscribe, registerSource, dispatchSource, click } =
    useMapInteractions(props, backend, mapRef);

  const cameraControlled = props.viewState !== undefined;
  const session = useMemo<MapSession>(
    () => ({
      ref: mapRef,
      map: proxy,
      ready,
      cameraControlled,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      subscribe,
      registerSource,
      dispatchSource,
    }),
    [
      mapRef,
      proxy,
      ready,
      cameraControlled,
      props.minZoom,
      props.maxZoom,
      subscribe,
      registerSource,
      dispatchSource,
    ]
  );
  return (
    <MapSessionContext.Provider value={session}>
      <AdapterMap
        {...props}
        ref={mapRef}
        onLoad={() => {
          setReady(true);
          props.onLoad?.();
        }}
        onMove={move}
        onClick={(event) => {
          void click(event);
        }}
      />
    </MapSessionContext.Provider>
  );
});

/** Validates portable projection and terrain inputs before adapter rendering. */
const validateMapOptions = (props: MapProps): void => {
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

/** Owns the attached ref, its retained proxy, and named registration. */
const useMapAttachment = (
  id: string | undefined,
  forwardedRef: ForwardedRef<MapRef>
) => {
  const registry = useMapRegistry();
  const mapRef = useRef<MapRef | null>(null);
  // eslint-disable-next-line react/refs -- The lazy initializer only captures the ref; commands read it after attachment.
  const [proxy] = useState(() => createDeferredMapRef(mapRef));
  useImperativeHandle(forwardedRef, () => mapRef.current ?? proxy);
  useLayoutEffect(
    () => (id === undefined ? undefined : registry.register(id, proxy)),
    [id, registry, proxy]
  );
  return { mapRef, proxy };
};

const createDeferredMapRef = (ref: { current: MapRef | null }): MapRef =>
  new Proxy({} as MapRef, {
    get: (_target, key: keyof MapRef | "then") => {
      if (key === "then") return undefined;
      return (...args: unknown[]) => {
        const map = ref.current;
        if (!map) return Promise.reject(new Error("Map is not attached."));
        const method = map[key] as (...args: unknown[]) => unknown;
        return method(...args);
      };
    },
  });
