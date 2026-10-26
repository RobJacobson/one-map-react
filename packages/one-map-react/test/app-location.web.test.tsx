import { act, fireEvent, render } from "@testing-library/react";
import type { GeolocationPosition, MapRef } from "one-map-react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { NativeLocationButton } from "../../../examples/shared/native-location-button.js";

vi.mock("react-native", async () => {
  const react = await import("react");
  return {
    View: ({ children }: { children?: ReactNode }) =>
      react.createElement("div", {}, children),
    Text: ({ children }: { children?: ReactNode }) =>
      react.createElement("span", {}, children),
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
      disabled,
    }: {
      children?: ReactNode;
      onPress: () => void;
      accessibilityLabel: string;
      disabled: boolean;
    }) =>
      react.createElement(
        "button",
        { onClick: onPress, "aria-label": accessibilityLabel, disabled },
        children
      ),
  };
});

const fixture = () => {
  const easeTo = vi.fn<MapRef["easeTo"]>().mockResolvedValue(undefined);
  const map = { easeTo } as unknown as MapRef;
  const mapRef = { current: map as MapRef | null };
  const onError = vi.fn();
  const onGeolocate = vi.fn();
  return { easeTo, mapRef, onError, onGeolocate };
};

const pendingPosition = () => {
  let resolve: (position: GeolocationPosition) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const acquire = vi.fn(
    (_signal: AbortSignal) =>
      new Promise<GeolocationPosition>((success, failure) => {
        resolve = success;
        reject = failure;
      })
  );
  return {
    acquire,
    resolve: (position: GeolocationPosition) => resolve(position),
    reject: (error: unknown) => reject(error),
  };
};

test("application location is an accessible one-shot action; repeat activation owns no second request", async () => {
  const selected = fixture();
  const pending = pendingPosition();
  const mounted = render(
    <NativeLocationButton {...selected} getCurrentPosition={pending.acquire} />
  );
  const button = mounted.getByRole("button", { name: "Locate me" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(pending.acquire).toHaveBeenCalledTimes(1);
  expect(button).toHaveProperty("disabled", true);
  await act(async () => pending.resolve({ lngLat: [7, 8], accuracy: 12 }));
  expect(selected.easeTo).toHaveBeenCalledWith({ center: [7, 8], zoom: 14 });
  expect(selected.onGeolocate).toHaveBeenCalledWith({
    lngLat: [7, 8],
    accuracy: 12,
  });
  expect(button).toHaveProperty("disabled", false);
  mounted.unmount();
});

test.each(["resolve", "reject"] as const)(
  "replacement and unmount abort the owned request and suppress a late %s",
  async (outcome) => {
    const selected = fixture();
    const pending = pendingPosition();
    const tree = (key: string) => (
      <NativeLocationButton
        key={key}
        {...selected}
        getCurrentPosition={pending.acquire}
      />
    );
    const mounted = render(tree("first"));
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }));
    const signal = pending.acquire.mock.calls[0][0];
    mounted.rerender(tree("replacement"));
    expect(signal.aborted).toBe(true);
    await act(async () =>
      outcome === "resolve"
        ? pending.resolve({ lngLat: [7, 8] })
        : pending.reject(new Error("retired source error"))
    );
    expect(selected.easeTo).not.toHaveBeenCalled();
    expect(selected.onGeolocate).not.toHaveBeenCalled();
    expect(selected.onError).not.toHaveBeenCalled();
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }));
    const secondSignal = pending.acquire.mock.calls[1][0];
    mounted.unmount();
    expect(secondSignal.aborted).toBe(true);
    await act(async () =>
      outcome === "resolve"
        ? pending.resolve({ lngLat: [7, 8] })
        : pending.reject(new Error("disposed source error"))
    );
    expect(selected.easeTo).not.toHaveBeenCalled();
    expect(selected.onError).not.toHaveBeenCalled();
  }
);

