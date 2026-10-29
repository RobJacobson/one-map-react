import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf06-queries-smoke.mjs", import.meta.url),
  "utf8"
);
const section = (start, end) => {
  const a = source.indexOf(start);
  const b = end ? source.indexOf(end, a + start.length) : source.length;
  assert(a >= 0 && b > a);
  return source.slice(a, b);
};
const evaluate = (text, context) =>
  runInNewContext(text, { Error, Promise, console, ...context });
const child = () => {
  const value = new EventEmitter();
  value.stdout = new EventEmitter();
  value.stderr = new EventEmitter();
  return value;
};
const runSource = section(
  "async function runNative(",
  "async function watchNative("
);
const grantSource = () =>
  section(
    "async function grantAndroidTransportPermission(",
    "async function startAndroidApp("
  );
for (const mode of [
  "pass36",
  "pass37",
  "pass38",
  "invalid-api",
  "grant-failure",
  "getprop-failure",
  "build-failure",
  "status-failure",
  "metro-exit",
  "metro-spawn",
  "metro-timeout",
  "metro-poll-exit",
  "cleanup-failure",
]) {
  const sdk =
    { pass36: "36", pass38: "38", "invalid-api": "invalid" }[mode] ?? "37";
  const metro = child();
  const cleanup = [];
  const calls = [];
  let installed = false;
  let configured = false;
  let granted = false;
  let launched = false;
  const command = async (file, args, options) => {
    calls.push([file, ...args]);
    assert(!args.includes("input") && !args.includes("uiautomator"));
    if (file === "bun") {
      assert.deepEqual(Array.from(args), [
        "run",
        "android",
        "--",
        "--no-packager",
        "--device",
        "emulator-5580",
        "--active-arch-only",
      ]);
      assert.equal(options.env.ANDROID_SERIAL, "emulator-5580");
      if (mode === "build-failure") throw new Error(mode);
      installed = true;
    }
    if (args.includes("getprop")) {
      assert(installed && configured && !launched);
      if (mode === "getprop-failure") throw new Error(mode);
      return sdk;
    }
    if (args.includes("grant")) {
      assert(installed && configured && !launched);
      assert(
        args.includes("com.onemapmapbox") &&
          args.includes("android.permission.ACCESS_LOCAL_NETWORK")
      );
      if (mode === "grant-failure") throw new Error(mode);
      granted = true;
    }
    if (args.includes("force-stop")) {
      cleanup.push("app");
      if (mode === "cleanup-failure") throw new Error(mode);
    }
    return "";
  };
  const grant = evaluate(`(${grantSource()})`, { command });
  const run = evaluate(`(${runSource})`, {
    root: "/harness",
    join: (...parts) => parts.join("/"),
    lifetimes: true,
    process: { env: { ANDROID_SERIAL: "emulator-5580" } },
    fixture: { requests: [] },
    reuseIosDigest: undefined,
    androidArgs: [
      "run",
      "android",
      "--",
      "--no-packager",
      "--device",
      "emulator-5580",
      "--active-arch-only",
    ],
    freePort: async () => {},
    command,
    grantAndroidTransportPermission: grant,
    spawn: (_file, _args, options) => {
      assert(options.detached);
      assert.equal(options.env.TF06_BASE, "http://127.0.0.1:8798");
      return metro;
    },
    lanAddress: async () => assert.fail("Lifetime transport must use loopback"),
    waitFor: async (ready) => {
      metro.stdout.emit("data", "Metro on port 8081");
      assert.equal(
        ready(),
        false,
        "A port banner does not establish readiness"
      );
      if (mode === "metro-exit") metro.emit("exit", 2);
      if (mode === "metro-spawn") metro.emit("error", new Error(mode));
      if (mode === "metro-timeout") throw new Error(mode);
      if (["metro-exit", "metro-spawn"].includes(mode)) ready();
      metro.stdout.emit("data", "Dev server ready");
      assert.equal(ready(), true);
    },
    removeAndroidBundle: async () => {},
    writeDebugHost: async (app, host) => {
      assert(installed);
      assert.equal(app, "com.onemapmapbox");
      assert.equal(host, "localhost:8081");
      configured = true;
    },
    startAndroidApp: async () => {
      assert(configured && (Number(sdk) < 37 || granted));
      launched = true;
    },
    allowNearbyDevices: async () =>
      assert.fail("Lifetime scope must not click permissions"),
    readAndroidStatus: async () => {
      if (mode === "status-failure") throw new Error(mode);
      return "done=1";
    },
    watchNative: async ({ readStatus }) => {
      assert(launched);
      if (mode === "metro-poll-exit") metro.emit("exit", 2);
      return readStatus();
    },
    judge: () => ({ status: "passed" }),
    stopOwnedProcess: async () => cleanup.push("metro"),
    awaitMetroPortRelease: async () => cleanup.push("port"),
  });
  const pending = run({
    directory: "native-mapbox",
    platform: "android",
    applicationId: "com.onemapmapbox",
  });
  if (mode === "cleanup-failure")
    await assert.rejects(pending, /cleanup-failure/);
  else {
    const result = await pending;
    assert.equal(
      result.status,
      mode.startsWith("pass") ? "passed" : "failed",
      JSON.stringify(result)
    );
    if (mode === "invalid-api")
      assert.match(result.error, /Invalid Android API/);
  }
  assert(cleanup.includes("metro") && cleanup.includes("port"), mode);
  if (
    [
      "invalid-api",
      "grant-failure",
      "getprop-failure",
      "build-failure",
      "metro-exit",
      "metro-spawn",
      "metro-timeout",
    ].includes(mode)
  )
    assert.equal(launched, false);
  if (sdk === "36") assert.equal(granted, false);
}

