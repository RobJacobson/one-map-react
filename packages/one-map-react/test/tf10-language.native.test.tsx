import { describe, expect, jest, test } from "@jest/globals";

const mockSetLanguage = jest.fn<
  (language: string | string[] | null) => Promise<void>
>(async () => undefined);
const mockNormalizeLanguageTag = jest.fn((tag: string) =>
  tag === "ZH_tw" ? "zh-Hant" : tag
);
jest.mock("@rnmapbox/maps", () => ({
  __esModule: true,
  setLanguage: (language: string | string[] | null) =>
    mockSetLanguage(language),
  normalizeLanguageTag: (tag: string) => mockNormalizeLanguageTag(tag),
}));

import { assertLabelLocalization } from "../src/adapters/mapbox-native/label-localization.js";
import { normalizeLanguageTag, setLanguage } from "../src/mapbox-native.js";

describe("version-specific RNMapbox language facilities", () => {
  test("passes tags and null unchanged, preserves acknowledgment and errors", async () => {
    expect(() => assertLabelLocalization(true)).not.toThrow();
    for (const language of ["EN_us", ["fr", "de"], null]) {
      await setLanguage(language);
      expect(mockSetLanguage).toHaveBeenLastCalledWith(language);
    }
    const failure = new Error("SDK language failure");
    mockSetLanguage.mockRejectedValueOnce(failure);
    await expect(setLanguage("en")).rejects.toBe(failure);
    expect(normalizeLanguageTag("ZH_tw")).toBe("zh-Hant");
    expect(mockNormalizeLanguageTag).toHaveBeenLastCalledWith("ZH_tw");
    mockNormalizeLanguageTag.mockReturnValueOnce(42 as unknown as string);
    expect(() => normalizeLanguageTag("en")).toThrow(
      "invalid normalized language tag"
    );
  });

  test("minimum peer imports safely and reports unavailable operations when called", async () => {
    const wrapper = jest.requireMock<Record<string, unknown>>("@rnmapbox/maps");
    delete wrapper.setLanguage;
    delete wrapper.normalizeLanguageTag;
    try {
      expect(() => assertLabelLocalization(undefined)).not.toThrow();
      expect(() => assertLabelLocalization(true)).toThrow(
        "localizeLabels with Mapbox Maps SDK v11"
      );
      await expect(setLanguage("en")).rejects.toThrow("10.3.8 or newer");
      expect(() => normalizeLanguageTag("en")).toThrow("10.3.8 or newer");
    } finally {
      wrapper.setLanguage = mockSetLanguage;
      wrapper.normalizeLanguageTag = mockNormalizeLanguageTag;
    }
  });
});
