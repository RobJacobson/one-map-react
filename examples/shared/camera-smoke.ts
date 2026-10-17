import type { ClickEvent, LngLat, MapRef, ViewState } from "one-map-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * North end of the Seattle fixture, away from the opening camera.
 *
 * @remarks
 * The opening camera is latitude 47.61. A fitted center inside this box
 * shows that `fitBounds` moved the map.
 */
export const cameraSmokeBounds = [
  [-122.33, 47.63],
  [-122.31, 47.65],
] as const;

/** A target far enough from Seattle that a finished flight is obvious. */
const flightTarget: LngLat = [-120, 45];

type SmokePhase =
  | "await-load"
  | "await-fit"
  | "await-click"
  | "await-stop"
  | "await-hold"
  | "await-double-tap"
  | "done";

interface CameraSmokeOptions {
  readonly mapRef: { readonly current: MapRef | null };
  /** Native `stop()` is expected to reject. Web `stop()` is expected to cancel. */
  readonly platform: "web" | "native";
  /**
   * Watch a double tap after pinch zoom is turned off.
   *
   * @remarks
   * MapLibre Native is the case that needs this. Other shells leave it false.
   */
  readonly doubleTap: boolean;
  /**
   * Where the native runner reads the status line.
   *
   * @remarks
   * The iOS simulator posts here because its Metro log does not carry
   * `console.log`. Android keeps using logcat.
   */
  readonly statusUrl?: string;
}

interface CameraSmoke {
  readonly phase: SmokePhase;
  readonly status: string;
  readonly viewState: ViewState | undefined;
  readonly touchZoom: false | undefined;
  readonly doubleTapZoom: true | undefined;
  readonly onLoad: () => void;
  readonly onMove: (event: { readonly viewState: ViewState }) => void;
  readonly onMoveEnd: (event: { readonly viewState: ViewState }) => void;
  readonly onClick: (event: ClickEvent) => void;
}

interface SmokeFields {
  fit: string;
  click: string;
  clickAt: string;
  stop: string;
  held: string;
  doubletap: string;
  center: string;
  note: string;
}

/**
 * Drives the TF04 camera smoke: fit, click, stop, then a rejected move.
 *
 * @remarks
 * The page records what the renderer did. Web `stop` is a cancel. Native
 * `stop` is expected to reject. `held` is whether an unaccepted jump stayed
 * at the fitted camera. MapLibre can then wait for a double tap while pinch
 * zoom is off.
 */
