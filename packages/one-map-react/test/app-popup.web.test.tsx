import { act, fireEvent, render } from "@testing-library/react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { expect, test, vi } from "vite-plus/test";

import type { NativeLocationButtonProps } from "../../../examples/shared/native-location-button.js";
import { NativePopupBubble } from "../../../examples/shared/native-popup-bubble.js";
import { Tf07Scene } from "../../../examples/shared/tf07-scene.js";
import {
  Tf08AcceptanceScene,
  type Tf08AcceptanceProbe,
} from "../../../examples/shared/tf08-acceptance-scene.js";

vi.mock("react-native", async () => {
  const react = await import("react");
  return {
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Pressable: ({
      children,
      accessibilityRole,
      accessibilityLabel,
      onPress,
    }: {
      children?: ReactNode;
      accessibilityRole: string;
      accessibilityLabel: string;
      onPress: () => void;
    }) =>
      react.createElement(
        "button",
        {
          role: accessibilityRole,
          "aria-label": accessibilityLabel,
          onClick: onPress,
        },
        children
      ),
  };
});

const LabelContext = createContext("missing provider");
const StatefulChild = () => {
  const label = useContext(LabelContext);
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  );
};

test("native application bubble retains children and provider, closes with current callback, and unmounts silently", () => {
  const first = vi.fn();
  const second = vi.fn();
  const opened = vi.fn();
  const propagated = vi.fn();
  const tree = (onClose: () => void, label: string) => (
    <div role="presentation" onClick={propagated} onKeyDown={() => undefined}>
      <LabelContext value={label}>
        <NativePopupBubble onOpen={opened} onClose={onClose}>
          <StatefulChild />
        </NativePopupBubble>
      </LabelContext>
    </div>
  );
  const mounted = render(tree(first, "initial provider"));
  expect(opened).toHaveBeenCalledTimes(1);
  fireEvent.click(mounted.getByText("initial provider: 0"));
  mounted.rerender(tree(second, "updated provider"));
  expect(mounted.getByText("updated provider: 1")).toBeTruthy();
  propagated.mockClear();
  fireEvent.click(mounted.getByRole("button", { name: "Close popup" }));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(propagated).not.toHaveBeenCalled();
  expect(opened).toHaveBeenCalledTimes(1);
  mounted.unmount();
  expect(second).toHaveBeenCalledTimes(1);
});

vi.mock("one-map-react", async () => {
  const react = await import("react");
  const Empty = () => null;
  const Container = ({ children }: { children?: ReactNode }) => children;
  return {
    Map: react.forwardRef(({ children }: { children?: ReactNode }, _ref) => (
      <div>{children}</div>
    )),
    Marker: Empty,
    Source: Container,
    Layer: Empty,
    UserLocation: ({
      position,
    }: {
      position?: { lngLat: readonly [number, number] };
    }) => (
      <output data-testid="supplied-location">
        {position ? JSON.stringify(position.lngLat) : "hidden"}
      </output>
    ),
  };
});

test("TF07 application popup close removes its content and teardown stays silent", () => {
  const report = vi.fn();
  const popup = (
    children: ReactNode,
    _onOpen: () => void,
    onClose: () => void
  ) => (
    <div>
      <button type="button" onClick={onClose}>
        Close application popup
      </button>
      {children}
    </div>
  );
  const scene = () => (
    <Tf07Scene
      renderLocation={() => null}
      renderNavigation={() => null}
      native
      style={{ width: 400, height: 300 }}
      renderPopup={popup}
      markerContent={(kind) =>
        kind === "popup" ? <span>Popup child</span> : null
      }
      report={report}
      attach={() => undefined}
    />
  );
  const mounted = render(scene());
  expect(mounted.getByText("Popup child")).toBeTruthy();
  fireEvent.click(mounted.getByText("Close application popup"));
  expect(mounted.queryByText("Popup child")).toBeNull();
  expect(report).toHaveBeenCalledWith("popup-close");
  mounted.unmount();
  const closeCount = report.mock.calls.filter(
    ([event]) => event === "popup-close"
  ).length;
  const second = render(scene());
  second.unmount();
  expect(
    report.mock.calls.filter(([event]) => event === "popup-close")
  ).toHaveLength(closeCount);
});

test.each(["mapbox-native", "maplibre-native", "mapbox-web", "maplibre-web"])(
  "TF08 %s configuration clears app display and native SDK puck coverage has one owner",
  async (backend) => {
    let probe: Tf08AcceptanceProbe | null = null;
    const Location = ({ onGeolocate }: NativeLocationButtonProps) => (
      <button
        type="button"
        onClick={() => onGeolocate?.({ lngLat: [7, 8], accuracy: 12 })}
      >
        Deliver application fix
      </button>
    );
    const mounted = render(
      <Tf08AcceptanceScene
        services={{
          location: {
            requestPermission: async () => ({
              status: "granted",
              accuracy: "unknown",
            }),
            getCurrentPosition: async () => ({ lngLat: [7, 8] }),
            watchPosition: () => () => undefined,
          },
        }}
        backend={backend}
        style={{ width: 400, height: 300 }}
        overlay={null}
        renderCoveragePopup={() => null}
        renderLocation={Location}
        nativePuck={<span data-testid="raw-sdk-puck">SDK puck</span>}
        attach={(value) => {
          probe = value;
        }}
        fixtureUrl="http://fixture.invalid"
      />
    );
    const configure = async (mode: string) => {
      await act(async () => {
        await probe?.command("configure", { mode });
      });
    };
    fireEvent.click(
      mounted.getByRole("button", { name: "Deliver application fix" })
    );
    expect(mounted.getByTestId("supplied-location").textContent).toBe("[7,8]");
    await configure("coverage-base");
    expect(mounted.getByTestId("supplied-location").textContent).toBe("hidden");
    await configure("coverage-puck");
    fireEvent.click(
      mounted.getByRole("button", { name: "Deliver application fix" })
    );
    if (backend.endsWith("native")) {
      expect(mounted.queryByTestId("supplied-location")).toBeNull();
      expect(mounted.getByTestId("raw-sdk-puck")).toBeTruthy();
    } else {
      expect(mounted.getByTestId("supplied-location").textContent).toBe(
        "[7,8]"
      );
    }
    await configure("coverage-base");
    expect(mounted.getByTestId("supplied-location").textContent).toBe("hidden");
    mounted.unmount();
  }
);
