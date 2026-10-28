import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(
  new URL("./tf04-camera-smoke.mjs", import.meta.url),
  "utf8"
);
const section = (start, end) => {
  const a = source.indexOf(start);
  const b = end ? source.indexOf(end, a + start.length) : source.length;
  assert(a >= 0 && b > a);
  return source.slice(a, b);
};
const evaluate = (text, context) =>
  runInNewContext(text, {
    Error,
    Promise,
    AbortController,
    console,
    ...context,
  });
const child = () => {
  const value = new EventEmitter();
  value.stdout = new EventEmitter();
  value.stderr = new EventEmitter();
  return value;
};
let checks = 0;
const freePortSource = section("async function freePort(");
for (const [outcome, blocked] of [
  ["busy", true],
  ["empty", false],
  ["broken", true],
]) {
  let signalled = false;
  const freePort = evaluate(`(${freePortSource})`, {
    command: async () => {
      if (outcome !== "busy")
        throw new Error(
          outcome === "empty" ? "lsof exited 1" : "lsof timed out"
        );
      return "54321";
    },
    process: {
      kill: () => {
        signalled = true;
      },
    },
  });
  if (blocked) await assert.rejects(freePort(8081));
  else await freePort(8081);
  assert.equal(signalled, false);
  checks++;
}
const runSource = section(
  "async function runNative(",
  "async function watchNative("
);
for (const mode of [
  "bind-failure",
  "build-failure",
  "success",
  "watch-failure",
]) {
  const metro = child();
  const cleanup = [];
  const calls = [];
  let reads = 0;
  const run = evaluate(`(${runSource})`, {
    root: "/harness",
    join: (...parts) => parts.join("/"),
    iosUdid: "assigned",
    freePort: async () => {},
    process: { env: {} },
    spawn: (_file, _args, options) => {
      assert.equal(options.detached, true);
      return metro;
    },
    openStatusPort: async () => {
      assert(
        calls[0].includes("terminate"),
        "Stop stale app before accepting status"
      );
      if (mode === "bind-failure") throw new Error("bind failed");
      return {
        read: () => "done=1",
        close: async () => {
          cleanup.push("status");
        },
      };
    },
    stopOwnedProcess: async (value) => {
      assert.equal(value, metro);
      cleanup.push("metro");
    },
    waitFor: async () => {},
    command: async (_file, args) => {
      calls.push(args);
      if (args.includes("terminate") || args.includes("launch")) {
        assert.equal(args[2], "assigned");
        return "";
      }
      assert(args.includes("--udid") && args.includes("assigned"));
      assert(!args.includes("--simulator"));
      if (mode === "build-failure") throw new Error("build failed immediately");
      return "";
    },
    watchNative: async ({ readStatus }) => {
      assert(
        calls.some((args) => args.includes("--udid")),
        "Await build before watching status"
      );
      if (mode === "watch-failure") throw new Error("watch failed");
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        reads++;
        readStatus();
      }
      return "done=1";
    },
    judge: () => ({ status: "passed" }),
  });
  const result = await run({
    directory: "native-mapbox",
    platform: "ios",
    applicationId: "app",
    doubleTap: false,
  });
  assert.equal(result.status, mode === "success" ? "passed" : "failed");
  assert(cleanup.includes("metro"));
  if (mode === "build-failure") {
    assert.match(result.error, /build failed immediately/);
    assert.equal(reads, 0);
  }

  checks++;
}
for (const message of [
  "Application is not running",
  "found nothing to terminate",
  "No such process",
  "CoreSimulator service unavailable",
  "CoreSimulatorService is not running",
]) {
  let acquired = false;
  const run = evaluate(`(${runSource})`, {
    root: "/harness",
    join: (...parts) => parts.join("/"),
    iosUdid: "assigned",
    freePort: async () => {},
    command: async () => {
      throw new Error(message);
    },
    process: { env: {} },
    spawn: () => {
      acquired = true;
      throw new Error("reached Metro");
    },
  });
  await assert.rejects(
    run({ directory: "native-mapbox", platform: "ios", applicationId: "app" })
  );
  assert.equal(acquired, !message.startsWith("CoreSimulator"));
  checks++;
}
const commandSource = section("function command(", "async function freePort(");
for (const mode of ["timeout", "nonzero", "driver-abort"]) {
  const owned = child();
  let stopped = false;
  const controller = new AbortController();
  const command = evaluate(`(${commandSource})`, {
    setTimeout,
    clearTimeout,
    spawn: (_file, _args, options) => {
      assert.equal(options.detached, true);
      assert.equal(options.signal, controller.signal);
      options.signal.addEventListener("abort", () => {
        owned.emit("error", new Error("aborted"));
      });
      return owned;
    },
    stopOwnedProcess: async (value) => {
      assert.equal(value, owned);
      stopped = true;
      owned.emit("close", null);
    },
  });
  const pending = command("build", [], { signal: controller.signal }, 5);
  if (mode === "driver-abort") controller.abort();
  if (mode === "nonzero") owned.emit("close", 2);
  await assert.rejects(pending);
  assert.equal(stopped, true);
  checks++;
}
const iosBlock = section(
  'if (group === "ios" || group === "all") {\n  const tapDriver',
  "\nconsole.log(JSON.stringify(results"
);
for (const firstStatus of ["failed", "passed"]) {
  const invoked = [];
  let stopped = false;
  const pending = evaluate(`(async () => { ${iosBlock} })()`, {
    group: "ios",
    results: {},
    startIosTapDriver: async () => ({
      driver: "owned-driver",
      assertRunning: () => {},
    }),
    runNative: async ({ directory }) => {
      invoked.push(directory);
      return { status: firstStatus };
    },
    stopOwnedProcess: async (value) => {
      assert.equal(value, "owned-driver");
      stopped = true;
    },
  });
  if (firstStatus === "failed") await assert.rejects(pending);
  else await pending;
  assert.equal(invoked.length, firstStatus === "failed" ? 1 : 2);
  assert(stopped);
  checks++;
}
const tapSource = section(
  "async function startIosTapDriver(",
  "function openStatusPort("
);
let tapArgs;
const tap = child();
const startTap = evaluate(`(${tapSource})`, {
  iosUdid: "assigned",
  root: "/harness",
  join: (...parts) => parts.join("/"),
  command: async () =>
    JSON.stringify({
      devices: {
        runtime: [
          { udid: "unrelated", state: "Booted", isAvailable: true },
          { udid: "assigned", state: "Booted", isAvailable: true },
        ],
      },
    }),
  freePort: async () => {},
  spawn: (_file, args, options) => {
    tapArgs = args;
    assert(options.detached);
    return tap;
  },
  waitFor: async () => {},
  stopOwnedProcess: async () => {},
});
const input = await startTap();
assert.equal(input.driver, tap);
assert(tapArgs.includes("platform=iOS Simulator,id=assigned"));
input.assertRunning();
tap.emit("exit", 2);
assert.throws(input.assertRunning, /iOS tap driver exited 2/);
assert.equal(input.signal.aborted, true);
checks++;
console.log(
  `PASS ${checks} mocked TF04 runner ownership, targeting, failure and timeout checks; no host tool executed.`
);

