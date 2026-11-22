import type { NativeGeoJsonSource } from "../../contracts/native-types.js";
import type { ClusterQueryMethods } from "../../contracts/query-types.js";

/** Adds the desktop source methods to dispatch functions already bound to one owner. */
export const createNativeClusterSource = (
  sourceId: string,
  methods: ClusterQueryMethods
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
    zoomId: number
  ): ReturnType<ClusterQueryMethods["getClusterExpansionZoom"]>;
  function expansion(
    zoomId: number,
    callback: Parameters<NativeGeoJsonSource["getClusterExpansionZoom"]>[1]
  ): NativeGeoJsonSource;
  function expansion(
    zoomId: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterExpansionZoom"]>[1]
  ) {
    return complete(
      methods.getClusterExpansionZoom(sourceId, zoomId),
      callback
    );
  }
  function children(
    clusterId: number
  ): ReturnType<ClusterQueryMethods["getClusterChildren"]>;
  function children(
    clusterId: number,
    callback: Parameters<NativeGeoJsonSource["getClusterChildren"]>[1]
  ): NativeGeoJsonSource;
  function children(
    clusterId: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterChildren"]>[1]
  ) {
    return complete(methods.getClusterChildren(sourceId, clusterId), callback);
  }
  function leaves(
    clusterId: number,
    limit: number,
    offset: number
  ): ReturnType<ClusterQueryMethods["getClusterLeaves"]>;
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
      methods.getClusterLeaves(sourceId, clusterId, limit, offset),
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

/** Associates a stable source handle with each source registration. */
export const createNativeClusterLookup = <Source>(
  findOwner: (id: string) => (() => Source) | undefined,
  bind: (read: (id: string) => Source) => ClusterQueryMethods
): ((id: string) => NativeGeoJsonSource | undefined) => {
  const handles = new WeakMap<() => Source, NativeGeoJsonSource>();
  return (id) => {
    const owner = findOwner(id);
    if (!owner) return undefined;
    const existing = handles.get(owner);
    if (existing) return existing;
    const handle = createNativeClusterSource(id, bind(owner));
    handles.set(owner, handle);
    return handle;
  };
};