test.each(["resolve", "reject"] as const)(
  "changing the concrete map suppresses stale acquisition %s",
  async (outcome) => {
    const selected = fixture();
    const pending = pendingPosition();
    const mounted = render(
      <NativeLocationButton
        {...selected}
        getCurrentPosition={pending.acquire}
      />
    );
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }));
    const replacement = fixture();
    selected.mapRef.current = replacement.mapRef.current;
    await act(async () =>
      outcome === "resolve"
        ? pending.resolve({ lngLat: [7, 8] })
        : pending.reject(new Error("stale"))
    );
    expect(selected.easeTo).not.toHaveBeenCalled();
    expect(replacement.easeTo).not.toHaveBeenCalled();
    expect(selected.onGeolocate).not.toHaveBeenCalled();
    expect(selected.onError).not.toHaveBeenCalled();
    mounted.unmount();
  }
);

test("no-map activation acquires nothing; current acquisition and camera failures report and permit retry", async () => {
  const selected = fixture();
  const map = selected.mapRef.current;
  selected.mapRef.current = null;
  const acquire = vi.fn(async () => ({ lngLat: [7, 8] as const }));
  const mounted = render(
    <NativeLocationButton {...selected} getCurrentPosition={acquire} />
  );
  fireEvent.click(mounted.getByRole("button", { name: "Locate me" }));
  expect(acquire).not.toHaveBeenCalled();
  selected.mapRef.current = map;
  const sourceError = new Error("permission denied");
  acquire.mockRejectedValueOnce(sourceError);
  await act(async () =>
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }))
  );
  expect(selected.onError).toHaveBeenLastCalledWith(sourceError);
  expect(selected.easeTo).not.toHaveBeenCalled();
  const cameraError = new Error("camera unavailable");
  selected.easeTo.mockRejectedValueOnce(cameraError);
  await act(async () =>
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }))
  );
  expect(selected.onError).toHaveBeenLastCalledWith(cameraError);
  expect(selected.onGeolocate).not.toHaveBeenCalled();
  await act(async () =>
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }))
  );
  expect(selected.onGeolocate).toHaveBeenCalledTimes(1);
  mounted.unmount();
});

test("invalid application fixes report failure before camera dispatch", async () => {
  const selected = fixture();
  const mounted = render(
    <NativeLocationButton
      {...selected}
      getCurrentPosition={async () => ({ lngLat: [1, Number.NaN] })}
    />
  );
  await act(async () =>
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }))
  );
  expect(selected.onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Invalid location coordinate." })
  );
  expect(selected.easeTo).not.toHaveBeenCalled();
  expect(selected.onGeolocate).not.toHaveBeenCalled();
  mounted.unmount();
});

test("application coordinates are captured before camera acknowledgement and success notification", async () => {
  const selected = fixture();
  const position: { lngLat: [number, number] } = { lngLat: [7, 8] };
  let finish: () => void = () => {};
  selected.easeTo.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const mounted = render(
    <NativeLocationButton
      {...selected}
      getCurrentPosition={async () => position}
    />
  );
  await act(async () =>
    fireEvent.click(mounted.getByRole("button", { name: "Locate me" }))
  );
  position.lngLat[0] = 99;
  expect(selected.easeTo).toHaveBeenCalledWith({ center: [7, 8], zoom: 14 });
  await act(async () => finish());
  expect(selected.onGeolocate).toHaveBeenCalledWith({ lngLat: [7, 8] });
  mounted.unmount();
});

test.each(["resolve", "reject"] as const)(
  "a camera %s after map replacement cannot notify the new attachment",
  async (outcome) => {
    const selected = fixture();
    let finish: () => void = () => {};
    let fail: (error: unknown) => void = () => {};
    selected.easeTo.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        })
    );
    const mounted = render(
      <NativeLocationButton
        {...selected}
        getCurrentPosition={async () => ({ lngLat: [7, 8] })}
      />
    );
    await act(async () =>
      fireEvent.click(mounted.getByRole("button", { name: "Locate me" }))
    );
    selected.mapRef.current = fixture().mapRef.current;
    await act(async () =>
      outcome === "resolve" ? finish() : fail(new Error("retired camera"))
    );
    expect(selected.onGeolocate).not.toHaveBeenCalled();
    expect(selected.onError).not.toHaveBeenCalled();
    mounted.unmount();
  }
);
