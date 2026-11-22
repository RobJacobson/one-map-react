import { describe, expect, jest, test } from "@jest/globals";

const mockSetLanguage = jest.fn<
  (language: string | string[] | null) => Promise<void>
>(async () => undefined);
const mockNormalizeLanguageTag = jest.fn((tag: string) =>
  tag === "ZH_tw" ? "zh-Hant" : tag
);
jest.mock("@rnmapbox/maps", () => ({
  __esModule: true,
  get setLanguage() {
    return mockSetLanguage;
  },
  get normalizeLanguageTag() {
    return mockNormalizeLanguageTag;
  },
}));

import { normalizeLanguageTag, setLanguage } from "../src/mapbox-native.js";

describe("selected RNMapbox language facilities", () => {
  test("passes tags and null unchanged, preserves acknowledgment and errors", async () => {
    expect(setLanguage).toBe(mockSetLanguage);
    expect(normalizeLanguageTag).toBe(mockNormalizeLanguageTag);
    for (const language of ["EN_us", ["fr", "de"], null]) {
      await setLanguage(language);
      expect(mockSetLanguage).toHaveBeenLastCalledWith(language);
    }
    const failure = new Error("SDK language failure");
    mockSetLanguage.mockRejectedValueOnce(failure);
    await expect(setLanguage("en")).rejects.toBe(failure);
    expect(normalizeLanguageTag("ZH_tw")).toBe("zh-Hant");
    expect(mockNormalizeLanguageTag).toHaveBeenLastCalledWith("ZH_tw");
  });
});
