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
 * Remount waits for the new map’s public camera readback before the failure
 * step. Both pinned native wrappers deliver the deliberately bad style error.
 */
export const useLifecycleSmoke = ({
  mapRef,
  failureStyleUrl,
}: LifecycleSmokeOptions): LifecycleSmoke => {
  const counts = useRef<SmokeCounts>({ loads: 0, styles: 0, errors: 0 });
  const phaseRef = useRef<SmokePhase>("await-load");
  const errorNote = useRef("none");
  const remountCamera = useRef("pending");
  const retiredMap = useRef<MapRef | null>(null);
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
    const north = closeTo(longitude, -122.32) && closeTo(latitude, 47.64);

    console.log(event.origin, event.viewState);

    if (phaseRef.current === "await-north" && north) {
      retiredMap.current = mapRef.current;
      phaseRef.current = "await-remount";
      setPhase("await-remount");
      setGeneration((current) => current + 1);
      publish();
      return;
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

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const readCamera = async () => {
      if (!active || phaseRef.current !== "await-remount") return;

      const map = mapRef.current;
      if (map && map !== retiredMap.current && counts.current.loads >= 2) {
        try {
          const [longitude, latitude] = await map.getCenter();
          if (
            active &&
            phaseRef.current === "await-remount" &&
            mapRef.current === map &&
            closeTo(longitude, -122.34) &&
            closeTo(latitude, 47.61)
          ) {
            beginFailureRef.current(
              `${longitude.toFixed(2)},${latitude.toFixed(2)}`
            );
            return;
          }
        } catch {
          // A newly mounted native camera can be unavailable until initialization.
        }
      }

      if (active && phaseRef.current === "await-remount")
        pollTimer = setTimeout(() => void readCamera(), 100);
    };
    void readCamera();
    const timer = setTimeout(() => {
      if (!active || phaseRef.current !== "await-remount") return;

      active = false;
      clearTimeout(pollTimer);
      errorNote.current = "remount-timeout";
      phaseRef.current = "done";
      setPhase("done");
      publishRef.current();
    }, 30000);

    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(pollTimer);
    };
  }, [phase, mapRef]);

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
