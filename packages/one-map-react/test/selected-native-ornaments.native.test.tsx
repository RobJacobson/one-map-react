import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

import MapboxApp from "../../../packages/example-map/src/scenarios/mapbox-native.js";
import MaplibreApp from "../../../packages/example-map/src/scenarios/maplibre-native.js";

const mockTf07Screen = jest.fn(
  (_props: { readonly ornaments: object }) => null
);
jest.mock("one-map-react", () => ({ MapSetup: () => null }));
jest.mock("one-map-react/mapbox-native", () => ({
  adapter: { backend: "mapbox-native" },
}));
jest.mock("one-map-react/maplibre-native", () => ({
  adapter: { backend: "maplibre-native" },
}));
jest.mock(
  "../../../packages/example-map/src/scenarios/native-tf07-screen.js",
  () => ({
    NativeTf07Screen: (props: { readonly ornaments: object }) =>
      mockTf07Screen(props),
  })
);

test.each([MapboxApp, MaplibreApp])(
  "selected TF07 SDK ornaments clear the application location and camera buttons",
  async (App) => {
    mockTf07Screen.mockClear();
    const view = await render(<App scenario="tf07" />);
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
