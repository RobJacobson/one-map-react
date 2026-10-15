import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  type ReactElement,
  Suspense,
  startTransition,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { describe, expect, vi, test } from "vite-plus/test";

import { useActiveCallback } from "../src/adapters/shared/use-active-callback.js";

const committed = vi.fn();
const pending = vi.fn();

const MapProbe = ({ onMove }: { onMove: () => void }): ReactElement => {
  const reportMove = useActiveCallback(onMove);

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
  const reportMove = useActiveCallback(onMove);
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

describe("useActiveCallback", () => {
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
