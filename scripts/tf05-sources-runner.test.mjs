import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  "/** Stop only the assigned app"
);
const grantSource = () =>
  section(
    "async function grantAndroidTransportPermission(",
    "async function startAndroidApp("
  );
const configuration = section("const group =", "// Runs after");
for (const args of [
  ["ios", "maplibre"],
  ["ios", "bad"],
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
    /scope|Use|ANDROID_SERIAL|TF05_IOS_UDID/
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
    "pass-mapbox-reuse",
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
    const engine = mode === "pass-mapbox-reuse" ? "mapbox" : "maplibre";
    const applicationId = `com.onemap${engine}`;
    const reuseBinary = [
      "pass-reuse",
      "pass-mapbox-reuse",
      "install-failure",
    ].includes(mode);
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
        assert(!reuseBinary);
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
          args.includes(applicationId) &&
            args.includes("android.permission.ACCESS_LOCAL_NETWORK")
        );
        if (mode === "grant-failure") throw new Error(mode);
        granted = true;
      }
      if (args.includes("force-stop")) {
        assert(args.includes(applicationId));
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
      androidBinaryDigest: reuseBinary ? "a".repeat(64) : undefined,
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
        assert.equal(options.cwd, `/harness/examples/native-${engine}`);
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
        assert.equal(app, applicationId);
        assert.equal(host, "localhost:8081");
        configured = true;
      },
      startAndroidApp: async (app) => {
        assert.equal(app, applicationId);
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
      directory: `native-${engine}`,
      platform: "android",
      applicationId,
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

for (const engine of ["maplibre", "mapbox"]) {
  const scheme = engine === "mapbox" ? "OneMapMapbox" : "OneMapMaplibre";
  for (const mode of [
    "pass",
    "build-failure",
    "install-failure",
    "launch-failure",
    "status-failure",
    "metro-poll-exit",
    "terminate-failure",
    "cleanup-failure",
    "status-bind-failure",
    "port-conflict",
  ]) {
    const metro = child();
    const calls = [];
    const cleanup = [];
    let terminated = 0;
    let bound = false;
    let built = false;
    let installed = false;
    let launched = false;
    const udid = "8B7D7CE4-228E-409F-A156-A597D4E448A5";
    const command = async (file, args) => {
      calls.push([file, ...args]);
      if (file === "xcodebuild") {
        assert(bound && !built && !installed && !launched);
        assert(
          args.includes(
            `/harness/examples/native-${engine}/ios/${scheme}.xcworkspace`
          )
        );
        assert(args.includes(scheme) && args.includes(`id=${udid}`));
        assert(args.includes("/short/build"));
        if (mode === "build-failure") throw new Error(mode);
        built = true;
      } else {
        assert.equal(file, "xcrun");
        assert.equal(args[0], "simctl");
        assert.equal(args[2], udid);
        if (["terminate", "launch"].includes(args[1]))
          assert.equal(args[3], `org.reactjs.native.example.${scheme}`);
        if (args[1] === "terminate") {
          terminated++;
          if (
            mode === "terminate-failure" ||
            (mode === "cleanup-failure" && terminated === 2)
          )
            throw new Error(mode);
        }
        if (args[1] === "install") {
          assert(built && !launched);
          assert.equal(
            args[3],
            `/short/build/Build/Products/Debug-iphonesimulator/${scheme}.app`
          );
          if (mode === "install-failure") throw new Error(mode);
          installed = true;
        }
        if (args[1] === "launch") {
          assert(installed);
          if (mode === "launch-failure") throw new Error(mode);
          launched = true;
        }
      }
      return "";
    };
    const terminateIosApp = evaluate(
      section("const terminateIosApp =", "async function watchNative(") +
        "; terminateIosApp",
      { command, iosUdid: udid }
    );
    const run = evaluate(`(${runSource})`, {
      root: "/harness",
      join: (...parts) => parts.join("/"),
      process: { env: { TF05_IOS_BUILD_FOLDER: "/short/build" } },
      iosUdid: udid,
      freePort: async (port) => {
        if (port === 8799 && mode === "port-conflict") throw new Error(mode);
      },
      spawn: () => {
        assert(mode !== "port-conflict");
        return metro;
      },
      command,
      terminateIosApp,
      openStatusPort: async () => {
        assert.equal(terminated, 1);
        if (mode === "status-bind-failure") throw new Error(mode);
        bound = true;
        return {
          read: () => "done=1",
          close: async () => cleanup.push("status"),
        };
      },
      waitFor: async (ready) => {
        metro.stdout.emit("data", "Dev server ready");
        assert(ready());
      },
      watchNative: async ({ readStatus }) => {
        assert(launched);
        if (mode === "status-failure") throw new Error(mode);
        if (mode === "metro-poll-exit") metro.emit("exit", 2);
        return readStatus();
      },
      judge: () => ({ status: "passed" }),
      stopOwnedProcess: async () => cleanup.push("metro"),
      awaitMetroPortRelease: async () => cleanup.push("port"),
    });
    const pending = run({
      directory: `native-${engine}`,
      platform: "ios",
      applicationId: `org.reactjs.native.example.${scheme}`,
    });
    if (
      ["cleanup-failure", "terminate-failure", "port-conflict"].includes(mode)
    )
      await assert.rejects(pending, new RegExp(mode));
    else {
      const result = await pending;
      assert.equal(result.status, mode === "pass" ? "passed" : "failed", mode);
      if (mode === "pass")
        assert.equal(
          result.producedAppPath,
          `/short/build/Build/Products/Debug-iphonesimulator/${scheme}.app`
        );
    }
    if (mode !== "port-conflict") {
      assert(cleanup.includes("metro") && cleanup.includes("port"), mode);
      if (bound) assert(cleanup.includes("status"), mode);
    }
    if (
      [
        "build-failure",
        "install-failure",
        "launch-failure",
        "terminate-failure",
        "status-bind-failure",
        "port-conflict",
      ].includes(mode)
    )
      assert(!launched, mode);
    assert.equal(
      calls.filter(([file]) => file === "xcodebuild").length,
      built || mode === "build-failure" ? 1 : 0
    );
  }
}
for (const message of [
  "application is not running",
  "found nothing to terminate",
  "no such process",
  "permission denied",
]) {
  const terminate = evaluate(
    section("const terminateIosApp =", "async function watchNative(") +
      "; terminateIosApp",
    {
      command: async () => {
        throw new Error(message);
      },
      iosUdid: "assigned",
    }
  );
  if (message === "permission denied")
    await assert.rejects(terminate("app"), /permission denied/);
  else await terminate("app");
}
for (const engine of ["maplibre", "mapbox"]) {
  const selectedIos = evaluate(`${configuration}; ({nativeEngines})`, {
    process: {
      argv: ["node", "runner", "ios", engine],
      env: { TF05_IOS_UDID: "8B7D7CE4-228E-409F-A156-A597D4E448A5" },
    },
  });
  assert.deepEqual(Array.from(selectedIos.nativeEngines), [engine]);
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

for (const group of ["android", "ios"]) {
  const main = evaluate(
    `(${section("async function main()", "async function runWeb(")})`,
    {
      group,
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
}
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
  ["android", "mapbox", "a".repeat(64), "a".repeat(64), true],
  ["android", "mapbox", "a".repeat(64), "b".repeat(64), false],
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
          TF05_IOS_UDID: "8B7D7CE4-228E-409F-A156-A597D4E448A5",
          TF05_ANDROID_BINARY_SHA256: digest,
        },
      },
      root: "/harness",
      join: (...parts) => parts.join("/"),
      readFileSync: (path) => {
        assert.equal(
          path,
          `/harness/examples/native-${selector}/android/app/build/outputs/apk/debug/app-debug.apk`
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

for (const engine of ["maplibre", "mapbox"]) {
  const expectedToken = engine === "mapbox" ? "mock-public-token" : "";
  const wrapperRoot = mkdtempSync(join(tmpdir(), "one-map-tf05-wrapper-"));
  try {
    const wrapper = join(wrapperRoot, `with-${engine}-ios-sources-env.sh`);
    cpSync(
      new URL(`./with-${engine}-ios-sources-env.sh`, import.meta.url),
      wrapper
    );
    symlinkSync(wrapper, join(wrapperRoot, "alias.sh"));
    const probe = spawnSync(
      "/bin/sh",
      [
        join(wrapperRoot, "alias.sh"),
        process.execPath,
        "-e",
        `
    const env = process.env;
    if (env.DEVELOPER_DIR !== "/Applications/Xcode.app/Contents/Developer") process.exit(7);
    if (env.TF05_IOS_UDID !== "8B7D7CE4-228E-409F-A156-A597D4E448A5") process.exit(1);
    if (env.TF05_IOS_BUILD_FOLDER !== "/private/tmp/one-map-f05-ios/native-harness/examples/native-${engine}/ios/build") process.exit(2);
    if (!env.BUNDLE_GEMFILE.endsWith("/ios-ruby/Gemfile") || !env.BUNDLE_PATH.endsWith("/ios-ruby/gems")) process.exit(3);
    if (!env.RUBYLIB.endsWith("/ios-ruby/bundler-load-path")) process.exit(4);
    if (env.TF05_ANDROID_BINARY_SHA256) process.exit(5);
    if (env.MAPBOX_ACCESS_TOKEN !== ${JSON.stringify(expectedToken)}) process.exit(8);
    if (!env.PATH.startsWith(${JSON.stringify(realpathSync(wrapperRoot))} + "/runtime-bin:/opt/homebrew/opt/ruby/bin:")) process.exit(6);
  `,
      ],
      {
        env: {
          ...process.env,
          MAPBOX_ACCESS_TOKEN: expectedToken,
          TF05_ANDROID_BINARY_SHA256: "inherited",
        },
        encoding: "utf8",
      }
    );
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(probe.stdout, "");
  } finally {
    rmSync(wrapperRoot, { recursive: true, force: true });
  }
}
console.log(
  "PASS selected iOS checked build/install/launch, assigned UUID, stale status, failure cleanup and wrapper; no host tools executed."
);
