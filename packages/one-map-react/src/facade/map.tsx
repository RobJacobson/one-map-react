import {
  forwardRef,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MapRef } from "../contracts/camera-types.js";
import type {
  ClickEvent,
  MoveEvent,
  SourceClickEvent,
} from "../contracts/event-types.js";
import type { MapProps } from "../contracts/map-types.js";
import type { ControlPosition } from "../contracts/ui-types.js";
import {
  type MapSession,
  MapSessionContext,
  type NativeOverlay,
  NativeOverlayContext,
  type OrnamentName,
} from "./map-context.js";
import {
  useMapRegistry,
  useNamedMap,
  useSelectedAdapter,
} from "./map-setup.js";
import { useStableOptions } from "./use-stable-options.js";

/** Whether a shared map encloses the caller. */
export const useMapEnclosure = (): boolean =>
  useContext(MapSessionContext) !== null;

/** Returns the enclosing ref or a named map under the same MapSetup. */
export const useMap = (id?: string): MapRef => {
  const session = useContext(MapSessionContext);
  const named = useNamedMap(id);
  const map = id === undefined ? session?.map : named;
  if (map) return map;
  if (id !== undefined)
    throw new Error(`Map "${id}" is not registered in this MapSetup.`);
  if (!session) throw new Error("useMap() must render inside Map.");
  return createDeferredMapRef(session.ref);
};

