import { act, render } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { expect, test, vi } from "vite-plus/test";

import {
  Tf09Scene,
  type Tf09Probe,
} from "../../../packages/example-map/src/scenarios/tf09-scene.js";
import type { NativeMapInputs } from "../src/contracts/native-types.js";
import type { MapRef } from "../src/index.js";
import { createNativeSceneFixture } from "./native-scene-fixture.js";

const wrapper = vi.fn((_props: NativeMapInputs) => {});
const Camera = forwardRef<MapRef, NativeMapInputs>((props, ref) => {
  useImperativeHandle(
    ref,
    () =>
      ({
        getCenter: async () => [0, 0],
        getZoom: async () => 2,
      }) as unknown as MapRef
  );
  wrapper(props);
  return <>{props.children}</>;
});
const components = createNativeSceneFixture(Camera);

const target = { longitude: 0, latitude: 0, zoom: 2, bearing: 0, pitch: 0 };

test("native camera probe reports observed movement independently of an unchanged target", async () => {
  let attached: Tf09Probe | null = null;
  const probe = (): Tf09Probe => {
    if (!attached) throw new Error("Probe not attached");
    return attached;
  };
  const view = render(
    <Tf09Scene
      components={components}
      backend="mapbox-native"
      style={{ width: 400, height: 400 }}
      attach={(value) => {
        attached = value;
      }}
    />
  );
  await act(async () => {
    await probe().command("controlled-camera", {
      enabled: true,
      accept: false,
    });
  });
  const callbacks = wrapper.mock.calls.at(-1)?.[0];
  const proposal = { ...target, longitude: 0.25 };
  act(() => {
    callbacks?.onMove?.({ viewState: proposal, origin: "user" });
    callbacks?.onMoveEnd?.({ viewState: proposal, origin: "user" });
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
