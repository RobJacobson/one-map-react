import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { Tf07Scene } from "../../../examples/shared/tf07-scene.js";

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
    GeolocateControl: () => null,
  };
});

test.each([false, true])(
  "TF07 native=%s supplies only supported marker interaction props",
  (native) => {
    fixture.markers = [];
    const view = render(
      <Tf07Scene
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
