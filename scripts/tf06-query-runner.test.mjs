import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
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
console.log(
  "PASS TF06 mocked Android lifetime startup, selected engine/device, API permission ordering, transport, readiness, errors and owned cleanup; no host tools executed."
);
