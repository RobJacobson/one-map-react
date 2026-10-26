import { act, fireEvent, render } from "@testing-library/react";
import type { MapRef } from "one-map-react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { NativeCameraButtons } from "../../../examples/shared/native-camera-buttons.js";

vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Pressable: ({
    children,
    accessibilityLabel,
    onPress,
  }: {
    children?: ReactNode;
    accessibilityLabel: string;
    onPress: () => void;
  }) => (
    <button type="button" aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));

const fixture = () => {
  const getZoom = vi.fn(async () => 12);
  const zoomTo = vi.fn(async (_zoom: number) => undefined);
  const easeTo = vi.fn(async (_options: object): Promise<void> => undefined);
  const mapRef = {
    current: { getZoom, zoomTo, easeTo } as unknown as MapRef | null,
  };
  const onError = vi.fn();
  return { mapRef, getZoom, zoomTo, easeTo, onError };
};

test("accessible application buttons increment actual renderer zoom, respect fixture bounds and reset north", async () => {
  const f = fixture();
  const view = render(<NativeCameraButtons {...f} minZoom={12} maxZoom={13} />);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Zoom in" }))
  );
  expect(f.zoomTo).toHaveBeenLastCalledWith(13);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Zoom out" }))
  );
  expect(f.zoomTo).toHaveBeenLastCalledWith(12);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Reset north" }))
  );
  expect(f.easeTo).toHaveBeenCalledWith({ bearing: 0 });
  expect(f.getZoom).toHaveBeenCalledTimes(2);
});

test("unavailable maps are harmless and current read/command failures reach the screen", async () => {
  const f = fixture();
  const map = f.mapRef.current;
  f.mapRef.current = null;
  const view = render(<NativeCameraButtons {...f} />);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Zoom in" }))
  );
  expect(f.getZoom).not.toHaveBeenCalled();
  f.mapRef.current = map;
  const failure = new Error("Camera failed");
  f.getZoom.mockRejectedValueOnce(failure);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Zoom in" }))
  );
  expect(f.onError).toHaveBeenLastCalledWith(failure);
  f.zoomTo.mockRejectedValueOnce(failure);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Zoom out" }))
  );
  expect(f.onError).toHaveBeenCalledTimes(2);
  f.easeTo.mockRejectedValueOnce(failure);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Reset north" }))
  );
  expect(f.onError).toHaveBeenCalledTimes(3);
});

test.each(["replacement", "detach", "unmount", "newer intent"])(
  "pending app readback cannot move a stale map or report errors after %s",
  async (change) => {
    for (const reject of [false, true]) {
      const f = fixture();
      let resolveRead: (zoom: number) => void = () => undefined;
      let rejectRead: (error: Error) => void = () => undefined;
      f.getZoom.mockImplementationOnce(
        () =>
          new Promise<number>((resolve, fail) => {
            resolveRead = resolve;
            rejectRead = fail;
          })
      );
      const view = render(<NativeCameraButtons {...f} />);
      fireEvent.click(view.getByRole("button", { name: "Zoom in" }));
      if (change === "replacement")
        f.mapRef.current = { ...f.mapRef.current } as MapRef;
      else if (change === "detach") f.mapRef.current = null;
      else if (change === "unmount") view.unmount();
      else
        await act(async () =>
          fireEvent.click(view.getByRole("button", { name: "Reset north" }))
        );
      await act(async () => {
        if (reject) rejectRead(new Error("Old read"));
        else resolveRead(12);
      });
      expect(f.zoomTo).not.toHaveBeenCalled();
      expect(f.onError).not.toHaveBeenCalled();
      view.unmount();
    }
  }
);

test("superseded command failures remain with their original application intent", async () => {
  const f = fixture();
  let rejectCommand: (error: Error) => void = () => undefined;
  f.easeTo.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectCommand = reject;
      })
  );
  const view = render(<NativeCameraButtons {...f} />);
  fireEvent.click(view.getByRole("button", { name: "Reset north" }));
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Zoom out" }))
  );
  await act(async () => rejectCommand(new Error("Old command")));
  expect(f.onError).not.toHaveBeenCalled();
});
