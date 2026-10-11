import { describe, expect, test } from "@jest/globals";

import { toRnmapboxStyleProps } from "../src/convert-map-style.js";
import type { StyleDocument } from "../src/style-types.js";

const document: StyleDocument = {
  version: 8,
  sources: {},
  layers: [],
};

describe("map style conversion", () => {
  test("string styles become styleURL", () => {
    expect(toRnmapboxStyleProps("https://example.test/style.json")).toEqual({
      styleURL: "https://example.test/style.json",
    });
  });

  test("documents become serialized styleJSON", () => {
    expect(toRnmapboxStyleProps(document)).toEqual({
      styleJSON: JSON.stringify(document),
    });
  });
});
