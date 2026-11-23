import type { NativeGeoJsonSource } from "../../contracts/native-types.js";
import type { GeoJsonFeature } from "../../contracts/source-types.js";

/** Promise-based cluster operations bound to a GeoJSON registration. */
export interface NativeClusterSourceMethods {
  /** Reads the zoom at which the cluster expands. */
  getClusterExpansionZoom(clusterId: number): Promise<number>;
  /** Reads the cluster's child features at the next zoom. */
  getClusterChildren(clusterId: number): Promise<readonly GeoJsonFeature[]>;
  /** Reads a page of the cluster's leaf features. */
  getClusterLeaves(
    clusterId: number,
    limit: number,
    offset: number
  ): Promise<readonly GeoJsonFeature[]>;
}

/** Associates a stable source handle with each source registration. */
export const createNativeClusterLookup = <Source>(
  findOwner: (id: string) => (() => Source) | undefined,
  bind: (read: () => Source) => NativeClusterSourceMethods
): ((id: string) => NativeGeoJsonSource | undefined) => {
  const handles = new WeakMap<() => Source, NativeGeoJsonSource>();
  return (id) => {
    const owner = findOwner(id);
    if (!owner) return undefined;
    const existing = handles.get(owner);
    if (existing) return existing;
    const handle = createNativeClusterSource(bind(owner));
    handles.set(owner, handle);
    return handle;
  };
};

const createNativeClusterSource = (
  methods: NativeClusterSourceMethods
): NativeGeoJsonSource => {
  // Reference the same source for Mapbox-style chaining.
  const complete = <Value>(
    result: Promise<Value>,
    callback?: (error: Error | null, value?: Value) => void
  ) => {
    if (!callback) return result;
    void result.then(
      (value) => callback(null, value),
      (error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error)))
    );
    return source;
  };
  function expansion(
    clusterId: number
  ): ReturnType<NativeClusterSourceMethods["getClusterExpansionZoom"]>;
  function expansion(
    clusterId: number,
    callback: Parameters<NativeGeoJsonSource["getClusterExpansionZoom"]>[1]
  ): NativeGeoJsonSource;
  function expansion(
    clusterId: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterExpansionZoom"]>[1]
  ) {
    return complete(methods.getClusterExpansionZoom(clusterId), callback);
  }
  function children(
    clusterId: number
  ): ReturnType<NativeClusterSourceMethods["getClusterChildren"]>;
  function children(
    clusterId: number,
    callback: Parameters<NativeGeoJsonSource["getClusterChildren"]>[1]
  ): NativeGeoJsonSource;
  function children(
    clusterId: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterChildren"]>[1]
  ) {
    return complete(methods.getClusterChildren(clusterId), callback);
  }
  function leaves(
    clusterId: number,
    limit: number,
    offset: number
  ): ReturnType<NativeClusterSourceMethods["getClusterLeaves"]>;
  function leaves(
    clusterId: number,
    limit: number,
    offset: number,
    callback: Parameters<NativeGeoJsonSource["getClusterLeaves"]>[3]
  ): NativeGeoJsonSource;
  function leaves(
    clusterId: number,
    limit: number,
    offset: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterLeaves"]>[3]
  ) {
    return complete(
      methods.getClusterLeaves(clusterId, limit, offset),
      callback
    );
  }
  const source = {
    type: "geojson",
    getClusterExpansionZoom: expansion,
    getClusterChildren: children,
    getClusterLeaves: leaves,
  } satisfies NativeGeoJsonSource;
  return source;
};