const unassignedRun = evaluate(`(${runSource})`, {
  root: "/harness",
  join: (...parts) => parts.join("/"),
  lifetimes: true,
  process: { env: {} },
  freePort: async () =>
    assert.fail("Unassigned lifetime run must fail before acquiring resources"),
});
await assert.rejects(
  unassignedRun({ directory: "native-mapbox", platform: "android" }),
  /ANDROID_SERIAL/
);

for (const failure of ["app", "status", "metro", "bind", null]) {
  const cleanup = [];
  const run = evaluate(`(${runSource})`, {
    root: "/harness",
    join: (...parts) => parts.join("/"),
    lifetimes: true,
    process: { env: {} },
    fixture: null,
    reuseIosDigest: undefined,
    iosUdid: "8B7D7CE4-228E-409F-A156-A597D4E448A5",
    freePort: async () => {},
    spawn: child,
    waitFor: async () => {},
    command: async (_file, args) => {
      if (args.includes("terminate")) {
        cleanup.push("app");
        if (cleanup.length > 1 && failure === "app") throw new Error("app");
      }
      return "";
    },
    openStatusPort: async () => {
      if (failure === "bind") throw new Error("bind");
      return {
        read: () => "done=1",
        close: async () => {
          cleanup.push("status");
          if (failure === "status") throw new Error("status");
        },
      };
    },
    watchNative: async ({ readStatus }) => readStatus(),
    judge: () => ({ status: "passed" }),
    stopOwnedProcess: async () => {
      cleanup.push("metro");
      if (failure === "metro") throw new Error("metro");
    },
    awaitMetroPortRelease: async () => cleanup.push("port"),
  });
  const pending = run({
    directory: "native-mapbox",
    platform: "ios",
    applicationId: "selected-app",
  });
  if (failure && failure !== "bind")
    await assert.rejects(pending, new RegExp(failure));
  else assert.equal((await pending).status, failure ? "failed" : "passed");
  assert(cleanup.includes("metro") && cleanup.includes("port"));
  if (failure !== "bind") assert(cleanup.includes("status"));
}

