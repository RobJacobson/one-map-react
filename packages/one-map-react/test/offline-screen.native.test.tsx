import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { Adapter } from "one-map-react";
import { type ReactNode, StrictMode } from "react";

import { NativeTf08Screen } from "../../../examples/shared/native-tf08-screen.js";

jest.mock("one-map-react", () => ({
  MapSetup: ({ children }: { children: ReactNode }) => children,
}));

test("StrictMode effect replay owns a fresh offline command instance", async () => {
  const instances: {
    command: ReturnType<typeof jest.fn>;
    dispose: ReturnType<typeof jest.fn>;
  }[] = [];
  const createCommands = jest.fn(() => {
    const instance = { command: jest.fn(async () => null), dispose: jest.fn() };
    instances.push(instance);
    return instance;
  });
  const adapter = { backend: "mapbox-native" } as Adapter;
  const screen = await render(
    <StrictMode>
      <NativeTf08Screen
        adapter={adapter}
        createOfflineCommands={createCommands}
        requestLocationPermission={async () => undefined}
        getCurrentPosition={async () => ({ lngLat: [0, 0] })}
        startDetached
      />
    </StrictMode>
  );
  expect(instances.length).toBeGreaterThanOrEqual(2);
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(instances.at(-1)?.dispose).not.toHaveBeenCalled();
  await screen.unmount();
  expect(
    instances.every((instance) => instance.dispose.mock.calls.length === 1)
  ).toBe(true);
});
