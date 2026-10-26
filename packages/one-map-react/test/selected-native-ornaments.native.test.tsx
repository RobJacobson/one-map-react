import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

import MapboxApp from "../../../examples/native-mapbox/App.js";
import MaplibreApp from "../../../examples/native-maplibre/App.js";

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
jest.mock("one-map-react/mapbox-native", () => ({
  adapter: { backend: "mapbox-native" },
  setAccessToken: jest.fn(),
}));
jest.mock("../../../examples/shared/native-tf07-screen.js", () => ({
  NativeTf07Screen: (props: { readonly ornaments: object }) =>
    mockTf07Screen(props),
}));

test.each([MapboxApp, MaplibreApp])(
  "selected TF07 SDK ornaments clear application screen buttons",
  async (App) => {
    mockTf07Screen.mockClear();
    const view = await render(<App />);
    expect(mockTf07Screen).toHaveBeenCalledWith(
      expect.objectContaining({
        ornaments: expect.objectContaining({
          scaleBarPosition: { top: 64, left: 8 },
          compassPosition: { top: 148, right: 8 },
        }),
      })
    );
    await view.unmount();
  }
);
