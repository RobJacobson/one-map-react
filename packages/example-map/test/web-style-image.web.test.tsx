import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import { useWebStyleImage } from "../src/scenarios/web-style-image.js";

test("replaced and retired fixture loads cannot register on a reused style", () => {
  const pending: (() => void)[] = [];
  class FixtureImage {
    onload: (() => void) | null = null;
    onerror = null;
    crossOrigin = null;
    set src(_url: string) {
      if (this.onload) pending.push(this.onload);
    }
  }
  vi.stubGlobal("Image", FixtureImage);
  const images = new Set<string>();
  const map = {
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string) => images.add(id)),
    removeImage: vi.fn((id: string) => images.delete(id)),
  };
  try {
    const fixture = renderHook(
      ({ url }: { readonly url?: string }) =>
        useWebStyleImage(map, "marker", url),
      { initialProps: { url: "/old.png" } }
    );
    fixture.rerender({ url: "/current.png" });
    pending[0]();
    expect(map.addImage).not.toHaveBeenCalled();
    pending[1]();
    expect(map.addImage).toHaveBeenCalledTimes(1);
    fixture.unmount();
    expect(map.removeImage).toHaveBeenCalledWith("marker");
    pending[1]();
    expect(map.addImage).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