const iosUdid = "8B7D7CE4-228E-409F-A156-A597D4E448A5";
const iosDigest = "a".repeat(64);
for (const mode of [
  "build",
  "reuse",
  "mismatch",
  "bad-app",
  "bad-executable",
  "bad-identifier",
  "bad-package",
  "debug-dylib",
  "missing-app",
  "not-running",
  "service-error",
  "build-error",
  "install-error",
  "launch-error",
  "watch-error",
  "bind-error",
]) {
  const calls = [];
  const cleanup = [];
  const nativeFixture = { requests: ["stale"] };
  let opened = false;
  let launched = false;
  const reuse = [
    "reuse",
    "mismatch",
    "bad-app",
    "bad-executable",
    "bad-identifier",
    "bad-package",
    "debug-dylib",
  ].includes(mode);
  const run = evaluate(`(${runSource})`, {
    root: "/harness",
    join: (...parts) => parts.join("/"),
    lifetimes: true,
    scope: "lifetimes",
    process: {
      env: {
        TF06_IOS_UDID: iosUdid,
        ...(mode === "build"
          ? { TF06_IOS_BUILD_FOLDER: "/task/ios-build" }
          : {}),
      },
    },
    iosUdid,
    fixture: nativeFixture,
    existsSync: () => mode === "debug-dylib",
    reuseIosDigest: reuse ? iosDigest : undefined,
    freePort: async () => {},
    spawn: child,
    waitFor: async () => {},
    command: async (file, args) => {
      calls.push([file, ...args]);
      assert(!args.includes("booted") && !args.includes("--simulator"));
      if (file === "xcrun") assert.equal(args[2], iosUdid);
      if (args.includes("terminate")) {
        cleanup.push("app");
        if (!opened) nativeFixture.requests.push("old-app-final-callback");
        if (!opened && cleanup.length === 1) {
          if (mode === "service-error")
            throw new Error("CoreSimulator service unavailable");
          if (mode === "missing-app")
            throw new Error("Application is not installed");
          if (mode === "not-running")
            throw new Error("Application is not running");
        }
      }
      if (args.includes("get_app_container"))
        return mode === "bad-app" ? "/tmp/not-an-app" : "/tmp/Map.app";
      if (file === "/usr/libexec/PlistBuddy") {
        if (args[1].includes("CFBundleExecutable"))
          return mode === "bad-executable" ? "../escape" : "Map";
        if (args[1].includes("CFBundleIdentifier"))
          return mode === "bad-identifier" ? "other-app" : "selected-app";
        if (args[1].includes("CFBundlePackageType"))
          return mode === "bad-package" ? "BNDL" : "APPL";
        assert.fail("Unexpected plist request");
      }
      if (file === "shasum")
        return `${mode === "mismatch" ? "b".repeat(64) : iosDigest}  /tmp/Map.app/Map`;
      assert.notEqual(
        file,
        "bun",
        "Lifetime build/install must check every native exit"
      );
      if (file === "xcodebuild") {
        assert(!reuse, "Reuse must not build");
        assert.deepEqual(Array.from(args), [
          "-workspace",
          "/harness/examples/native-mapbox/ios/OneMapMapbox.xcworkspace",
          "-scheme",
          "OneMapMapbox",
          "-configuration",
          "Debug",
          "-destination",
          `id=${iosUdid}`,
          "-derivedDataPath",
          mode === "build"
            ? "/task/ios-build"
            : "/harness/examples/native-mapbox/ios/build",
          "build",
        ]);
        if (mode === "build-error") throw new Error(mode);
      }
      if (args.includes("install")) {
        assert(calls.some(([name]) => name === "xcodebuild"));
        assert.equal(
          args[3],
          `${mode === "build" ? "/task/ios-build" : "/harness/examples/native-mapbox/ios/build"}/Build/Products/Debug-iphonesimulator/OneMapMapbox.app`
        );
        if (mode === "install-error") throw new Error(mode);
      }
      if (args.includes("launch")) {
        if (!reuse) assert(calls.some((call) => call.includes("install")));
        if (mode === "launch-error") throw new Error(mode);
        launched = true;
      }
      return "";
    },
    verifyNativeBinary: (_scope, expected, actual) =>
      assert.equal(actual, expected),
    openStatusPort: async () => {
      assert.equal(cleanup[0], "app", "Stop stale callbacks before collection");
      assert.equal(nativeFixture.requests.length, 0);
      opened = true;
      if (mode === "bind-error") throw new Error(mode);
      return {
        read: () => "done=1",
        close: async () => cleanup.push("status"),
      };
    },
    watchNative: async ({ readStatus }) => {
      assert(launched);
      if (mode === "watch-error") throw new Error(mode);
      return readStatus();
    },
    judge: () => ({ status: "passed" }),
    stopOwnedProcess: async () => cleanup.push("metro"),
    awaitMetroPortRelease: async () => cleanup.push("port"),
  });
  const result = await run({
    directory: "native-mapbox",
    platform: "ios",
    applicationId: "selected-app",
  });
  const passed = ["build", "reuse", "missing-app", "not-running"].includes(
    mode
  );
  assert.equal(
    result.status,
    passed ? "passed" : "failed",
    `${mode}: ${JSON.stringify(result)}`
  );
  assert(cleanup.includes("metro") && cleanup.includes("port"), mode);
  if (!passed) assert.equal(launched, mode === "watch-error", mode);
  if (mode === "build") {
    assert.equal(
      result.producedAppPath,
      "/task/ios-build/Build/Products/Debug-iphonesimulator/OneMapMapbox.app"
    );
    assert.equal(calls.filter(([file]) => file === "xcodebuild").length, 1);
  }
  if (mode === "reuse")
    assert.equal(result.installedExecutableSha256, iosDigest);
}

