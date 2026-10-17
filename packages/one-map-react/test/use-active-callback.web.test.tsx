import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import {
  type ReactElement,
  StrictMode,
  Suspense,
  startTransition,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { describe, expect, vi, test } from "vite-plus/test";

import {
  useActiveCallback,
  useActiveCallbacks,
} from "../src/adapters/shared/use-active-callback.js";

const committed = vi.fn();
const pending = vi.fn();

const MapProbe = ({ onMove }: { onMove: () => void }): ReactElement => {
  const { onMove: reportMove } = useActiveCallbacks({ onMove });

  return (
    <button type="button" onClick={() => reportMove()}>
      move
    </button>
  );
};

const SuspendOn = ({ resource }: { resource: Promise<void> }): null => {
  use(resource);
  return null;
};

const Harness = (): ReactElement => {
  const [onMove, setOnMove] = useState(() => committed);
  const [resource, setResource] = useState<Promise<void> | null>(null);

  return (
    <>
      <MapProbe onMove={onMove} />
      <button
        type="button"
        onClick={() => {
          const wait = new Promise<void>(() => {});
          startTransition(() => {
            setOnMove(() => pending);
            setResource(wait);
          });
        }}
      >
        next
      </button>
      <Suspense fallback={null}>
        {resource ? <SuspendOn resource={resource} /> : null}
      </Suspense>
    </>
  );
};

const RetainedProbe = ({
  onMove,
  retain,
}: {
  onMove: () => void;
  retain: (report: () => void) => void;
}): ReactElement => {
  const { onMove: reportMove } = useActiveCallbacks({ onMove });
  retain(reportMove);

  return <div data-testid="map" />;
};

const LayoutParent = ({
  onMove,
  showMap,
}: {
  onMove: () => void;
  showMap: boolean;
}): ReactElement | null => {
  const reportRef = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    reportRef.current?.();
  });

  return showMap ? (
    <RetainedProbe
      onMove={onMove}
      retain={(report) => {
        reportRef.current = report;
      }}
    />
  ) : null;
};

describe("committed callback guards", () => {
  test("keeps identity across callback replacement and StrictMode replay, then ignores teardown", () => {
    const initial = vi.fn<(value: number) => void>();
    const replacement = vi.fn<(value: number) => void>();
    const view = renderHook(({ callback }) => useActiveCallback(callback), {
      initialProps: { callback: initial },
      wrapper: StrictMode,
    });
    const retained = view.result.current;
    retained(1);
    expect(initial).toHaveBeenCalledWith(1);
    view.rerender({ callback: replacement });
    expect(view.result.current).toBe(retained);
    retained(2);
    expect(replacement).toHaveBeenCalledWith(2);
    expect(initial).toHaveBeenCalledTimes(1);
    view.unmount();
    retained(3);
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  test("does not expose an uncommitted callback to a retained map", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("move"));
    expect(committed).toHaveBeenCalledTimes(1);
    expect(pending).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText("next"));
    });
    fireEvent.click(screen.getByText("move"));

    expect(committed).toHaveBeenCalledTimes(2);
    expect(pending).not.toHaveBeenCalled();
  });

  test("ignores a retained callback from a parent layout effect after unmount", () => {
    const onMove = vi.fn();
    const view = render(<LayoutParent onMove={onMove} showMap />);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("map")).toBeTruthy();

    view.rerender(<LayoutParent onMove={onMove} showMap={false} />);

    expect(screen.queryByTestId("map")).toBeNull();
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});

describe("useActiveCallbacks", () => {
  test("retains typed handlers across replacement, optional callbacks and StrictMode replay", () => {
    const initial = vi.fn<(value: number) => void>();
    const replacement = vi.fn<(value: number) => void>();
    const loaded = vi.fn<() => void>();
    const callbacks: {
      onMove: ((value: number) => void) | undefined;
      onLoad: (() => void) | undefined;
    } = { onMove: initial, onLoad: undefined };
    const view = renderHook((props) => useActiveCallbacks(props), {
      initialProps: callbacks,
      wrapper: StrictMode,
    });
    const retained = view.result.current;
    retained.onMove(1);
    retained.onLoad();
    expect(initial).toHaveBeenCalledWith(1);

    view.rerender({ onMove: replacement, onLoad: loaded });
    expect(view.result.current).toBe(retained);
    retained.onMove(2);
    retained.onLoad();
    expect(replacement).toHaveBeenCalledWith(2);
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(initial).toHaveBeenCalledTimes(1);

    view.rerender({ onMove: undefined, onLoad: undefined });
    retained.onMove(3);
    retained.onLoad();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveBeenCalledTimes(1);

    view.rerender({ onMove: replacement, onLoad: loaded });
    view.unmount();
    retained.onMove(4);
    retained.onLoad();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveBeenCalledTimes(1);
  });

  test("teardown in one callback suppresses the next retained handler", () => {
    const later = vi.fn();
    const view = renderHook(() =>
      useActiveCallbacks({
        onMove: () => view.unmount(),
        onLoad: later,
      })
    );
    const retained = view.result.current;
    act(() => {
      retained.onMove();
      retained.onLoad();
    });
    expect(later).not.toHaveBeenCalled();
  });
});
