import {
  type Adapter,
  type ExternalDrawingContext,
  type MapRef,
  MapSetup,
} from "one-map-react";
import { useEffect, useRef, useState } from "react";

import { RouteMap } from "./route-map.js";

interface WebLifecycleAppProps {
  readonly adapter: Adapter;
}

interface DrawingContextRecord {
  readonly canvas: HTMLCanvasElement;
  readonly gl: ExternalDrawingContext;
}

interface ContextPair {
  readonly first: DrawingContextRecord | null;
  readonly second: DrawingContextRecord | null;
  readonly error: string | null;
}

type SmokeMode = "route" | "reuse" | "gl";

type CanvasIdentity = "none" | "first" | "same" | "new" | "missing";

type ContextIdentity = "internal" | "first" | "second" | "unavailable";

interface SmokeReport {
  readonly loads: number;
  readonly styles: number;
  readonly errors: number;
  readonly canvas: CanvasIdentity;
  readonly context: ContextIdentity;
  readonly done: boolean;
}

/**
 * Web example shell with the TF03 reuse and external-context smoke.
 *
 * `?tf03=reuse&auto=1` remounts once after the style loads and records
 * whether the canvas node survived. `?tf03=gl&auto=1` constructs a map
 * with one drawing context, then remounts with another. The reused map
 * should keep the first canvas.
 */
export const WebLifecycleApp = ({ adapter }: WebLifecycleAppProps) => {
  const mapRef = useRef<MapRef>(null);
  const firstCanvas = useRef<HTMLCanvasElement | null>(null);
  const advanced = useRef(false);
  const search = smokeSearch();
  const [contexts] = useState(createContextPair);
  const [generation, setGeneration] = useState(0);
  const [activeContext, setActiveContext] = useState<"first" | "second">(
    "first"
  );
  const [report, setReport] = useState(initialReport);
  const mode = search.mode;
  const auto = search.auto;
  const gl = drawingContext(contexts, mode, activeContext);
  const status = statusText(mode, report);

  useEffect(() => {
    console.log(status);
  }, [status]);

  useEffect(() => {
    if (!auto || advanced.current || report.done) {
      return;
    }

    if (mode === "gl" && contexts?.error) {
      advanced.current = true;
      setReport((current) => ({
        ...current,
        context: "unavailable",
        done: true,
      }));
      return;
    }

    if (
      mode === "reuse" &&
      report.loads >= 1 &&
      report.styles >= 1 &&
      generation === 0
    ) {
      advanced.current = true;
      setGeneration(1);
    }

    if (
      mode === "gl" &&
      report.loads >= 1 &&
      report.context === "first" &&
      generation === 0
    ) {
      advanced.current = true;
      setActiveContext("second");
      setGeneration(1);
    }

    if (
      mode === "gl" &&
      report.loads >= 1 &&
      report.context !== "first" &&
      generation === 0
    ) {
      advanced.current = true;
      setReport((current) => ({ ...current, done: true }));
    }
  }, [auto, contexts, generation, mode, report]);

  const noteCanvas = (field: "loads" | "styles" | "errors") => {
    const canvas = attachedCanvas();
    const canvasIdentity = canvasIdentityFor(canvas, firstCanvas, generation);
    const context = contextIdentityFor(contexts);

    setReport((current) => {
      const loads = field === "loads" ? current.loads + 1 : current.loads;
      const styles = field === "styles" ? current.styles + 1 : current.styles;
      const errors = field === "errors" ? current.errors + 1 : current.errors;
      const finished =
        (mode === "reuse" || mode === "gl") && generation >= 1 && loads >= 2;

      return {
        loads,
        styles,
        errors,
        canvas: canvasIdentity,
        context: mode === "gl" ? context : "internal",
        done: current.done || finished,
      };
    });
  };

  return (
    <MapSetup adapter={adapter}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          <button
            type="button"
            onClick={() => {
              void mapRef.current?.flyTo({
                center: [-122.32, 47.64],
                duration: 1000,
              });
            }}
          >
            Fly north
          </button>
          <button
            type="button"
            onClick={() => {
              setGeneration((current) => current + 1);
            }}
          >
            Remount
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.assign("/?tf03=reuse&auto=1");
            }}
          >
            Run reuse
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.assign("/?tf03=gl&auto=1");
            }}
          >
            Run external context
          </button>
        </div>
        <p id="tf03-status" style={{ margin: 0, padding: 8 }}>
          {status}
        </p>
        <RouteMap
          key={generation}
          ref={mapRef}
          reuseMaps={mode === "reuse" || mode === "gl"}
          gl={gl}
          style={{ width: "100%", height: "100%", flex: 1 }}
          onLoad={() => {
            noteCanvas("loads");
          }}
          onStyleLoad={() => {
            noteCanvas("styles");
          }}
          onError={() => {
            noteCanvas("errors");
          }}
          onMove={(event) => {
            console.log(event.origin, event.viewState);
          }}
        />
      </div>
    </MapSetup>
  );
};

