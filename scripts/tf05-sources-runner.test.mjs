import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf05-sources-smoke.mjs", import.meta.url),
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
const configuration = section("const group =", "// Runs after");
for (const args of [
  ["android", "bad"],
  ["android", "maplibre", "extra"],
  ["web", "maplibre"],
  ["bogus"],
  ["android", "maplibre"],
]) {
  assert.throws(
    () =>
      evaluate(configuration, {
        process: {
          argv: ["node", "runner", ...args],
          env: {},
          exit: () => {
            throw new Error("Use a supported scope");
          },
        },
      }),
    /scope|Use|ANDROID_SERIAL/
  );
}
const selected = evaluate(`${configuration}; ({nativeEngines, androidArgs})`, {
  process: {
    argv: ["node", "runner", "android", "maplibre"],
    env: { ANDROID_SERIAL: "emulator-5580" },
  },
});
assert.deepEqual(Array.from(selected.nativeEngines), ["maplibre"]);
assert(selected.androidArgs.includes("emulator-5580"));
for (const scope of ["sources"]) {
  for (const mode of [
    "pass36",
    "pass37",
    "pass38",
    "pass-reuse",
    "install-failure",
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
      if (args.includes("install")) {
        assert.deepEqual(Array.from(args), [
          "install",
          "-r",
          "-t",
          "/approved/app-debug.apk",
        ]);
        if (mode === "install-failure") throw new Error(mode);
        installed = true;
      }
      if (file === "bun") {
        assert(!["pass-reuse", "install-failure"].includes(mode));
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
          args.includes("com.onemapmaplibre") &&
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
      lifetimes: scope === "lifetimes",
      process: { env: { ANDROID_SERIAL: "emulator-5580" } },
      fixture: scope === "lifetimes" ? { requests: [] } : null,
      reuseIosDigest: undefined,
      androidBinaryDigest: ["pass-reuse", "install-failure"].includes(mode)
        ? "a".repeat(64)
        : undefined,
      androidBinaryPath: "/approved/app-debug.apk",
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
        assert.equal(options.env.TF05_BASE, "http://127.0.0.1:8798");
        assert.equal(options.env.ONE_MAP_SMOKE, "tf05");
        return metro;
      },
      lanAddress: async () =>
        assert.fail("Android transport must use loopback"),
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
        assert.equal(app, "com.onemapmaplibre");
        assert.equal(host, "localhost:8081");
        configured = true;
      },
      startAndroidApp: async () => {
        assert(configured && (Number(sdk) < 37 || granted));
        launched = true;
      },
      allowNearbyDevices: async () =>
        assert.fail("Android scope must not click permissions"),
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
      directory: "native-maplibre",
      platform: "android",
      applicationId: "com.onemapmaplibre",
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
      if (
        [
          "install-failure",
          "grant-failure",
          "getprop-failure",
          "build-failure",
          "status-failure",
          "metro-spawn",
          "metro-timeout",
        ].includes(mode)
      )
        assert.match(result.error, new RegExp(mode));
    }
    assert(cleanup.includes("metro") && cleanup.includes("port"), mode);
    if (
      [
        "invalid-api",
        "install-failure",
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
}

const free = section("async function freePort(", "const runWebCorrections");
for (const message of [null, "lsof exited 1", "permission denied"]) {
  const check = evaluate(`(${free.trim()})`, {
    command: async () => {
      if (message) throw new Error(message);
      return "321";
    },
  });
  if (message === "lsof exited 1") await check(8081);
  else await assert.rejects(check(8081), /occupied|permission denied/);
}
console.log(
  "PASS selected Android transport, API order, failures, owned cleanup and unknown listener controls; no host tools executed."
);
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
        {}
      ),
      command: async (_file, args) => {
        if (args.includes("logcat")) {
          if (mode === "log-failure") throw new Error(mode);
          return mode === "log" ? "TF05 done=1" : "";
        }
        if (args.includes("dump") && mode === "dump-failure")
          throw new Error(mode);
        if (args.includes("exec-out")) {
          if (mode === "read-failure") throw new Error(mode);
          return mode === "ui" ? 'text="TF05 done=1"' : "";
        }
        return "";
      },
    }
  );
  if (mode.endsWith("failure"))
    await assert.rejects(readStatus(), new RegExp(mode));
  else assert.equal(await readStatus(), mode === "empty" ? "" : "TF05 done=1");
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

const main = evaluate(
  `(${section("async function main()", "async function runWeb(")})`,
  {
    group: "android",
    nativeEngines: ["maplibre", "mapbox"],
    startFixtureServer: async () => ({
      close: async () => {
        closed = true;
      },
    }),
    runNative: async ({ directory }) => {
      assert.equal(directory, "native-maplibre");
      calls++;
      return { status: "failed" };
    },
    console: { log: () => {} },
  }
);
let closed = false;
let calls = 0;
await assert.rejects(main(), /no later engine/);
assert.equal(calls, 1);
assert(closed);
const binding = evaluate(
  `(${section("async function startFixtureServer()", "function pngPixel(")})`,
  {
    pngPixel: () => "pixel",
    group: "android",
    createServer: () => ({
      once: (_event, reject) => {
        queueMicrotask(() => reject(new Error("bind conflict")));
      },
      listen: (_port, host) => assert.equal(host, "127.0.0.1"),
    }),
  }
);
await assert.rejects(binding(), /bind conflict/);

for (const [group, selector, digest, actual, succeeds] of [
  ["android", "maplibre", "a".repeat(64), "a".repeat(64), true],
  ["android", "maplibre", "a".repeat(64), "b".repeat(64), false],
  ["android", undefined, "a".repeat(64), "a".repeat(64), false],
  ["ios", undefined, "a".repeat(64), "a".repeat(64), false],
  ["android", "maplibre", "invalid", "invalid", false],
]) {
  const check = () =>
    evaluate(configuration, {
      process: {
        argv: ["node", "runner", group, ...(selector ? [selector] : [])],
        env: {
          ANDROID_SERIAL: "emulator-5580",
          TF05_ANDROID_BINARY_SHA256: digest,
        },
      },
      root: "/harness",
      join: (...parts) => parts.join("/"),
      readFileSync: (path) => {
        assert.equal(
          path,
          "/harness/examples/native-maplibre/android/app/build/outputs/apk/debug/app-debug.apk"
        );
        return "bytes";
      },
      createHash: () => ({ update: () => ({ digest: () => actual }) }),
    });
  if (succeeds) check();
  else assert.throws(check, /APK|digest/);
}

const judgeStatus = evaluate(
  `(${section("function judge(", "function encodeEmptyVectorTile(")})`,
  {}
);
const fields = {
  mounted: "1",
  reset: "ok",
  data: "updated",
  style: "rebuilt",
  removed: "clean",
  error: "none",
  note: "none",
  phase: "done",
  done: "1",
};
const line = (value) =>
  "TF05 " +
  Object.entries(value)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
assert.equal(judgeStatus(line(fields)).status, "passed");
for (const key of Object.keys(fields))
  assert.equal(
    judgeStatus(line({ ...fields, [key]: "pending" })).status,
    "failed",
    key
  );
