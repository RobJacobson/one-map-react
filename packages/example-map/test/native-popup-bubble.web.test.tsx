import { fireEvent, render } from "@testing-library/react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { expect, test, vi } from "vite-plus/test";

import { NativePopupBubble } from "../src/scenarios/native-popup-bubble.js";

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