const smokeSearch = (): {
  readonly mode: SmokeMode;
  readonly auto: boolean;
} => {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("tf03");
  const mode: SmokeMode = value === "reuse" || value === "gl" ? value : "route";

  return { mode, auto: params.get("auto") === "1" };
};

const createContextPair = (): ContextPair | null => {
  if (smokeSearch().mode !== "gl") {
    return null;
  }

  try {
    return {
      first: createDrawingContext(),
      second: createDrawingContext(),
      error: null,
    };
  } catch (error) {
    return {
      first: null,
      second: null,
      error: error instanceof Error ? error.message : "WebGL is unavailable.",
    };
  }
};

const createDrawingContext = (): DrawingContextRecord => {
  const canvas = document.createElement("canvas");

  canvas.width = 256;
  canvas.height = 256;

  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");

  if (!gl) {
    throw new Error("WebGL is unavailable.");
  }

  return { canvas, gl };
};

const drawingContext = (
  contexts: ContextPair | null,
  mode: SmokeMode,
  activeContext: "first" | "second"
): ExternalDrawingContext | undefined => {
  if (mode !== "gl" || !contexts) {
    return undefined;
  }

  const record = activeContext === "second" ? contexts.second : contexts.first;

  return record?.gl;
};

const attachedCanvas = (): HTMLCanvasElement | null => {
  const canvas = document.querySelector(
    ".mapboxgl-canvas, .maplibregl-canvas, canvas"
  );

  return canvas instanceof HTMLCanvasElement ? canvas : null;
};

const canvasIdentityFor = (
  canvas: HTMLCanvasElement | null,
  firstCanvas: { current: HTMLCanvasElement | null },
  generation: number
): CanvasIdentity => {
  if (!canvas) {
    return "missing";
  }

  if (!firstCanvas.current) {
    firstCanvas.current = canvas;
    return "first";
  }

  if (generation === 0) {
    return "first";
  }

  return canvas === firstCanvas.current ? "same" : "new";
};

const contextWasPainted = (record: DrawingContextRecord | null): boolean => {
  const gl = record?.gl;

  if (!gl || !("readPixels" in gl)) {
    return false;
  }

  const context = gl as WebGLRenderingContext;
  const pixels = new Uint8Array(4);

  context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixels);

  return pixels[3] > 0;
};

const contextIdentityFor = (contexts: ContextPair | null): ContextIdentity => {
  if (!contexts) {
    return "internal";
  }

  if (contexts.error) {
    return "unavailable";
  }

  const firstPainted = contextWasPainted(contexts.first);
  const secondPainted = contextWasPainted(contexts.second);

  if (secondPainted) {
    return "second";
  }

  if (firstPainted) {
    return "first";
  }

  return "internal";
};

const initialReport = (): SmokeReport => ({
  loads: 0,
  styles: 0,
  errors: 0,
  canvas: "none",
  context: "internal",
  done: false,
});

const statusText = (mode: SmokeMode, report: SmokeReport): string =>
  `TF03 mode=${mode} loads=${report.loads} styles=${report.styles} errors=${report.errors} canvas=${report.canvas} context=${report.context} done=${report.done ? 1 : 0}`;
