import { describe, expect, test } from "@jest/globals";

import { toRnmapboxLineStyle } from "../src/convert-line-style.js";

describe("line style conversion", () => {
  test("RNMapbox style uses camelCase paint and layout names", () => {
    expect(
      toRnmapboxLineStyle(
        { "line-color": "#2563eb", "line-width": 3 },
        { "line-cap": "round" }
      )
    ).toEqual({
      lineColor: "#2563eb",
      lineWidth: 3,
      lineCap: "round",
    });
  });

  test("omitted line-cap is not added", () => {
    expect(
      toRnmapboxLineStyle({ "line-color": "#2563eb", "line-width": 3 })
    ).toEqual({
      lineColor: "#2563eb",
      lineWidth: 3,
    });
  });
});
