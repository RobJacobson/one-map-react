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

type ClusterArguments = {
  1: [clusterId: number];
  3: [clusterId: number, limit: number, offset: number];
};

type ClusterCallback<Value> = (error: Error | null, value?: Value) => void;

type ClusterCall<Count extends keyof ClusterArguments, Value> =
  | ClusterArguments[Count]
  | [...ClusterArguments[Count], callback: ClusterCallback<Value>];

const createNativeClusterSource = <ClusterArgument>(
  read: () => WrapperClusterSource<ClusterArgument>,
  toClusterArgument: (clusterId: number) => ClusterArgument
): NativeGeoJsonSource => {
  const withCallback = <Count extends keyof ClusterArguments, Value>(
    callbackIndex: Count,
    query: (args: ClusterCall<Count, Value>) => Promise<Value>
  ) => {
    function run(...args: ClusterArguments[Count]): Promise<Value>;
    function run(
      ...args: [...ClusterArguments[Count], callback: ClusterCallback<Value>]
    ): NativeGeoJsonSource;
    function run(
      ...args: ClusterCall<Count, Value>
    ): Promise<Value> | NativeGeoJsonSource {
      // Start the query before a source replacement can invalidate the registration.
      const result = query(args);
      const callback = args[callbackIndex];
      if (typeof callback !== "function") return result;
      void result.then(
        (value) => callback(null, value),
        (error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error)))
      );
      return source;
    }
    return run;
  };

  const source = {
    type: "geojson",
    getClusterExpansionZoom: withCallback(1, async ([clusterId]) =>
      finiteNumber(
        await read().getClusterExpansionZoom(toClusterArgument(clusterId)),
        "Cluster expansion zoom"
      )
    ),
    getClusterChildren: withCallback(1, async ([clusterId]) =>
      featuresFromWrapper(
        await read().getClusterChildren(toClusterArgument(clusterId)),
        "getClusterChildren"
      )
    ),
    getClusterLeaves: withCallback(3, async ([clusterId, limit, offset]) =>
      featuresFromWrapper(
        await read().getClusterLeaves(
          toClusterArgument(clusterId),
          limit,
          offset
        ),
        "getClusterLeaves"
      )
    ),
  } satisfies NativeGeoJsonSource;
  return source;
};