for (const mode of ["busy", "empty", "broken"]) {
  const freePort = evaluate(`(${section("async function freePort(")})`, {
    command: async () => {
      if (mode === "busy") return "123";
      throw new Error(mode === "empty" ? "lsof exited 1" : "lsof timed out");
    },
    process: { kill: () => assert.fail("Never kill unknown listeners") },
  });
  if (mode === "empty") await freePort(8081);
  else await assert.rejects(freePort(8081));
}

for (const mode of [
  "log",
  "ui",
  "empty",
  "log-failure",
  "dump-failure",
  "read-failure",
]) {
  const readStatus = evaluate(
    `(${section("async function readAndroidStatus(", "function openStatusPort(")})`,
    {
      latestStatus: evaluate(
        `(${section("function latestStatus(", "function judge(")})`,
        { statusPrefix: "TF06L " }
      ),
      command: async (_file, args) => {
        if (args.includes("logcat")) {
          if (mode === "log-failure") throw new Error(mode);
          return mode === "log" ? "TF06L done=1" : "";
        }
        if (args.includes("dump") && mode === "dump-failure")
          throw new Error(mode);
        if (args.includes("exec-out")) {
          if (mode === "read-failure") throw new Error(mode);
          return mode === "ui" ? 'text="TF06L done=1"' : "";
        }
        return "";
      },
    }
  );
  if (mode.endsWith("failure"))
    await assert.rejects(readStatus(), new RegExp(mode));
  else assert.equal(await readStatus(), mode === "empty" ? "" : "TF06L done=1");
}

for (const mode of ["timeout", "nonzero", "spawn-failure"]) {
  const owned = child();
  let stopped = false;
  const command = evaluate(
    `(${section("function command(", "async function freePort(")})`,
    {
      setTimeout,
      clearTimeout,
      spawn: (_file, _args, options) => {
        assert(options.detached);
        return owned;
      },
      stopOwnedProcess: async (value) => {
        assert.equal(value, owned);
        stopped = true;
        owned.emit("close", null);
      },
    }
  );
  const pending = command("build", [], {}, 5);
  if (mode === "nonzero") owned.emit("close", 2);
  if (mode === "spawn-failure") owned.emit("error", new Error(mode));
  await assert.rejects(pending);
  assert(stopped);
}

