import type { MapErrorEvent, MapRef, MoveEvent } from "one-map-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface LifecycleSmokeOptions {
  readonly mapRef: { readonly current: MapRef | null };
  readonly failureStyleUrl: string;
}

interface LifecycleSmoke {
  readonly generation: number;
  readonly mapStyle: string | undefined;
  readonly status: string;
  readonly onLoad: () => void;
  readonly onStyleLoad: () => void;
  readonly onError: (event: MapErrorEvent) => void;
  readonly onMove: (event: MoveEvent) => void;
  readonly flyNorth: () => void;
  readonly remount: () => void;
  readonly failStyle: () => void;
}

type SmokePhase =
  | "await-load"
  | "await-north"
  | "await-remount"
  | "await-failure"
  | "done";

interface SmokeCounts {
  loads: number;
  styles: number;
  errors: number;
}

/**
 * Drives the native TF03 smoke: load, fly, remount, then a bad style.
 *
 * Remount is expected to create a new map. The failure step records the
 * `onError` payload when the wrapper delivers one. Mapbox Android's pinned
 * wrapper does not deliver that callback, so this sequence ends on a timeout
 * with `errors=0` there.
 */
export const useLifecycleSmoke = ({
  mapRef,
  failureStyleUrl,
}: LifecycleSmokeOptions): LifecycleSmoke => {
  const counts = useRef<SmokeCounts>({ loads: 0, styles: 0, errors: 0 });
  const phaseRef = useRef<SmokePhase>("await-load");
  const errorNote = useRef("none");
  const remountCamera = useRef("pending");
  const lastCamera = useRef("pending");
  const [generation, setGeneration] = useState(0);
  const [useFailureStyle, setUseFailureStyle] = useState(false);
  const [phase, setPhase] = useState<SmokePhase>("await-load");
  const [status, setStatus] = useState(
    "TF03 loads=0 styles=0 errors=0 error=none remount=pending phase=await-load"
  );
  const beginFailureRef = useRef<(camera: string) => void>(() => {});
  const publishRef = useRef<() => void>(() => {});

  const publish = () => {
    const next = statusLine(
      counts.current,
      errorNote.current,
      remountCamera.current,
      phaseRef.current
    );

    console.log(next);
    setStatus(next);
  };

  const beginFailure = (camera: string) => {
    if (phaseRef.current !== "await-remount") {
      return;
    }

    remountCamera.current = camera;
    phaseRef.current = "await-failure";
    setPhase("await-failure");
    setUseFailureStyle(true);
    setGeneration((current) => current + 1);
    publish();
  };

  useLayoutEffect(() => {
    beginFailureRef.current = beginFailure;
    publishRef.current = publish;
  });

  const flyNorth = () => {
    void mapRef.current
      ?.flyTo({ center: [-122.32, 47.64], duration: 1000 })
      .catch((error: unknown) => {
        errorNote.current =
          error instanceof Error ? error.message : "fly-rejected";
        phaseRef.current = "done";
        setPhase("done");
        publish();
      });
  };

  const onLoad = () => {
    counts.current.loads += 1;

    if (phaseRef.current === "await-load") {
      phaseRef.current = "await-north";
      setPhase("await-north");
      flyNorth();
    }

    if (
      phaseRef.current === "await-remount" &&
      counts.current.loads >= 2 &&
      lastCamera.current !== "pending"
    ) {
      beginFailure(lastCamera.current);
    }

    publish();
  };

  const onStyleLoad = () => {
    counts.current.styles += 1;
    publish();
  };

  const onError = (event: MapErrorEvent) => {
    counts.current.errors += 1;
    errorNote.current = errorText(event.error);

    if (phaseRef.current === "await-failure") {
      phaseRef.current = "done";
      setPhase("done");
    }

    publish();
  };

  const onMove = (event: MoveEvent) => {
    const { longitude, latitude } = event.viewState;
    const camera = `${longitude.toFixed(2)},${latitude.toFixed(2)}`;
    const north = closeTo(longitude, -122.32) && closeTo(latitude, 47.64);

    console.log(event.origin, event.viewState);

    if (phaseRef.current === "await-north" && north) {
      lastCamera.current = "pending";
      phaseRef.current = "await-remount";
      setPhase("await-remount");
      setGeneration((current) => current + 1);
      publish();
      return;
    }

    // The flight can emit its final north camera after remount is requested
    // and before the new map loads. That camera is not the new map.
    if (phaseRef.current === "await-remount" && counts.current.loads < 2) {
      if (!north) {
        lastCamera.current = camera;
      }

      return;
    }

    lastCamera.current = camera;

    if (phaseRef.current === "await-remount" && counts.current.loads >= 2) {
      beginFailure(camera);
    }
  };

  useEffect(() => {
    if (phase !== "await-load") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-load") {
        return;
      }

      errorNote.current = "load-timeout";
      phaseRef.current = "done";
      setPhase("done");
      publishRef.current();
    }, 30000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-north") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-north") {
        return;
      }

      errorNote.current = "fly-timeout";
      phaseRef.current = "done";
      setPhase("done");
      publishRef.current();
    }, 20000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-remount") {
      return;
    }

    const timer = setTimeout(() => {
      beginFailureRef.current("no-move");
    }, 8000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-failure") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-failure") {
        return;
      }

      if (errorNote.current === "none") {
        errorNote.current = "timeout";
      }

      phaseRef.current = "done";
      setPhase("done");
      publishRef.current();
    }, 15000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  return {
    generation,
    mapStyle: useFailureStyle ? failureStyleUrl : undefined,
    status,
    onLoad,
    onStyleLoad,
    onError,
    onMove,
    flyNorth,
    remount: () => {
      setGeneration((current) => current + 1);
    },
    failStyle: () => {
      setUseFailureStyle(true);
      setGeneration((current) => current + 1);
    },
  };
};

const closeTo = (value: number, target: number): boolean =>
  Math.abs(value - target) < 0.015;

const errorText = (error: unknown): string => {
  if (error === undefined) {
    return "omitted";
  }

  if (typeof error === "string") {
    return error.slice(0, 180);
  }

  if (error instanceof Error) {
    return error.message.slice(0, 180);
  }

  return typeof error;
};

const statusLine = (
  counts: SmokeCounts = { loads: 0, styles: 0, errors: 0 },
  error = "none",
  remount = "pending",
  phase: SmokePhase = "await-load"
): string =>
  `TF03 loads=${counts.loads} styles=${counts.styles} errors=${counts.errors} error=${error} remount=${remount} phase=${phase}`;
