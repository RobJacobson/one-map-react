import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

/** Media resources created by the acceptance application, never by the facade. */
export interface Tf09Media {
  /** Stable browser canvas identity. */
  readonly canvas: HTMLCanvasElement;
  /** Stable application-owned video URL. */
  readonly urls: string[];
  /** Mutable source corner coordinates. */
  readonly coordinates: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  /** Stable custom callback set for this attachment. */
  readonly custom: {
    readonly onAdd: () => void;
    readonly onRemove: () => void;
    readonly render: (
      gl: WebGLRenderingContext | WebGL2RenderingContext
    ) => void;
  };
}

/** Creates and cleans up a local video, canvas and custom GPU callback set. */
export const WebTf09Media = ({
  enabled,
  moved,
  render,
}: {
  readonly enabled: boolean;
  readonly moved: boolean;
  readonly render: (media: Tf09Media) => ReactNode;
}) => {
  const canvas = useMemo(() => {
    const element = document.createElement("canvas");
    element.width = 64;
    element.height = 64;
    const context = element.getContext("2d");
    if (!context) throw new Error("Canvas fixture needs a 2D context.");
    context.fillStyle = "#00ff88";
    context.fillRect(0, 0, 64, 64);
    return element;
  }, []);
  const [url, setUrl] = useState<string>();
  const counts = useRef({ added: 0, removed: 0, frames: 0 });
  const custom = useMemo(
    () => ({
      onAdd: () => {
        counts.current.added += 1;
      },
      onRemove: () => {
        counts.current.removed += 1;
      },
      render: (gl: WebGLRenderingContext | WebGL2RenderingContext) => {
        counts.current.frames += 1;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(20, 20, 24, 24);
        gl.clearColor(1, 0, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
      },
    }),
    []
  );
  useEffect(() => {
    window.__oneMapTf09Media = () => ({
      ...counts.current,
      ready: url !== undefined,
    });
    return () => {
      delete window.__oneMapTf09Media;
    };
  }, [url]);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      if (active) {
        objectUrl = URL.createObjectURL(
          new Blob(chunks, { type: "video/webm" })
        );
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "#2266ff";
          context.fillRect(0, 0, 64, 64);
        }
        setUrl(objectUrl);
      }
      for (const track of stream.getTracks()) track.stop();
    };
    recorder.start();
    // captureStream records canvas paints; a static pre-stream canvas yields only metadata.
    const repaint = setInterval(() => {
      const context = canvas.getContext("2d");
      context?.fillRect(0, 0, 64, 64);
    }, 100);
    const timer = setTimeout(() => {
      clearInterval(repaint);
      recorder.stop();
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(repaint);
      if (recorder.state !== "inactive") recorder.stop();
      for (const track of stream.getTracks()) track.stop();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canvas]);
  if (!enabled || !url) return null;
  const left = moved ? 5 : -25;
  // eslint-disable-next-line react/refs -- Stable callbacks capture counters; render receives resources without reading refs.
  return render({
    canvas,
    urls: [url],
    coordinates: [
      [left, 20],
      [left + 15, 20],
      [left + 15, 5],
      [left, 5],
    ],
    custom,
  });
};

declare global {
  interface Window {
    /** Independent custom callback accounting. */
    __oneMapTf09Media?: () => {
      added: number;
      removed: number;
      frames: number;
      ready: boolean;
    };
    /** Selected renderer readback installed by the example's wrapper probe. */
    __oneMapTf09Inspect?: () => unknown;
  }
}
