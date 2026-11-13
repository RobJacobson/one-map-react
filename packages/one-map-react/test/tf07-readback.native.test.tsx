import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { NativeTf07Screen } from "../../../packages/example-map/src/scenarios/native-tf07-screen.js";
import type { Adapter } from "../src/contracts/adapter.js";

jest.mock(
  "../../../packages/example-map/src/scenarios/native-viewport.js",
  () => ({
    measureNativeViewport: async () => [0, 0, 320, 480],
  })
);
jest.mock("one-map-react", () => ({
  MapSetup: ({ children }: { readonly children: ReactNode }) => children,
}));
jest.mock("../../../packages/example-map/src/scenarios/tf07-scene.js", () => ({
  Tf07Scene: ({ attach }: { readonly attach: (probe: unknown) => void }) => {
    attach({
      read: async () => ({ events: { load: 1 } }),
      project: async () => [10, 20],
    });
    return null;
  },
}));

test("renderer reads expose fresh receipts even when observations do not change", async () => {
  const fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue({} as Response);
  try {
    // The scene and setup are mocked; this test exercises only readback delivery.
    const screen = await render(
      <NativeTf07Screen
        adapter={{} as Adapter}
        ornaments={{ scaleBarEnabled: true }}
      />
    );
    await fireEvent.press(screen.getByText("Read renderer"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const first = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    await fireEvent.press(screen.getByText("Read renderer"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const second = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body));
    expect(first.readSequence).toBe(1);
    expect(first.viewport).toEqual([0, 0, 320, 480]);
    expect(second.readSequence).toBe(2);
    expect(second.events).toEqual(first.events);
    await screen.unmount();
  } finally {
    fetchSpy.mockRestore();
  }
});
