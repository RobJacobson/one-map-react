import { describe, expect, test } from "vite-plus/test";

import { invokeWrapper } from "../src/adapters/shared/invoke-wrapper.js";

describe("invokeWrapper", () => {
  test("resolves after a void return", async () => {
    await expect(invokeWrapper(undefined)).resolves.toBeUndefined();
  });

  test("resolves after a non-thenable object such as a map instance", async () => {
    await expect(invokeWrapper({ id: "map" })).resolves.toBeUndefined();
  });

  test("awaits a fulfilled wrapper promise", async () => {
    await expect(invokeWrapper(Promise.resolve("ok"))).resolves.toBeUndefined();
  });

  test("rejects when the wrapper promise rejects", async () => {
    await expect(
      invokeWrapper(Promise.reject(new Error("native")))
    ).rejects.toThrow("native");
  });
});
