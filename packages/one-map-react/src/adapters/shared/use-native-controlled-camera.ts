import { useLayoutEffect, useRef } from "react";

import type { MapRef, ViewState } from "../../contracts/camera-types.js";
import type { MoveEvent } from "../../contracts/event-types.js";
import { useActiveCallback } from "./use-active-callback.js";

/** Compares renderer camera coordinates with wrap equivalence and native precision. */
const sameCamera = (left: ViewState, right: ViewState): boolean => {
  const circularDifference = (a: number, b: number) =>
    Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180);
  return (
    circularDifference(left.longitude, right.longitude) < 0.000001 &&
    circularDifference(left.bearing, right.bearing) < 0.000001 &&
    Math.abs(left.latitude - right.latitude) < 0.000001 &&
    Math.abs(left.zoom - right.zoom) < 0.000001 &&
    Math.abs(left.pitch - right.pitch) < 0.000001
  );
};

/**
 * Reconciles native camera proposals after application callbacks commit their controlled state.
 * @param viewState - Latest React-owned target, or undefined to release control.
 * @param jumpTo - Existing adapter camera dispatch path.
 * @param ready - Whether the wrapper can currently apply an imperative camera target.
 * @param onError - Receives operational camera failures while the owner remains mounted.
 * @returns Movement observation and load reconciliation callbacks owned by this map attachment.
 */
export const useNativeControlledCamera = (
  viewState: ViewState | undefined,
  jumpTo: MapRef["jumpTo"],
  ready: () => boolean,
  onError: (error: unknown) => void
) => {
  const observed = useRef<MoveEvent | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const userProposal = useRef(false);
  const dispatchingCorrection = useRef(false);
  const correctedTarget = useRef<string | undefined>(undefined);
  const reportError = useActiveCallback(onError);
  const targetKey = viewState ? JSON.stringify(viewState) : undefined;

  useLayoutEffect(() => {
    correctedTarget.current = undefined;
    if (targetKey === undefined) {
      observed.current = undefined;
      userProposal.current = false;
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    }
  }, [targetKey]);

  const reconcile = useActiveCallback(() => {
    const proposal = observed.current;
    if (!viewState || !proposal || !ready()) return;
    const proposedByUser = userProposal.current;
    userProposal.current = false;
    if (sameCamera(viewState, proposal.viewState)) {
      correctedTarget.current = undefined;
      return;
    }
    // A clamped correction can emit a different non-gesture target forever;
    // retry only for a new React target or another user proposal, not its feedback.
    if (!proposedByUser && correctedTarget.current === targetKey) return;
    correctedTarget.current = targetKey;
    dispatchingCorrection.current = true;
    try {
      void jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        bearing: viewState.bearing,
        pitch: viewState.pitch,
        duration: 0,
      }).catch(reportError);
    } finally {
      dispatchingCorrection.current = false;
    }
  });
  const schedule = useActiveCallback(() => {
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      reconcile();
    });
  });
  const onMove = useActiveCallback((event: MoveEvent) => {
    observed.current = event;
    userProposal.current ||= event.origin === "user";
    schedule();
  });

  useLayoutEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
      observed.current = undefined;
      userProposal.current = false;
    },
    []
  );

  const onCommand = useActiveCallback(() => {
    if (!dispatchingCorrection.current) correctedTarget.current = undefined;
  });

  return { onMove, onLoad: schedule, onCommand };
};
