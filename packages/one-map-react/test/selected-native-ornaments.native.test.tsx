import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

import App from "../../../examples/native-maplibre/App.js";

const mockTf07Screen = jest.fn(
  (_props: { readonly ornaments: object }) => null
);

jest.mock("../../../examples/shared/smoke-target.js", () => ({
  smokeTarget: "tf07",
}));

jest.mock("one-map-react", () => ({ MapSetup: () => null }));
jest.mock("one-map-react/maplibre-native", () => ({
  adapter: { backend: "maplibre-native" },
}));
jest.mock("one-map-react/mapbox-native", () => ({}));
jest.mock("../../../examples/shared/native-tf07-screen.js", () => ({
  NativeTf07Screen: (props: { readonly ornaments: object }) =>
    mockTf07Screen(props),
}));

test("selected MapLibre TF07 scale clears the top-left location button", async () => {
  const view = await render(<App />);
  expect(mockTf07Screen).toHaveBeenCalledWith(
    expect.objectContaining({
      ornaments: { scaleBar: true, scaleBarPosition: { top: 64, left: 8 } },
    })
  );
  await view.unmount();
});
