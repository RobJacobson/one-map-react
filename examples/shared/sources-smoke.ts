import type { GeoJsonFeatureCollection, MapStyle } from "one-map-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  emptyStyle,
  replacementStyle,
  routes,
} from "../../tests/fixtures/map-fixture.js";

type SourcesPhase =
  | "await-load"
  | "await-reset"
  | "await-data"
  | "await-style"
  | "await-remove"
  | "done";

interface SourcesSmokeOptions {
  /**
   * Where the native runner reads the status line.
   *
   * @remarks
   * The iOS simulator posts here because its Metro log does not carry
   * `console.log`. Android keeps using logcat.
   */
  readonly statusUrl?: string;
}

interface SourcesSmoke {
  readonly phase: SourcesPhase;
  readonly status: string;
  readonly mapStyle: MapStyle;
  readonly routeData: GeoJsonFeatureCollection;
  /** Line paint color while set; `undefined` removes the paint key. */
  readonly lineColor: string | undefined;
  /** Whether the vector and image sources are mounted. */
  readonly showTransient: boolean;
  readonly onLoad: () => void;
  readonly onStyleLoad: () => void;
  readonly onError: (event: { readonly error?: unknown }) => void;
}

interface SmokeFields {
  mounted: string;
  reset: string;
  data: string;
  style: string;
  removed: string;
  error: string;
  note: string;
}

/** Routes reduced to their first feature for the data-update phase. */
const updatedRoutes: GeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: routes.features.slice(0, 1),
};

/**
 * Drives the TF05 sources smoke: mount every family, remove a paint key,
 * update GeoJSON data, replace the style, then remove the vector and image
 * sources.
 *
 * @remarks
 * Each mutation is a React state swap the renderer must accept. A conversion
 * or renderer failure reports through `onError` or stalls the phase timer,
 * which the runner reads as a timeout. Image and child-layer rebuild after
 * style replacement is covered by the renderer accepting the re-registered
 * content without an error event.
 */
export const useSourcesSmoke = ({
  statusUrl,
}: SourcesSmokeOptions): SourcesSmoke => {
  const fields = useRef<SmokeFields>(initialFields());
  const phaseRef = useRef<SourcesPhase>("await-load");
  const loadedRef = useRef(false);
  const loadedAt = useRef<number | null>(null);
  const [phase, setPhase] = useState<SourcesPhase>("await-load");
  const [mapStyle, setMapStyle] = useState<MapStyle>(emptyStyle);
  const [routeData, setRouteData] = useState<GeoJsonFeatureCollection>(routes);
  const [lineColor, setLineColor] = useState<string | undefined>("#2563eb");
  const [showTransient, setShowTransient] = useState(true);
  const [status, setStatus] = useState(() =>
    statusLine(initialFields(), "await-load")
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

  const enter = (next: SourcesPhase) => {
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

    loadedRef.current = true;
    publish();
  };

  const onStyleLoad = () => {
    if (phaseRef.current !== "await-style") {
      return;
    }

    fields.current.style = "rebuilt";
    setShowTransient(false);
    enterRef.current("await-remove");
  };

  const onError = (event: { readonly error?: unknown }) => {
    fields.current.error = errorText(event.error);
    enterRef.current("done");
  };

  useEffect(() => {
    if (phase !== "await-load") {
      return;
    }

    // The first mutation waits for the map load, then one settle window so
    // every source, layer, and image reached the renderer.
    const poll = setInterval(() => {
      if (!loadedRef.current || phaseRef.current !== "await-load") {
        return;
      }

      if (loadedAt.current === null) {
        loadedAt.current = Date.now();
        return;
      }

      if (Date.now() - loadedAt.current < 2000) {
        return;
      }

      fields.current.mounted = "1";
      setLineColor(undefined);
      enterRef.current("await-reset");
    }, 250);

    return () => {
      clearInterval(poll);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-reset") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-reset") {
        return;
      }

      fields.current.reset = "ok";
      setRouteData(updatedRoutes);
      enterRef.current("await-data");
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-data") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-data") {
        return;
      }

      fields.current.data = "updated";
      setMapStyle(replacementStyle);
      enterRef.current("await-style");
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-style") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-style") {
        return;
      }

      fields.current.style = "timeout";
      enterRef.current("done");
    }, 15000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "await-remove") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current !== "await-remove") {
        return;
      }

      fields.current.removed = "clean";
      enterRef.current("done");
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "await-style" || phase === "done") {
      return;
    }

    const timer = setTimeout(() => {
      if (phaseRef.current === "done") {
        return;
      }

      fields.current.note = "phase-timeout";
      enterRef.current("done");
    }, 30000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  return {
    phase,
    status,
    mapStyle,
    routeData,
    lineColor,
    showTransient,
    onLoad,
    onStyleLoad,
    onError,
  };
};

const initialFields = (): SmokeFields => ({
  mounted: "pending",
  reset: "pending",
  data: "pending",
  style: "pending",
  removed: "pending",
  error: "none",
  note: "none",
});

const errorText = (error: unknown): string => {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "map-error";

  return text.replaceAll(/\s+/g, "-").slice(0, 80);
};

const statusLine = (fields: SmokeFields, phase: SourcesPhase): string =>
  `TF05 mounted=${fields.mounted} reset=${fields.reset} data=${fields.data} style=${fields.style} removed=${fields.removed} error=${fields.error} note=${fields.note} phase=${phase} done=${phase === "done" ? 1 : 0}`;
