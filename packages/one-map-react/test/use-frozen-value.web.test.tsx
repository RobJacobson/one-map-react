import { renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { useFrozenValue } from "../src/adapters/shared/use-frozen-value.js";

test("retains function values without invoking them across rerenders and remounts", () => {
  const first = vi.fn();
  const replacement = vi.fn();
  const mounted = renderHook(({ value }) => useFrozenValue(value), {
    initialProps: { value: first },
    wrapper: StrictMode,
  });

  expect(mounted.result.current).toBe(first);
  mounted.rerender({ value: replacement });
  expect(mounted.result.current).toBe(first);
  expect(first).not.toHaveBeenCalled();
  expect(replacement).not.toHaveBeenCalled();

  mounted.unmount();
  const remounted = renderHook(() => useFrozenValue(replacement), {
    wrapper: StrictMode,
  });
  expect(remounted.result.current).toBe(replacement);
  expect(replacement).not.toHaveBeenCalled();
});

test("an initially undefined value stays frozen when a value later arrives", () => {
  const mounted = renderHook<string | undefined, { value: string | undefined }>(
    ({ value }) => useFrozenValue(value),
    { initialProps: { value: undefined }, wrapper: StrictMode }
  );

  mounted.rerender({ value: "later" });
  expect(mounted.result.current).toBeUndefined();
});
