import { expect, test } from "vite-plus/test";

import { createWebMethodForwarders } from "../src/adapters/web/method-forwarders.js";

test("unchanged delegates retain the current receiver, synchronous results and errors", () => {
  const first = {
    value: 1,
    read() {
      return this.value;
    },
  };
  const second = {
    value: 2,
    read() {
      return this.value;
    },
  };
  let current: typeof first | null = first;
  const methods = createWebMethodForwarders(() => {
    if (!current) throw new Error("detached");
    return current;
  }, ["read"]);
  expect(methods.read()).toBe(1);
  current = second;
  expect(methods.read()).toBe(2);
  current = null;
  expect(() => methods.read()).toThrow("detached");
});
