import { useLayoutEffect, useRef, useState } from "react";

import { validatePosition } from "../adapters/shared/location-values.js";
import { useOptionalNativeMapPresentation } from "../adapters/shared/native-map-presentation.js";
import type {
  GeolocateControlProps,
  GeolocationPosition,
} from "../contracts/ui-types.js";
import { type MapSession, useMapSession } from "./map-context.js";
import { useOptionalSetupServices } from "./map-setup.js";

/** One control's acquired resources and latest observed location. */
interface LocationControlRequest {
  /** Retires callbacks whenever provider, mode, or map attachment changes. */
  generation: number;
  pending: boolean;
  following: boolean;
  active: boolean;
  dispatching: boolean;
  latest?: GeolocationPosition;
  abort?: AbortController;
  release?: () => void;
}

interface LocationControlSnapshot {
  readonly props: GeolocateControlProps;
  readonly session: MapSession;
}

/** Coordinates only control-owned acquisition and follow interruption. */
export const useGeolocationControl = (
  props: GeolocateControlProps,
  cameraMethod: "easeTo" | "flyTo" = "easeTo"
) => {
  const session = useMapSession();
  const presentation = useOptionalNativeMapPresentation();
  const services = useOptionalSetupServices();
  const provider = props.locationProvider ?? services?.location;
  const [failure, setFailure] = useState<Error>();
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState<GeolocationPosition>();
  const request = useRef<LocationControlRequest>({
    generation: 0,
    pending: false,
    following: false,
    active: false,
    dispatching: false,
  });
  const current = useRef({ props, session });

  useLayoutEffect(() => {
    current.current = { props, session };
  });
  useLayoutEffect(() => {
    const owner = request.current;
    owner.active = true;
    return () => {
      owner.active = false;
      owner.generation += 1;
      owner.abort?.abort();
      owner.release?.();
      owner.release = undefined;
    };
  }, []);
  // Provider, mode, and attachment changes retire acquisition even though
  // cleanup itself does not read those inputs.
  useLayoutEffect(() => {
    const owner = request.current;
    owner.generation += 1;
    owner.abort?.abort();
    owner.release?.();
    owner.release = undefined;
    owner.pending = false;
    owner.following = false;
    owner.latest = undefined;
    owner.dispatching = false;
    // eslint-disable-next-line react/set-state-in-effect -- Provider, mode or attachment changes must clear control-owned pending/location UI before paint.
    setPending(false);
    setPosition(undefined);
  }, [
    provider,
    props.getCurrentPosition,
    props.trackUserLocation,
    session.ready,
    session.ref,
  ]);
  const subscribe = session.subscribe;
  useLayoutEffect(
    () =>
      subscribe("move", (event) => {
        if ("origin" in event && event.origin === "user")
          request.current.following = false;
      }),
    [subscribe]
  );

  if (
    props.trackUserLocation &&
    (session.cameraControlled || presentation?.nativeLocationFollowing)
  )
    throw new Error(
      "Location follow conflicts with viewState or selected native camera follow."
    );
  if (
    props.getCurrentPosition &&
    (props.locationProvider || props.trackUserLocation)
  )
    throw new Error(
      "An injected location provider supports one-shot location only; streaming requires locationProvider."
    );
  if (!props.getCurrentPosition && !provider)
    throw new Error(
      "GeolocateControl requires a location service or getCurrentPosition."
    );

  const reportFailure = (error: unknown): void => {
    if (current.current.props.onError) current.current.props.onError(error);
    else
      setFailure(
        error instanceof Error ? error : new Error("Location control failed.")
      );
  };
  if (failure) throw failure;

  /** Shares guarded acquisition cleanup with resumed camera failures. */
  const retireRequest = (error: unknown, generation: number): void => {
    const owner = request.current;
    if (!owner.active || generation !== owner.generation) return;

    owner.generation += 1;
    owner.abort?.abort();
    owner.pending = false;
    owner.following = false;
    owner.dispatching = false;
    owner.release?.();
    owner.release = undefined;
    // Provider cleanup can synchronously unmount this control.
    if (!owner.active) return;
    setPending(false);
    reportFailure(error);
  };

  const activate = (): void => {
    const owner = request.current;
    if (!owner.active || !current.current.session.ready || owner.pending)
      return;
    owner.following = true;
    if (owner.release && owner.latest) {
      const generation = owner.generation;
      void center(owner.latest, generation).catch((error) =>
        retireRequest(error, generation)
      );
      return;
    }
    owner.pending = true;
    setPending(true);
    const generation = ++owner.generation;
    owner.dispatching = false;
    const controller = new AbortController();
    owner.abort = controller;
    const fail = (error: unknown): void => retireRequest(error, generation);
    const receive = (value: GeolocationPosition): void => {
      if (
        !owner.active ||
        generation !== owner.generation ||
        !current.current.session.ready
      )
        return;
      let validated: GeolocationPosition;
      try {
        validated = validatePosition(value);
      } catch (error) {
        fail(error);
        return;
      }
      owner.pending = false;
      owner.latest = validated;
      setPending(false);
      if (current.current.props.trackUserLocation) setPosition(validated);
      current.current.props.onGeolocate?.(validated);
      if (!owner.active || generation !== owner.generation) return;
      if (owner.following) void center(validated, generation).catch(fail);
    };
    const once = current.current.props.getCurrentPosition;
    if (once) {
      try {
        void once().then(receive, fail);
      } catch (error) {
        fail(error);
      }
      return;
    }
    if (!provider) return;
    try {
      if (!current.current.props.trackUserLocation) {
        void provider
          .getCurrentPosition({ signal: controller.signal })
          .then(receive, fail);
        return;
      }
      const release = provider.watchPosition(receive, fail, {
        signal: controller.signal,
      });
      if (owner.active) {
        if (generation === owner.generation) {
          if (owner.following) {
            owner.release = release;
            return;
          }
        }
      }
      release();
    } catch (error) {
      fail(error);
    }
  };

  const center = (
    value: GeolocationPosition,
    generation: number
  ): Promise<void> =>
    centerLocation(request.current, current, cameraMethod, value, generation);

  return { pending, position, activate };
};

/** Serializes camera updates while retaining committed inputs and generation-owned cleanup. */
const centerLocation = async (
  owner: LocationControlRequest,
  current: { readonly current: LocationControlSnapshot },
  cameraMethod: "easeTo" | "flyTo",
  value: GeolocationPosition,
  generation: number
): Promise<void> => {
  if (
    owner.dispatching ||
    !owner.active ||
    !owner.following ||
    generation !== owner.generation
  )
    return;
  const map = current.current.session.ref.current;
  if (!map) throw new Error("Geolocation target map is detached.");
  owner.dispatching = true;
  let next: GeolocationPosition | undefined = value;
  try {
    while (
      next &&
      owner.active &&
      owner.following &&
      generation === owner.generation &&
      current.current.session.ref.current === map
    ) {
      const dispatched: GeolocationPosition = next;
      await map[cameraMethod]({
        center: dispatched.lngLat,
        zoom: current.current.props.zoom ?? 14,
      });
      next =
        current.current.props.trackUserLocation && owner.latest !== dispatched
          ? owner.latest
          : undefined;
    }
  } finally {
    if (generation === owner.generation) owner.dispatching = false;
  }
};
