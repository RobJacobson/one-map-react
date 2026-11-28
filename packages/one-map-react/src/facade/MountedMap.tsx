import {
  type ComponentType,
  useCallback,
  type ForwardedRef,
  type ReactElement,
  type Ref,
  type RefAttributes,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { missingMapError } from "../adapters/index.js";
import { useActiveCallback } from "../adapters/shared/use-active-callback.js";
import type { MapRef } from "../contracts/camera-types.js";
import type {
  NativeMapInputs,
  NativeMapRef,
} from "../contracts/native-types.js";
import {
  type MapSession,
  MapSessionContext,
  type NativeComponents,
} from "./map-context.js";
import type { MapRegistry } from "./map-registry.js";
import { useMapInteractions } from "./use-map-interactions.js";
import { useStableOptions } from "./use-stable-options.js";

interface MountedMapProps<
  Handle extends MapRef &
    Record<Exclude<keyof Handle, ForwardedMapMethodKey>, never>,
  Props extends NativeMapInputs,
> {
  readonly props: Props;
  readonly implementation: ComponentType<Props & RefAttributes<Handle>>;
  readonly components: NativeComponents;
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
  Handle extends MapRef &
    Record<Exclude<keyof Handle, ForwardedMapMethodKey>, never>,
  Props extends NativeMapInputs,
>({
  props,
  implementation: RendererMap,
  components,
  forwardedRef,
  register,
}: MountedMapProps<Handle, Props>): ReactElement => {
  validateMapOptions(props);

  useStableOptions("Map", {
    id: props.id,
  });
  const mapRef = useRef<Handle | null>(null);
  const { move, click, syncAttachment } = useMapInteractions(props, mapRef);
  const { handle, attach } = useMapAttachment(
    forwardedRef,
    mapRef,
    syncAttachment
  );
  const id = props.id;
  useLayoutEffect(() => register?.(id, handle), [id, register, handle]);
  const [ready, setReady] = useState(false);
  const load = useActiveCallback(() => {
    setReady(true);
    props.onLoad?.();
  });
  const handlesClick =
    props.onClick !== undefined ||
    (props.onError !== undefined && props.interactiveLayerIds !== undefined);
  const session = useMemo<MapSession>(
    () => ({ ref: mapRef, map: handle, ready, components }),
    [mapRef, handle, ready, components]
  );
  return (
    <MapSessionContext.Provider value={session}>
      <RendererMap
        {...props}
        ref={attach}
        onLoad={load}
        onMove={move}
        onClick={
          handlesClick
            ? (event) => {
                void click(event);
              }
            : undefined
        }
      />
    </MapSessionContext.Provider>
  );
};

/** Validates portable options and rejects desktop-only inputs before adapter rendering. */
const validateMapOptions = (props: NativeMapInputs): void => {
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

  if (props.reuseMaps === true) {
    throw new Error(
      "reuseMaps is not available on native maps. Remounting creates a new map."
    );
  }

  if (props.gl !== undefined) {
    throw new Error(
      "gl is a web drawing context and is not available on native maps."
    );
  }

  for (const name of nativeDesktopOptions) {
    if (props[name] !== undefined) {
      throw new Error(`${name} is not available on native maps.`);
    }
  }
};

const nativeDesktopOptions = [
  "scrollZoom",
  "doubleClickZoom",
  "dragRotate",
  "boxZoom",
  "keyboard",
  "cooperativeGestures",
  "clickTolerance",
  "hash",
  "onDblClick",
  "onContextMenu",
  "onMouseDown",
  "onMouseUp",
  "onMouseMove",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseOver",
  "onMouseOut",
  "onWheel",
  "onDrag",
  "onDragStart",
  "onDragEnd",
  "onTouchStart",
  "onTouchMove",
  "onTouchEnd",
  "onTouchCancel",
  "onResize",
] as const;

const nativeMapMethods = {
  getSource: true,
  getWrapperMap: true,
  queryTerrainElevation: true,
  jumpTo: true,
  easeTo: true,
  flyTo: true,
  fitBounds: true,
  zoomTo: true,
  stop: true,
  getCenter: true,
  getZoom: true,
  getBearing: true,
  getPitch: true,
  getPadding: true,
  getBounds: true,
  getMinZoom: true,
  getMaxZoom: true,
  getMaxBounds: true,
  project: true,
  unproject: true,
  queryRenderedFeatures: true,
  querySourceFeatures: true,
  setFeatureState: true,
  getFeatureState: true,
  removeFeatureState: true,
  resize: true,
} satisfies Record<keyof NativeMapRef | "getWrapperMap", true>;

export type ForwardedMapMethodKey = keyof typeof nativeMapMethods;

/** Owns the forwarded ref and the forwarding handle retained by map access hooks. */
const useMapAttachment = <
  Handle extends MapRef &
    Record<Exclude<keyof Handle, ForwardedMapMethodKey>, never>,
>(
  forwardedRef: Ref<Handle>,
  mapRef: RefObject<Handle | null>,
  syncAttachment: () => void
) => {
  const [handle] = useState(() => {
    const forwarding: Record<string, (...args: unknown[]) => unknown> = {};
    for (const key of Object.keys(
      nativeMapMethods
    ) as ForwardedMapMethodKey[]) {
      forwarding[key] = (...args: unknown[]) => {
        const map = mapRef.current;
        if (!map) {
          if (key === "getSource") return undefined;
          return Promise.reject(missingMapError());
        }
        const method: unknown = Reflect.get(map, key);
        if (typeof method !== "function") {
          if (key === "getSource") return undefined;
          return Promise.reject(
            new Error(`Map method "${key}" is not available.`)
          );
        }
        return Reflect.apply(method, map, args);
      };
    }
    return Object.freeze(forwarding) as unknown as Handle;
  });
  const attach = useCallback(
    (map: Handle | null) => {
      const updateAttachment = (attached: Handle | null): void => {
        mapRef.current = attached;
        if (attached) syncAttachment();
        // React also detaches and reattaches the same handle when its ref changes.
        else void Promise.resolve().then(syncAttachment);
      };
      updateAttachment(map);
      const cleanup = assignMapRef(forwardedRef, map);
      if (typeof cleanup === "function") {
        return () => {
          updateAttachment(null);
          cleanup();
        };
      }
    },
    [forwardedRef, mapRef, syncAttachment]
  );
  return { handle, attach };
};

/** Forwards a renderer attachment, including the cleanup returned by a React 19 ref. */
const assignMapRef = <Handle extends MapRef>(
  ref: Ref<Handle>,
  map: Handle | null
) => {
  if (typeof ref === "function") return ref(map);
  if (ref) ref.current = map;
};
