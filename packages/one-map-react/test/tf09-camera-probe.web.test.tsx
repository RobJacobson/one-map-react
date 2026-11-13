import { act, render } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import {
  Tf09Scene,
  type Tf09Probe,
} from "../../../packages/example-map/src/scenarios/tf09-scene.js";
import { MapSetup } from "../src/facade/map-setup.js";

vi.mock("react-map-gl/mapbox", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");
  return createWebMapMock();
});

import { Map as WrapperMap } from "react-map-gl/mapbox";

import { adapter } from "../src/mapbox-web.js";

const target = { longitude: 0, latitude: 0, zoom: 2, bearing: 0, pitch: 0 };

test("native camera probe reports observed movement independently of an unchanged target", async () => {
  let attached: Tf09Probe | null = null;
  const probe = (): Tf09Probe => {
    if (!attached) throw new Error("Probe not attached");
    return attached;
  };
  const view = render(
    <MapSetup adapter={adapter}>
      <Tf09Scene
        backend="mapbox-native"
        style={{ width: 400, height: 400 }}
        attach={(value) => {
          attached = value;
        }}
      />
    </MapSetup>
  );
  await act(async () => {
    await probe().command("controlled-camera", {
      enabled: true,
      accept: false,
    });
  });
  const wrapper = () => vi.mocked(WrapperMap).mock.calls.at(-1)?.[0];
  const proposal = { ...target, longitude: 0.25 };
  act(() => {
    wrapper()?.onMove?.({ viewState: proposal, originalEvent: {} } as never);
    wrapper()?.onMoveEnd?.({ viewState: proposal, originalEvent: {} } as never);
  });
  const read = (await probe().command("camera-read")) as {
    lastUserViewState: object;
    lastUserProposal: object;
  };
  expect(read.lastUserViewState).toEqual(proposal);
  expect(read.lastUserProposal).toEqual(proposal);
  await act(async () => {
    await probe().command("controlled-camera", {
      enabled: true,
      accept: false,
    });
  });
  const reset = (await probe().command("camera-read")) as {
    lastUserProposal?: object;
  };
  expect(reset.lastUserProposal).toBeUndefined();
  view.unmount();
});