export const useCameraSmoke = ({
  mapRef,
  platform,
  doubleTap,
  statusUrl,
}: CameraSmokeOptions): CameraSmoke => {
  const fields = useRef<SmokeFields>(initialFields(doubleTap));
  const phaseRef = useRef<SmokePhase>("await-load");
  const fitted = useRef<ViewState | null>(null);
  const zoomBaseline = useRef<number | null>(null);
  const [phase, setPhase] = useState<SmokePhase>("await-load");
  const [locked, setLocked] = useState<ViewState | undefined>(undefined);
  const [status, setStatus] = useState(() =>
    statusLine(initialFields(doubleTap), "await-load")
  );

  const publish = () => {
    const next = statusLine(fields.current, phaseRef.current);

    console.log(next);
    setStatus(next);

    if (statusUrl) {
      void fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: next,
      }).catch(() => undefined);
    }
  };

  const enter = (next: SmokePhase) => {
    phaseRef.current = next;
    setPhase(next);
    publish();
  };

  const enterRef = useRef(enter);
  useLayoutEffect(() => {
    enterRef.current = enter;
  });

  const onLoad = () => {
    if (phaseRef.current !== "await-load") {
      return;
    }

    enterRef.current("await-fit");
    requestFit(mapRef, phaseRef, fields, 0, () => {
      enterRef.current("done");
    });
  };

  const onMoveEnd = (event: { readonly viewState: ViewState }) => {
    fields.current.center = formatLngLat([
      event.viewState.longitude,
      event.viewState.latitude,
    ]);

    if (phaseRef.current === "await-fit" && cameraIsFitted(event.viewState)) {
      fitted.current = event.viewState;
      fields.current.fit = "ok";
      setLocked(event.viewState);
      enterRef.current("await-click");
    }

    publish();
  };

  const onClick = (event: ClickEvent) => {
    if (phaseRef.current !== "await-click" || !fitted.current) {
      return;
    }

    fields.current.clickAt = formatLngLat(event.lngLat);

    if (!samePlace(event.lngLat, fitted.current)) {
      fields.current.click = "off";
      publish();
      return;
    }

    fields.current.click = "hit";
    enterRef.current("await-stop");
  };

  const onMove = (event: { readonly viewState: ViewState }) => {
    if (
      phaseRef.current !== "await-double-tap" ||
      zoomBaseline.current === null
    ) {
      return;
    }

    if (event.viewState.zoom < zoomBaseline.current + 0.4) {
      return;
    }

    fields.current.doubletap = "zoomed";
    fields.current.center = formatLngLat([
      event.viewState.longitude,
      event.viewState.latitude,
    ]);
    enterRef.current("done");
  };

  useEffect(() => {
    if (phase !== "await-load") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-load") {
        return;
      }

      fields.current.fit = "timeout";
      fields.current.note = "load-timeout";
      enterRef.current("done");
    }, 30000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-fit") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-fit") {
        return;
      }

      fields.current.fit = "timeout";
      enterRef.current("done");
    }, 15000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-click") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-click") {
        return;
      }

      fields.current.click = "timeout";
      enterRef.current("done");
    }, 20000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-stop") {
      return;
    }

    if (platform === "native") {
      void mapRef.current
        ?.stop()
        .then(() => {
          if (phaseRef.current !== "await-stop") {
            return;
          }

          fields.current.stop = "resolved";
          enterRef.current("await-hold");
        })
        .catch(() => {
          if (phaseRef.current !== "await-stop") {
            return;
          }

          fields.current.stop = "rejected";
          enterRef.current("await-hold");
        });
      return;
    }

    void mapRef.current?.flyTo({ center: flightTarget, duration: 8000 });
    void mapRef.current?.stop();

    const timer = setTimeout(() => {
      void mapRef.current
        ?.getCenter()
        .then((center) => {
          if (phaseRef.current !== "await-stop") {
            return;
          }

          fields.current.center = formatLngLat(center);
          fields.current.stop = flightOutcome(center);
          enterRef.current("await-hold");
        })
        .catch((error: unknown) => {
          const fallback = parseCenter(fields.current.center);

          fields.current.note = errorText(error);

          if (!fallback || phaseRef.current !== "await-stop") {
            return;
          }

          fields.current.stop = flightOutcome(fallback);
          enterRef.current("await-hold");
        });
    }, 9000);

    return () => {
      clearTimeout(timer);
    };
  }, [mapRef, phase, platform]);

  useEffect(() => {
    if (phase !== "await-hold" || !fitted.current) {
      return;
    }

    const probe = setTimeout(() => {
      void mapRef.current?.jumpTo({ center: flightTarget }).catch(() => {
        fields.current.note = "jump-rejected";
      });
    }, 800);
    const read = setTimeout(() => {
      void mapRef.current
        ?.getCenter()
        .then((center) => {
          if (phaseRef.current !== "await-hold" || !fitted.current) {
            return;
          }

          fields.current.center = formatLngLat(center);
          fields.current.held = samePlace(center, fitted.current) ? "1" : "0";

          if (!doubleTap) {
            fields.current.doubletap = "skip";
            enterRef.current("done");
            return;
          }

          zoomBaseline.current = fitted.current.zoom;
          enterRef.current("await-double-tap");
        })
        .catch((error: unknown) => {
          const fallback = parseCenter(fields.current.center);

          fields.current.note = errorText(error);

          if (
            !fallback ||
            phaseRef.current !== "await-hold" ||
            !fitted.current
          ) {
            return;
          }

          fields.current.held = samePlace(fallback, fitted.current) ? "1" : "0";

          if (!doubleTap) {
            fields.current.doubletap = "skip";
            enterRef.current("done");
            return;
          }

          zoomBaseline.current = fitted.current.zoom;
          enterRef.current("await-double-tap");
        });
    }, 2500);

    return () => {
      clearTimeout(probe);
      clearTimeout(read);
    };
  }, [doubleTap, mapRef, phase]);

  useEffect(() => {
    if (phase !== "await-stop" && phase !== "await-hold") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== phase) {
        return;
      }

      if (phase === "await-stop" && fields.current.stop === "pending") {
        fields.current.stop = "timeout";
      }

      if (phase === "await-hold" && fields.current.held === "pending") {
        fields.current.held = "timeout";
      }

      enterRef.current("done");
    }, 20000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-double-tap") {
      return;
    }

    const readZoom = () => {
      void mapRef.current?.getZoom().then((zoom) => {
        if (phaseRef.current !== "await-double-tap") {
          return;
        }

        if (zoomBaseline.current === null) {
          zoomBaseline.current = zoom;
          return;
        }

        if (zoom < zoomBaseline.current + 0.4) {
          return;
        }

        fields.current.doubletap = "zoomed";
        enterRef.current("done");
      });
    };

    readZoom();
    const poll = setInterval(readZoom, 400);

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-double-tap") {
        return;
      }

      fields.current.doubletap = "timeout";
      enterRef.current("done");
    }, 20000);

    return () => {
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [mapRef, phase]);

  return {
    phase,
    status,
    viewState: phase === "await-hold" ? locked : undefined,
    touchZoom: phase === "await-double-tap" ? false : undefined,
    doubleTapZoom: phase === "await-double-tap" ? true : undefined,
    onLoad,
    onMove,
    onMoveEnd,
    onClick,
  };
};