const androidBlock = section(
  '  if (group === "android" || group === "all") {',
  '\n  if (group === "ios" || group === "all") {'
);
for (const [engines, status, expected] of [
  [["mapbox"], "passed", 1],
  [["mapbox", "maplibre"], "failed", 1],
]) {
  const invoked = [];
  const emitted = [];
  const pending = evaluate(`(async () => { ${androidBlock} })()`, {
    console: { log: (output) => emitted.push(JSON.parse(output)) },
    group: "android",
    nativeEngines: engines,
    results: {},
    runNative: async ({ directory }) => {
      invoked.push(directory);
      return { status, error: "actual startup failure", log: "Metro evidence" };
    },
  });
  if (status === "failed") await assert.rejects(pending);
  else await pending;
  if (status === "failed") {
    assert.equal(emitted[0]["mapbox-android"].error, "actual startup failure");
    assert.equal(emitted[0]["mapbox-android"].log, "Metro evidence");
  }
  assert.equal(invoked.length, expected);
  assert.equal(invoked[0], "native-mapbox");
}
const iosValidation = section("const iosUdid =", "const reuseIosDigest =");
for (const group of ["ios", "all"]) {
  for (const assigned of [
    undefined,
    "",
    "booted",
    "iPhone 18 Pro",
    "invalid",
  ]) {
    assert.throws(
      () =>
        evaluate(iosValidation, {
          group,
          process: { env: { TF06_IOS_UDID: assigned } },
        }),
      /TF06_IOS_UDID/
    );
  }
  evaluate(iosValidation, {
    group,
    process: { env: { TF06_IOS_UDID: iosUdid } },
  });
}
assert(
  source.indexOf("const iosUdid =") <
    source.indexOf("await startLifetimesFixture()")
);
const iosBlock = section(
  '  if (group === "ios" || group === "all") {',
  "} finally {\n  await fixture?.close();"
);
const iosInvoked = [];
await assert.rejects(
  evaluate(`(async () => { ${iosBlock} })()`, {
    group: "ios",
    nativeEngines: ["mapbox", "maplibre"],
    results: {},
    console: { log: () => {} },
    runNative: async ({ directory }) => {
      iosInvoked.push(directory);
      return { status: "failed" };
    },
  })
);
assert.deepEqual(iosInvoked, ["native-mapbox"]);
const wrapperRoot = realpathSync(
  mkdtempSync(join(tmpdir(), "one-map-ios-env-"))
);
try {
  const wrapper = join(wrapperRoot, "with-ios-env.sh");
  copyFileSync(new URL("./with-ios-env.sh", import.meta.url), wrapper);
  const environment = {
    ...process.env,
    MAPBOX_ACCESS_TOKEN: "mock-token",
    TF06_IOS_BINARY_SHA256: "inherited",
    EXPECTED_ROOT: wrapperRoot,
  };
  const checked = spawnSync(
    "/bin/sh",
    [
      wrapper,
      "/bin/sh",
      "-c",
      `
    test "$RUBYLIB" = "$EXPECTED_ROOT/ruby-bundler-load-path" &&
    test "$BUNDLE_PATH" = "$EXPECTED_ROOT/ruby-gems" &&
    test "$TF06_IOS_BUILD_FOLDER" = "$EXPECTED_ROOT/native-harness/examples/native-mapbox/ios/build" &&
    test "$TF06_IOS_UDID" = "${iosUdid}" &&
    test "$MAPBOX_ACCESS_TOKEN" = "mock-token" &&
    test -z "\${TF06_IOS_BINARY_SHA256-}" &&
    case "$PATH" in "$EXPECTED_ROOT/runtime-bin:/opt/homebrew/bin:"*) exit 0;; *) exit 1;; esac
  `,
    ],
    { env: environment }
  );
  assert.equal(checked.status, 0, checked.stderr.toString());
  delete environment.MAPBOX_ACCESS_TOKEN;
  assert.notEqual(
    spawnSync("/bin/sh", [wrapper, "/usr/bin/true"], { env: environment })
      .status,
    0
  );
} finally {
  rmSync(wrapperRoot, { recursive: true, force: true });
}
console.log(
  "PASS TF06 mocked iOS and Android lifetime startup, selected engine/device, API permission ordering, transport, readiness, errors and owned cleanup; no host tools executed."
);
