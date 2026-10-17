import type {
  Adapter,
  MapErrorEvent,
  MapRef,
  MoveEvent,
  ViewState,
} from "one-map-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { cameraMatches, initialCamera, readCamera } from "./camera.js";

/** Engine choices offered by both application shells. */
export type Engine = "maplibre" | "mapbox";

interface Attachment {
  readonly engine: Engine;
  readonly generation: number;
  readonly camera: ViewState;
}

/**
 * Bounds map loading and camera handoff outside the keyed map tree, rejecting stale callbacks.
 *
 * @param adapters - Platform-specific adapters imported through public package entries.
 * @param mapboxEnabled - Whether a public Mapbox token is configured.
 * @returns Shared map callbacks and engine controls for either application shell.
 */
export const useExampleMap = (
  adapters: Readonly<Record<Engine, Adapter>>,
  mapboxEnabled: boolean
) => {
  const [attachment, setAttachment] = useState<Attachment>({
    engine: "maplibre",
    generation: 0,
    camera: initialCamera,
  });
  const [status, setStatus] = useState<
    "loading" | "ready" | "switching" | "error"
  >("loading");
  const [error, setError] = useState<string>();
  const [camera, setCamera] = useState(initialCamera);
  const mapRef = useRef<MapRef | null>(null);
  const observed = useRef(initialCamera);
  const observedGeneration = useRef(-1);
  const currentGeneration = useRef(0);
  const busy = useRef(false);
  const active = useRef(true);
  const verification = useRef<AbortController | null>(null);
  const adapter = adapters[attachment.engine];
  const attachMap = useCallback((map: MapRef | null): void => {
    mapRef.current = map;
  }, []);
  const isCurrent = () =>
    active.current && currentGeneration.current === attachment.generation;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      verification.current?.abort();
    };
  }, []);

  const fail = () => {
    if (!isCurrent()) return;
    verification.current ??= new AbortController();
    verification.current.abort();
    busy.current = false;
    setStatus("error");
    // Renderer errors can contain authenticated URLs; keep application guidance credential-free.
    setError(
      "The map could not load or restore its camera. Check network access and configuration, then retry."
    );
  };

  const failLoading = useEffectEvent(fail);
  useEffect(() => {
    if (status !== "loading" && status !== "switching") return;
    const timer = setTimeout(() => failLoading(), 10000);
    return () => clearTimeout(timer);
  }, [attachment.generation, status]);

  const onLoad = async (): Promise<void> => {
    const map = mapRef.current;
    if (!map || !isCurrent() || verification.current?.signal.aborted) return;
    verification.current?.abort();
    const controller = new AbortController();
    verification.current = controller;
    let poll: ReturnType<typeof setTimeout> | undefined;
    try {
      await withCameraDeadline(async () => {
        await map.jumpTo({
          center: [attachment.camera.longitude, attachment.camera.latitude],
          zoom: attachment.camera.zoom,
          bearing: attachment.camera.bearing,
          pitch: attachment.camera.pitch,
        });
        while (!controller.signal.aborted && isCurrent()) {
          const actual = await readCamera(
            map,
            adapter.backend,
            observed.current
          );
          if (controller.signal.aborted || !isCurrent()) return;
          // Native Mapbox orientation must come from this map's event, not the outgoing snapshot.
          const orientationObserved =
            adapter.backend !== "mapbox-native" ||
            observedGeneration.current === attachment.generation;
          if (orientationObserved && cameraMatches(actual, attachment.camera)) {
            observed.current = actual;
            setCamera(actual);
            busy.current = false;
            setStatus("ready");
            return;
          }
          await new Promise<void>((resolve) => {
            poll = setTimeout(resolve, 50);
          });
        }
      }, controller.signal);
    } catch {
      if (!controller.signal.aborted) fail();
    } finally {
      clearTimeout(poll);
    }
  };

  const selectEngine = async (engine: Engine): Promise<void> => {
    if (!isCurrent() || busy.current || (engine === "mapbox" && !mapboxEnabled))
      return;
    if (engine === attachment.engine && status !== "error") return;
    busy.current = true;
    setStatus("switching");
    setError(undefined);
    verification.current?.abort();
    const controller = new AbortController();
    verification.current = controller;
    try {
      const map = mapRef.current;
      const snapshot =
        status === "error" || !map
          ? attachment.camera
          : await withCameraDeadline(
              () => readCamera(map, adapter.backend, observed.current),
              controller.signal
            );
      if (controller.signal.aborted || !isCurrent()) return;
      currentGeneration.current += 1;
      observed.current = snapshot;
      setCamera(snapshot);
      setAttachment({
        engine,
        generation: currentGeneration.current,
        camera: snapshot,
      });
    } catch {
      if (!controller.signal.aborted) fail();
    }
  };

  const onMove = (event: MoveEvent): void => {
    if (!isCurrent()) return;
    observed.current = event.viewState;
    observedGeneration.current = attachment.generation;
  };

  const inspectCamera = async (): Promise<void> => {
    const map = mapRef.current;
    if (!map || !isCurrent()) return;
    try {
      const actual = await readCamera(map, adapter.backend, observed.current);
      if (isCurrent()) setCamera(actual);
    } catch {
      fail();
    }
  };

  const onError = (_event: MapErrorEvent): void => fail();

  return {
    attachment,
    adapter,
    attachMap,
    status,
    error,
    camera,
    onLoad,
    onMove,
    onError,
    selectEngine,
    inspectCamera,
  };
};

/** Bounds camera waits and releases their timers when the attachment retires. */
const withCameraDeadline = async <Result>(
  operation: () => Promise<Result>,
  signal: AbortSignal
): Promise<Result> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  try {
    return await Promise.race([
      new Promise<never>((_resolve, reject) => {
        cancel = () => reject(new Error("Camera operation cancelled."));
        signal.addEventListener("abort", cancel);
        timer = setTimeout(
          () => reject(new Error("Camera operation timed out.")),
          10000
        );
        if (signal.aborted) cancel();
      }),
      operation(),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
};
