import assert from "node:assert/strict";

import { withFusedLocationFixture } from "./tf08-fused-location-fixture.mjs";

const fixture = (originalMode = "default", failAt) => {
  const state = {
    mode: originalMode,
    provider: false,
    enabled: false,
    fixes: 0,
  };
  const adb = async (args) => {
    const action = args[4];
    if (args[2] === "appops") {
      if (args[3] === "get")
        return originalMode === "default"
          ? "No operations. Default mode: deny"
          : `MOCK_LOCATION: ${originalMode}`;
      state.mode = args.at(-1);
      return "";
    }
    if (action === failAt) throw new Error("fixture failure");
    if (action === "add-test-provider") state.provider = true;
    if (action === "set-test-provider-enabled") state.enabled = true;
    if (action === "set-test-provider-location") {
      assert(state.provider && state.enabled && state.mode === "allow");
      state.fixes += 1;
    }
    if (action === "remove-test-provider") state.provider = false;
    return "";
  };
  return { state, adb };
};

for (const mode of ["default", "allow", "ignore"]) {
  const { state, adb } = fixture(mode);
  assert.equal(
    await withFusedLocationFixture(adb, async (inject) => {
      await inject();
      return "measured native fix";
    }),
    "measured native fix"
  );
  assert.equal(state.fixes, 1);
  assert.equal(state.provider, false);
  assert.equal(state.mode, mode);
}
for (const failure of [
  "add-test-provider",
  "set-test-provider-enabled",
  "set-test-provider-location",
]) {
  const { state, adb } = fixture("default", failure);
  await assert.rejects(
    withFusedLocationFixture(adb, async (inject) => {
      await inject();
    }),
    /fixture failure/
  );
  assert.equal(state.provider, false);
  assert.equal(state.mode, "default");
}
const { state, adb } = fixture("deny");
await assert.rejects(
  withFusedLocationFixture(adb, async () => {
    throw new Error("acquisition failure");
  }),
  /acquisition failure/
);
assert.equal(state.provider, false);
assert.equal(state.mode, "deny");

console.log(
  "PASS TF08 fused location fixture: 7 permission/provider cleanup cases"
);