/** Shared map with scoped UI notifications and named map attachment. */
// biome-ignore lint/suspicious/noShadowRestrictedNames: public Map API
export const Map = forwardRef<MapRef, MapProps>((props, forwardedRef) => {
  const { Map: AdapterMap, backend } = useSelectedAdapter();
  const registry = useMapRegistry();
  const overlayHostName = useId();
  useStableOptions("Map", {
    id: props.id,
    captureEnabled: props.captureEnabled ?? false,
  });
  const mapRef = useRef<MapRef | null>(null);
  const [ready, setReady] = useState(false);
  const [observedCamera, setCamera] = useState(props.initialViewState);
  const [gestureLocked, setGestureLocked] = useState(false);
  const [nativeLayout, storeNativeLayout] =
    useState<MapSession["nativeLayout"]>();
  const setNativeLayout = useCallback((width: number, height: number): void => {
    storeNativeLayout((previous) =>
      previous?.width === width && previous.height === height
        ? previous
        : { width, height }
    );
  }, []);
  const [ornaments, setOrnaments] = useState<MapSession["ornaments"]>({});
  const [overlays, setOverlays] = useState<ReadonlyMap<string, NativeOverlay>>(
    new globalThis.Map()
  );
  const listeners = useRef({
    click: new Set<(event: ClickEvent | MoveEvent) => void>(),
    move: new Set<(event: ClickEvent | MoveEvent) => void>(),
  });
  const sources = useRef(
    new globalThis.Map<
      string,
      {
        readonly callback: (event: SourceClickEvent) => void;
        readonly attachment: object;
      }
    >()
  );
  const propsRef = useRef(props);
  const active = useRef(true);
  const generation = useRef(0);
  const proxy = useMemo(() => createDeferredMapRef(mapRef), []);
  useImperativeHandle(forwardedRef, () => mapRef.current ?? proxy);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  useLayoutEffect(() => {
    active.current = true;
    const unregister =
      props.id === undefined ? undefined : registry.register(props.id, proxy);
    return () => {
      active.current = false;
      generation.current += 1;
      unregister?.();
      sources.current.clear();
      listeners.current.click.clear();
      listeners.current.move.clear();
    };
  }, [props.id, registry, proxy]);
  const emit = useCallback(
    (event: "click" | "move", payload: ClickEvent | MoveEvent) => {
      for (const listener of listeners.current[event]) listener(payload);
    },
    []
  );
  const reportClick = useCallback(
    (event: ClickEvent) => {
      emit("click", event);
      propsRef.current.onClick?.(event);
    },
    [emit]
  );
  const queryHit = useCallback(
    async (event: ClickEvent): Promise<ClickEvent> => {
      const layers = propsRef.current.interactiveLayerIds;
      if (!layers) return event;
      const map = mapRef.current;
      if (!map) throw new Error("Map is not attached.");
      return {
        ...event,
        features: await map.queryRenderedFeatures(event.point, { layers }),
      };
    },
    []
  );
  const dispatchSource = useCallback(
    (id: string, event: ClickEvent) => {
      let stopped = false;
      const source = sources.current.get(id);
      source?.callback({
        ...event,
        sourceId: id,
        stopPropagation: () => {
          stopped = true;
        },
      });
      if (stopped) return;
      const currentGeneration = generation.current;
      void queryHit(event)
        .then((hit) => {
          if (
            active.current &&
            generation.current === currentGeneration &&
            sources.current.get(id)?.attachment === source?.attachment
          )
            reportClick(hit);
        })
        .catch((error: unknown) => {
          if (
            active.current &&
            generation.current === currentGeneration &&
            sources.current.get(id)?.attachment === source?.attachment
          )
            propsRef.current.onError?.({ error });
        });
    },
    [queryHit, reportClick]
  );
  const setOrnament = useCallback(
    (name: OrnamentName, options: Readonly<Record<string, unknown>> | null) => {
      setOrnaments((current) => {
        const next = { ...current };
        if (options === null) delete next[name];
        else next[name] = options;
        return next;
      });
    },
    []
  );
  const setOverlay = useCallback(
    (id: string, position: ControlPosition | null, height?: number) => {
      setOverlays((current) => {
        const previous = current.get(id);
        if (position === null && !previous) return current;
        const nextHeight = height ?? previous?.height ?? 0;
        if (previous?.position === position && previous.height === nextHeight)
          return current;
        const next = new globalThis.Map(current);
        if (position === null) next.delete(id);
        else next.set(id, { id, height: nextHeight, position });
        return next;
      });
    },
    []
  );
  const registerSource = useCallback(
    (
      id: string,
      callback: (event: SourceClickEvent) => void,
      attachment: object
    ) => {
      const registration = { callback, attachment };
      sources.current.set(id, registration);
      return () => {
        if (sources.current.get(id) === registration)
          sources.current.delete(id);
      };
    },
    []
  );
  const subscribe = useCallback(
    (
      event: "click" | "move",
      listener: (event: ClickEvent | MoveEvent) => void
    ) => {
      listeners.current[event].add(listener);
      return () => {
        listeners.current[event].delete(listener);
      };
    },
    []
  );
  const nativeLocationFollowing = selectedLocationFollowing(props);
  const session = useMemo<MapSession>(
    () => ({
      ref: mapRef,
      map: proxy,
      ready,
      cameraControlled: props.viewState !== undefined,
      nativeLocationFollowing,
      viewState: props.viewState ?? observedCamera,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      gestureLocked,
      nativeLayout,
      setNativeLayout,
      overlayHostName,
      ornaments,
      emit,
      subscribe,
      requestGestureLock: setGestureLocked,
      setOrnament,
      setOverlay,
      registerSource,
      dispatchSource,
    }),
    [
      ready,
      props.viewState,
      nativeLocationFollowing,
      observedCamera,
      props.minZoom,
      props.maxZoom,
      gestureLocked,
      nativeLayout,
      setNativeLayout,
      overlayHostName,
      ornaments,
      emit,
      dispatchSource,
      proxy,
      setOrnament,
      setOverlay,
      registerSource,
      subscribe,
    ]
  );
  const click = async (event: ClickEvent) => {
    const currentGeneration = generation.current;
    const sourceAttachments = new globalThis.Map(sources.current);
    let hit = event;
    let sourceHit = event;
    try {
      if (!backend.endsWith("native") && sources.current.size > 0) {
        const map = mapRef.current;
        if (!map) throw new Error("Map is not attached.");
        // Source activation owns its hit region independently of the map's
        // interactiveLayerIds. Native wrappers already perform this query.
        sourceHit = {
          ...event,
          features: await map.queryRenderedFeatures(event.point),
        };
      }
      if (propsRef.current.interactiveLayerIds) hit = await queryHit(event);
    } catch (error) {
      if (active.current && generation.current === currentGeneration)
        propsRef.current.onError?.({ error });
      return;
    }
    if (!active.current || generation.current !== currentGeneration) return;
    let stopped = false;
    const topSource = sourceHit.features
      ?.map((feature) => (feature as { source?: string }).source)
      .find((id) => id !== undefined && sourceAttachments.has(id));
    if (topSource) {
      if (
        sources.current.get(topSource)?.attachment !==
        sourceAttachments.get(topSource)?.attachment
      )
        return;
      const features = sourceHit.features?.filter(
        (feature) => (feature as { source?: string }).source === topSource
      );
      sources.current.get(topSource)?.callback({
        ...sourceHit,
        features,
        sourceId: topSource,
        stopPropagation: () => {
          stopped = true;
        },
      });
      if (!propsRef.current.interactiveLayerIds) hit = { ...hit, features };
    }
    if (!stopped) reportClick(hit);
  };
  return (
    <MapSessionContext.Provider value={session}>
      <NativeOverlayContext.Provider value={[...overlays.values()]}>
        <AdapterMap
          {...props}
          ref={mapRef}
          interactive={gestureLocked ? false : props.interactive}
          onLoad={() => {
            setReady(true);
            props.onLoad?.();
          }}
          onMove={(event) => {
            setCamera(event.viewState);
            emit("move", event);
            props.onMove?.(event);
          }}
          onClick={(event) => {
            void click(event);
          }}
        />
      </NativeOverlayContext.Provider>
    </MapSessionContext.Provider>
  );
});

const createDeferredMapRef = (ref: { current: MapRef | null }): MapRef =>
  new Proxy({} as MapRef, {
    get:
      (_target, key: keyof MapRef) =>
      (...args: unknown[]) => {
        const map = ref.current;
        if (!map) return Promise.reject(new Error("Map is not attached."));
        const method = map[key] as (...args: unknown[]) => unknown;
        return method(...args);
      },
  });

/** Only reports the selected follow request; adapter types own its fields. */
const selectedLocationFollowing = (props: MapProps): boolean => {
  if (
    !("locationOptions" in props) ||
    !props.locationOptions ||
    typeof props.locationOptions !== "object"
  )
    return false;
  const options = props.locationOptions as {
    followUserLocation?: boolean;
    trackUserLocation?: unknown;
  };
  return (
    options.followUserLocation === true ||
    options.trackUserLocation !== undefined
  );
};
