import type { NativeGeoJsonSource } from "../../contracts/native-types.js";
import { featuresFromWrapper } from "./feature-values.js";
import { finiteNumber } from "./wrapper-values.js";

/**
 * Associates a stable source handle with each source registration.
 *
 * @param findOwner - Looks up the getter for a mounted GeoJSON registration.
 * @param toClusterArgument - Converts the cluster ID to the wrapper's argument.
 * @returns A lookup for the current registration's cluster handle.
 */
export const createNativeClusterLookup = <ClusterArgument>(
  findOwner: (
    id: string
  ) => (() => WrapperClusterSource<ClusterArgument>) | undefined,
  toClusterArgument: (clusterId: number) => ClusterArgument
): ((id: string) => NativeGeoJsonSource | undefined) => {
  const handles = new WeakMap<
    () => WrapperClusterSource<ClusterArgument>,
    NativeGeoJsonSource
  >();
  return (id) => {
    const owner = findOwner(id);
    if (!owner) return undefined;
    const existing = handles.get(owner);
    if (existing) return existing;
    const handle = createNativeClusterSource(owner, toClusterArgument);
    handles.set(owner, handle);
    return handle;
  };
};

interface WrapperClusterSource<ClusterArgument> {
  readonly getClusterExpansionZoom: (
    cluster: ClusterArgument
  ) => Promise<unknown>;
  readonly getClusterChildren: (cluster: ClusterArgument) => Promise<unknown>;
  readonly getClusterLeaves: (
    cluster: ClusterArgument,
    limit: number,
    offset: number
  ) => Promise<unknown>;
}

const createNativeClusterSource = <ClusterArgument>(
  read: () => WrapperClusterSource<ClusterArgument>,
  toClusterArgument: (clusterId: number) => ClusterArgument
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

  // Async readers reject stale registrations and dispatch before the first await.
  const readExpansionZoom = async (clusterId: number) =>
    finiteNumber(
      await read().getClusterExpansionZoom(toClusterArgument(clusterId)),
      "Cluster expansion zoom"
    );
  function expansion(clusterId: number): ReturnType<typeof readExpansionZoom>;
  function expansion(
    clusterId: number,
    callback: Parameters<NativeGeoJsonSource["getClusterExpansionZoom"]>[1]
  ): NativeGeoJsonSource;
  function expansion(
    clusterId: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterExpansionZoom"]>[1]
  ) {
    return complete(readExpansionZoom(clusterId), callback);
  }

  const readChildren = async (clusterId: number) =>
    featuresFromWrapper(
      await read().getClusterChildren(toClusterArgument(clusterId)),
      "getClusterChildren"
    );
  function children(clusterId: number): ReturnType<typeof readChildren>;
  function children(
    clusterId: number,
    callback: Parameters<NativeGeoJsonSource["getClusterChildren"]>[1]
  ): NativeGeoJsonSource;
  function children(
    clusterId: number,
    callback?: Parameters<NativeGeoJsonSource["getClusterChildren"]>[1]
  ) {
    return complete(readChildren(clusterId), callback);
  }

  const readLeaves = async (clusterId: number, limit: number, offset: number) =>
    featuresFromWrapper(
      await read().getClusterLeaves(
        toClusterArgument(clusterId),
        limit,
        offset
      ),
      "getClusterLeaves"
    );
  function leaves(
    clusterId: number,
    limit: number,
    offset: number
  ): ReturnType<typeof readLeaves>;
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
    return complete(readLeaves(clusterId, limit, offset), callback);
  }
  const source = {
    type: "geojson",
    getClusterExpansionZoom: expansion,
    getClusterChildren: children,
    getClusterLeaves: leaves,
  } satisfies NativeGeoJsonSource;
  return source;
};