const basicBlock = section("if (mapboxBasic) {", '} else if (group === "ios"');
const basicInvocations = [];
await evaluate(`(async () => { ${basicBlock} } })()`, {
  mapboxBasic: true,
  results: {},
  runNative: async (options) => {
    basicInvocations.push(options);
    return { status: "passed" };
  },
});
assert.equal(basicInvocations.length, 1);
assert.equal(basicInvocations[0].directory, "native-mapbox");
assert.equal(basicInvocations[0].basic, true);
assert.equal(basicInvocations[0].inputDriver, undefined);
const watch = evaluate(
  `(${section("async function watchNative(", "function latestStatus(")})`,
  {
    delay: async () => {},
    tapMap: async () => {
      throw new Error("Basic camera scope must not tap");
    },
  }
);
const judgeBasic = evaluate(
  `(${section("function judge(", "// MapLibre Android")})`,
  {}
);
for (const [status, expected] of [
  ["TF04 fit=ok center=-122.32000,47.64000 phase=await-click done=0", "passed"],
  ["TF04 fit=ok center=-122.32000,47.61000 phase=await-click done=0", "failed"],
  ["TF04 fit=ok center=pending phase=await-click done=0", "failed"],
  ["TF04 fit=timeout center=pending phase=done done=1", "failed"],
]) {
  const observed = await watch({ readStatus: async () => status, basic: true });
  assert.equal(judgeBasic(observed, false, "ios", true).status, expected);
}
console.log(
  "PASS basic scope selects Mapbox only, requires fitted renderer center and sends no input."
);

let basicReads = 0;
await watch({
  readStatus: async () =>
    ++basicReads === 1
      ? "TF04 fit=pending phase=await-click done=0"
      : "TF04 fit=timeout phase=done done=1",
  basic: true,
});
assert.equal(basicReads, 2);
