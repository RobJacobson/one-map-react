import { act, render } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { expect, test, vi } from "vite-plus/test";

import {
  Tf07Scene,
  type Tf07Probe,
} from "../../../examples/shared/tf07-scene.js";

const fixture = vi.hoisted(() => ({
  markers: [] as Array<Record<string, unknown>>,
}));
vi.mock("one-map-react", async () => {
  const react = await import("react");
  const Content = ({ children }: { readonly children?: ReactNode }) => children;
  return {
    Map: react.forwardRef((props: { readonly children?: ReactNode }, _ref) =>
      react.createElement(Content, props)
    ),
    Source: Content,
    Layer: () => null,
    Marker: (props: Record<string, unknown>) => {
      fixture.markers.push(props);
      return null;
    },
    Control: () => null,
    UserLocation: () => null,
  };
});

test.each([false, true])(
  "TF07 native=%s supplies only supported marker interaction props",
  (native) => {
    fixture.markers = [];
    const view = render(
      <Tf07Scene
        renderLocation={() => null}
        renderNavigation={() => null}
        native={native}
        style={{ width: 400, height: 300 }}
        renderPopup={() => null}
        markerContent={() => null}
        controlContent={null}
        report={() => undefined}
        attach={() => undefined}
      />
    );
    for (const id of ["tf07-live", "tf07-annotation"]) {
      const marker = fixture.markers.find((props) => props.id === id);
      expect(marker?.onClick).toBeTypeOf("function");
      for (const name of ["draggable", "onDragStart", "onDrag", "onDragEnd"]) {
        if (native) expect(marker).not.toHaveProperty(name);
        else
          expect(marker?.[name]).toEqual(
            name === "draggable" ? true : expect.any(Function)
          );
      }
    }
    view.unmount();
  }
);

test("TF07 native scene remount retires its screen location action with the map attachment", async () => {
  const mountedLocation = vi.fn();
  const disposedLocation = vi.fn();
  const Location = () => {
    useEffect(() => {
      mountedLocation();
      return disposedLocation;
    }, []);
    return null;
  };
  let probe: Tf07Probe | null = null;
  const mounted = render(
    <Tf07Scene
      native
      renderLocation={Location}
      renderNavigation={() => null}
      renderPopup={() => null}
      markerContent={() => null}
      controlContent={null}
      style={{ width: 400, height: 300 }}
      report={() => undefined}
      attach={(value) => {
        probe = value;
      }}
    />
  );
  expect(mountedLocation).toHaveBeenCalledTimes(1);
  await act(async () => {
    probe?.configure("remount");
  });
  expect(disposedLocation).toHaveBeenCalledTimes(1);
  expect(mountedLocation).toHaveBeenCalledTimes(2);
  mounted.unmount();
  expect(disposedLocation).toHaveBeenCalledTimes(2);
});