const requestFit = (
  mapRef: { readonly current: MapRef | null },
  phaseRef: { current: SmokePhase },
  fields: { current: SmokeFields },
  attempt: number,
  finish: () => void
) => {
  const fit = mapRef.current?.fitBounds(cameraSmokeBounds, { duration: 500 });

  if (!fit) {
    if (attempt < 20) {
      setTimeout(
        () => requestFit(mapRef, phaseRef, fields, attempt + 1, finish),
        100
      );
      return;
    }

    fields.current.fit = "rejected";
    fields.current.note = "missing-ref";
    finish();
    return;
  }

  void fit.catch((error: unknown) => {
    if (phaseRef.current !== "await-fit") {
      return;
    }

    const text = errorText(error);

    if (attempt < 20 && text.includes("not-attached")) {
      setTimeout(
        () => requestFit(mapRef, phaseRef, fields, attempt + 1, finish),
        100
      );
      return;
    }

    fields.current.fit = "rejected";
    fields.current.note = text;
    finish();
  });
};

const parseCenter = (value: string): LngLat | undefined => {
  const [longitude, latitude] = value.split(",").map(Number);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return undefined;
  }

  return [longitude, latitude];
};

const initialFields = (doubleTap: boolean): SmokeFields => ({
  fit: "pending",
  click: "pending",
  clickAt: "pending",
  stop: "pending",
  held: "pending",
  doubletap: doubleTap ? "pending" : "skip",
  center: "pending",
  note: "none",
});

const cameraIsFitted = (view: ViewState): boolean =>
  view.longitude >= -122.335 &&
  view.longitude <= -122.305 &&
  view.latitude >= 47.625 &&
  view.latitude <= 47.655;

const samePlace = (lngLat: LngLat, view: ViewState): boolean =>
  Math.abs(lngLat[0] - view.longitude) < 0.08 &&
  Math.abs(lngLat[1] - view.latitude) < 0.08;

const flightOutcome = (center: LngLat): string => {
  const fromTarget = Math.hypot(
    center[0] - flightTarget[0],
    center[1] - flightTarget[1]
  );

  if (fromTarget < 0.5) {
    return "arrived";
  }

  if (fromTarget > 1) {
    return "stayed";
  }

  return "moved";
};

const formatLngLat = (lngLat: LngLat): string =>
  `${lngLat[0].toFixed(5)},${lngLat[1].toFixed(5)}`;

const errorText = (error: unknown): string => {
  const text = error instanceof Error ? error.message : "fit-rejected";

  return text.replaceAll(/\s+/g, "-").slice(0, 80);
};

const statusLine = (fields: SmokeFields, phase: SmokePhase): string =>
  `TF04 fit=${fields.fit} click=${fields.click} clickAt=${fields.clickAt} stop=${fields.stop} held=${fields.held} doubletap=${fields.doubletap} center=${fields.center} note=${fields.note} phase=${phase} done=${phase === "done" ? 1 : 0}`;
