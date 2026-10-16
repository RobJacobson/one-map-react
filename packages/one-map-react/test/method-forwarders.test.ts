import { expect, test } from "vite-plus/test";

import { createWebMethodForwarders } from "../src/adapters/web/method-forwarders.js";

test("unchanged delegates retain the current receiver, synchronous results and errors", () => {
  const first = {
    value: 1,
    read(offset = 0) {
      if (offset < 0) throw new Error("invalid offset");
      return this.value + offset;
    },
  };
  const second = {
    value: 2,
    read(offset = 0) {
      if (offset < 0) throw new Error("invalid offset");
      return this.value + offset;
    },
  };
  let current: typeof first | null = first;
  const methods = createWebMethodForwarders(() => {
    if (!current) throw new Error("detached");
    return current;
  }, ["read"]);
  expect(methods.read()).toBe(1);
  expect(methods.read(3)).toBe(4);
  expect(() => methods.read(-1)).toThrow("invalid offset");
  current = second;
  expect(methods.read()).toBe(2);
  expect(methods.read(3)).toBe(5);
  current = null;
  expect(() => methods.read()).toThrow("detached");
});
