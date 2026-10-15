/**
 * Runs native location acquisition against an OS mock fused provider on Android.
 * The pinned default MapLibre engine subscribes to fused; emulator GNSS console
 * input does not enter that idle provider. Restore both shell permission and the
 * original system provider even when acquisition fails.
 */
export const withFusedLocationFixture = async (adb, acquire) => {
  const current = await adb([
    "shell",
    "cmd",
    "appops",
    "get",
    "com.android.shell",
    "android:mock_location",
  ]);
  const originalMode = /No operations/i.test(current)
    ? "default"
    : current.match(
        /MOCK_LOCATION:\s*(allow|deny|ignore|default|foreground)/
      )?.[1];
  if (!originalMode)
    throw new Error(
      "Cannot establish shell mock-location permission for restoration."
    );
  let created = false;
  await setMockPermission(adb, "allow");
  try {
    await adb([
      "shell",
      "cmd",
      "location",
      "providers",
      "add-test-provider",
      "fused",
      "--accuracy",
      "1",
      "--powerRequirement",
      "3",
    ]);
    created = true;
    await adb([
      "shell",
      "cmd",
      "location",
      "providers",
      "set-test-provider-enabled",
      "fused",
      "true",
    ]);
    return await acquire(async () => {
      await adb([
        "shell",
        "cmd",
        "location",
        "providers",
        "set-test-provider-location",
        "fused",
        "--location",
        "47.62,-122.33",
        "--accuracy",
        "5",
      ]);
    });
  } finally {
    try {
      if (created)
        await adb([
          "shell",
          "cmd",
          "location",
          "providers",
          "remove-test-provider",
          "fused",
        ]);
    } finally {
      await setMockPermission(adb, originalMode);
    }
  }
};

const setMockPermission = (adb, mode) =>
  adb([
    "shell",
    "cmd",
    "appops",
    "set",
    "com.android.shell",
    "android:mock_location",
    mode,
  ]);
