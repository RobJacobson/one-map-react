import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const text = readFileSync(
  new URL("./tf07-ui-smoke.mjs", import.meta.url),
  "utf8"
);
const source = text.slice(
  text.indexOf("const runNative ="),
  text.indexOf("const nativeStatus =")
);
const hash = "a".repeat(64);
for (const [engine, borrowed] of [
  ["mapbox", false],
  ["mapbox", true],
  ["maplibre", false],
  ["maplibre", true],
]) {
  for (const failure of [
    null,
    "identity",
    "split",
    "conflict",
    "reverse",
    "launch",
    "cleanup",
    "manual-operator-latch",
    "manual-failed",
    "manual-diagnostics-read",
    "manual-diagnostics-write",
    "manual-diagnostics-pid-error",
    "manual-diagnostics-pid-malformed",
    "manual-identity",
    "manual-json",
    "status-bind",
    "metro-spawn",
    "metro-exit-zero",
    "metro-exit-one",
    "metro-late-exit",
    "readiness-body",
    "launch-status",
    "launch-error",
  ]) {
    const commands = [];
    const stopped = [];
    const removed = [];
    let onObservation;
    let manual;
    let statusBound = false;
    let metroReady = false;
    let launched = false;
    let failed = false;
    let metro;
    let polls = 0;
    let diagnostics;
    const context = {
      Buffer,
      assert,
      platform: "android",
      retained: false,
      root: "/frozen-harness",
      scenarios: ["physical-touch", "later-touch"],
      process: {
        env: {
          ANDROID_SERIAL: "emulator-5580",
          TF07_NATIVE_BINARY_SHA256: hash,
          TF07_MANUAL_REPORT: "/report",
          TF07_ANDROID_DIAGNOSTICS: "/diagnostics",
          MAPBOX_ACCESS_TOKEN: "known-sample-token",
          ...(borrowed
            ? {
                TF07_BORROWED_METRO_REVERSE: "1",
                TF07_PARENT_PROCESS_GROUP: "1",
              }
            : {}),
        },
      },
      dirname: () => "/attempt",
      existsSync: (file) => {
        assert.equal(file, "/attempt/operator-first-failure.json");
        return failure === "manual-operator-latch";
      },
      join: (...parts) => parts.join("/"),
      tmpdir: () => "/tmp",
      mkdtempSync: () => "/tmp/owned",
      randomUUID: () => "fresh-run",
      createHash: () => ({
        update() {
          return this;
        },
        digest: () => (failure === "identity" ? "b".repeat(64) : hash),
      }),
      readFileSync: (file) =>
        file === "/attempt/operator-first-failure.json"
          ? JSON.stringify({ error: "first status connection failure" })
          : file === "/report"
            ? failure === "manual-json"
              ? "{"
              : JSON.stringify(manual)
            : "apk",
      writeFileSync: (file, value, options) => {
        if (file === "/diagnostics") {
          diagnostics = JSON.parse(value);
          if (failure === "manual-diagnostics-write")
            throw Error("diagnostic disk failure");
          assert(!commands.at(-1).includes("force-stop"));
          return;
        }
        assert.equal(file, "/report");
        assert(statusBound, "Publish report only after status listener binds.");
        assert(metroReady, "Publish report only after Metro readiness.");
        assert(launched, "Publish report only after confirmed app launch.");
        assert.equal(options.flag, "wx");
        manual = JSON.parse(value);
        assert.equal(manual.runId, "fresh-run");
        assert.equal(manual.scenarios["physical-touch"], "unverified");
        if (failure === "manual-operator-latch") return;
        manual.scenarios["physical-touch"] =
          failure?.startsWith("manual-diagnostics") ||
          failure === "manual-failed"
            ? "failed"
            : "passed";
        if (
          failure !== "manual-failed" &&
          !failure?.startsWith("manual-diagnostics")
        )
          manual.scenarios["later-touch"] = "passed";
        if (failure === "manual-identity") manual.runId = "other-run";
      },
      rmSync: (file) => removed.push(file),
      libraryDigest: () => ({ distSha256: hash }),
      requireFreePort: async () => {},
      nativeUiReportReady: () => true,
      judgeNativeUi: () => ({ status: "passed" }),
      nativeStatus: async (callback) => {
        assert.equal(manual, undefined);
        await Promise.resolve();
        if (failure === "status-bind") throw Error("status bind failed");
        statusBound = true;
        onObservation = callback;
        return {
          close: async () => {
            stopped.push("status");
          },
        };
      },
      start: (file, args, options) => {
        assert(statusBound);
        assert.equal(manual, undefined);
        assert.equal(options.cwd, `/frozen-harness/examples/native-${engine}`);
        metro = new EventEmitter();
        return Object.assign(metro, {
          pid: 77,
          kill: (signal) => {
            assert.equal(signal, "SIGTERM");
            stopped.push(77);
            metro.emit("exit", null, "SIGTERM");
          },
        });
      },
      stopOwnedProcess: async (child) => {
        stopped.push(child.pid);
        child.emit("exit", null, "SIGTERM");
      },
      console: { error() {} },
      fetch: async () => ({
        ok: true,
        text: async () =>
          failure === "readiness-body"
            ? "unexpected"
            : "packager-status:running",
      }),
      until: async (observe) => {
        polls++;
        if (polls === 1 && failure === "metro-spawn")
          metro.emit("error", Error("Metro spawn failed"));
        if (polls === 1 && failure === "metro-exit-zero")
          metro.emit("exit", 0, null);
        if (polls === 1 && failure === "metro-exit-one")
          metro.emit("exit", 1, null);
        if (polls === 2 && failure === "metro-late-exit")
          metro.emit("exit", 1, null);
        if (polls === 1 || !failure?.startsWith("manual-"))
          onObservation({ generation: 1 });
        assert(await observe());
        if (
          polls === 1 &&
          ![
            "metro-spawn",
            "metro-exit-zero",
            "metro-exit-one",
            "readiness-body",
          ].includes(failure)
        )
          metroReady = true;
      },
      command: async (file, args) => {
        assert.equal(file, "adb");
        assert.deepEqual(Array.from(args.slice(0, 2)), ["-s", "emulator-5580"]);
        const parts = Array.from(args.slice(2));
        commands.push(parts);
        if (
          (parts.includes("logcat") ||
            parts.includes("dumpsys") ||
            parts.includes("pidof")) &&
          failure === "manual-diagnostics-read"
        )
          throw Error(
            "🗺".repeat(50000) +
              " diagnostic transport failure known-sample-token ?token=private-query-token"
          );
        if (parts.join(" ").includes("pm path"))
          return (
            "package:/data/app/owned/base.apk\n" +
            (failure === "split" ? "package:/data/app/owned/split.apk\n" : "")
          );
        if (parts.join(" ") === "reverse --list")
          return (
            (borrowed ? "emulator-5580 tcp:8081 tcp:8081\n" : "") +
            (failure === "conflict" ? "emulator-5580 tcp:8797 tcp:8797\n" : "")
          );
        if (
          parts.join(" ") === "reverse tcp:8797 tcp:8797" &&
          failure === "reverse"
        )
          throw Error("reverse failed");
        if (parts.includes("start")) {
          assert(parts.includes("-W"));
          if (failure === "launch-status") return "no launch status";
          if (failure === "launch-error")
            return "Status: ok\nError: Activity missing";
          if (failure !== "launch") {
            launched = true;
            return "Status: ok\n";
          }
        }
        if (parts.includes("start") && failure === "launch")
          throw Error("launch failed");
        if (parts.includes("--remove") && failure === "cleanup")
          throw Error("cleanup failed");
        if (parts.includes("exit-info")) {
          assert.deepEqual(parts, [
            "shell",
            "dumpsys",
            "activity",
            "exit-info",
            `com.onemap${engine}`,
          ]);
          return (
            "latest malformed history; pid=999 timestamp=earlier reason=USER_REQUESTED\n" +
            "🗺".repeat(50000) +
            "oldest record"
          );
        }
        if (parts.includes("pidof")) {
          if (failure === "manual-diagnostics-pid-error")
            throw Error("PID unavailable");
          return failure === "manual-diagnostics-pid-malformed"
            ? "not a PID"
            : "12345\n";
        }
        if (parts.includes("events")) {
          assert.deepEqual(parts, [
            "logcat",
            "-b",
            "events",
            "-d",
            "-t",
            "2000",
            "-v",
            "threadtime",
            "am_proc_died:I",
            "am_kill:I",
            "am_crash:I",
            "am_anr:I",
            "am_proc_start:I",
            "*:S",
          ]);
          return [
            `11-01 15:05:43.000 100 100 I am_kill: [0,12345,com.onemap${engine},0,reason known-sample-token]`,
            `11-01 15:05:43.000 100 100 I am_proc_died: [0,12345,com.onemap${engine},0,0]`,
            "11-01 15:05:44.000 100 100 I am_kill: [0,777,com.otherapp,0,private unrelated reason]",
            `11-01 15:05:45.000 100 100 I am_crash: [0,777,com.otherapp,0,message mentions com.onemap${engine}]`,
            `11-01 15:05:46.000 100 100 I am_proc_start: [0,12346,10001,com.onemap${engine}:worker,activity,com.onemap${engine}/.MainActivity]`,
            `11-01 15:05:47.000 100 100 I am_anr: [0,12347,com.onemap${engine}evil,0,unrelated prefix]`,
            "not valid event data",
          ].join("\n");
        }
        if (parts.includes("logcat"))
          return (
            "AndroidRuntime https://example.invalid/?access_token=private-query-token\n" +
            "x".repeat(140 * 1024) +
            "\nReactNativeJS: " +
            "🗺".repeat(50000) +
            "\nReactNativeJS: application error known-sample-token\nBridgeless: stack frame"
          );
        return "";
      },
    };
    try {
      await runInNewContext(`${source}\nrunNative("${engine}")`, context);
    } catch (error) {
      if (failure?.startsWith("manual-")) {
        assert.match(String(error.errors[0]), /TF07 manual report failed/);
        if (failure === "manual-operator-latch") {
          assert.match(
            String(error.errors[0]),
            /first status connection failure/
          );
          assert(
            Object.values(manual.scenarios).every(
              (value) => value === "unverified"
            )
          );
          assert(
            polls <= 2,
            "First failure must not wait for the row timeout."
          );
        }
        if (
          failure === "manual-failed" ||
          failure?.startsWith("manual-diagnostics")
        ) {
          assert.match(String(error.errors[0]), /physical-touch/);
          assert.equal(manual.scenarios["later-touch"], "unverified");
        }
      }
      failed = true;
    }
    assert.equal(failed, failure !== null, `${borrowed}/${failure}`);
    if (
      [
        "status-bind",
        "metro-spawn",
        "metro-exit-zero",
        "metro-exit-one",
        "readiness-body",
        "launch",
        "launch-status",
        "launch-error",
      ].includes(failure)
    )
      assert.equal(manual, undefined);
    if (failure === "status-bind") assert.equal(metro, undefined);
    if (failure?.startsWith("manual-")) {
      assert(diagnostics, "Capture failure diagnostics before force-stop.");
      assert.equal(diagnostics.applicationId, `com.onemap${engine}`);
      assert.equal(diagnostics.reads.length, 6);
      assert.match(diagnostics.exitHistoryClassification, /^unclassified/);
      assert.match(diagnostics.logWindow, /do not guarantee/);
      assert(diagnostics.launch.requestedAtUTC);
      if (failure !== "manual-diagnostics-read") {
        assert.equal(
          diagnostics.launch.pid,
          failure?.includes("-pid-") ? null : "12345"
        );
        assert.match(diagnostics.reads[0].text, /latest malformed history/);
        assert(!diagnostics.reads[0].text.includes("oldest record"));
        assert.equal(diagnostics.reads[0].selection, "prefix");
        assert.match(diagnostics.reads[1].text, /am_kill/);
        assert.match(diagnostics.reads[1].text, /am_proc_died/);
        assert.match(diagnostics.reads[1].text, /:worker/);
        assert(!diagnostics.reads[1].text.includes("evil"));
        assert(!diagnostics.reads[1].text.includes("com.otherapp"));
        assert(!diagnostics.reads[1].text.includes("not valid"));
      } else assert.equal(diagnostics.launch.pid, null);
      const failureReads = commands.slice(
        commands.findIndex((parts) => parts.includes("exit-info"))
      );
      assert(failureReads[1].includes("events"));
      assert(failureReads[3].includes("activities"));
      assert(!JSON.stringify(diagnostics).includes("private-query-token"));
      assert(!JSON.stringify(diagnostics).includes("known-sample-token"));
      if (failure !== "manual-diagnostics-read") {
        assert(
          diagnostics.reads
            .at(-1)
            .text.includes("ReactNativeJS: application error <REDACTED>")
        );
        assert(
          diagnostics.reads.at(-1).text.includes("Bridgeless: stack frame")
        );
      }
      assert(
        diagnostics.reads.every(
          (read) =>
            Buffer.byteLength(read.text ?? read.error ?? "") <= 128 * 1024
        )
      );
      if (failure === "manual-diagnostics-read")
        assert(diagnostics.reads.every((read) => read.error));
      assert(
        commands.findIndex((parts) => parts.includes("logcat")) <
          commands.findLastIndex((parts) => parts.includes("force-stop"))
      );
    }
    if (failure?.startsWith("metro-") || failure === "readiness-body") {
      assert.equal(polls, failure === "metro-late-exit" ? 2 : 1);
      if (failure !== "metro-late-exit")
        assert(!commands.some((parts) => parts.includes("start")));
      assert(stopped.includes(77));
    }
    const reverses = commands
      .filter(
        (parts) =>
          parts[0] === "reverse" &&
          parts[1] !== "--list" &&
          parts[1] !== "--remove"
      )
      .map((parts) => parts[1]);
    const cleanup = commands
      .filter((parts) => parts.includes("--remove"))
      .map((parts) => parts.at(-1));
    const acquired =
      failure === "reverse"
        ? reverses.filter((port) => port !== "tcp:8797")
        : reverses;
    assert.deepEqual(cleanup, acquired.reverse());
    if (borrowed) assert(!cleanup.includes("tcp:8081"));
    if (["identity", "split"].includes(failure))
      assert.equal(reverses.length, 0);
    assert.deepEqual(removed, ["/tmp/owned"]);
    if (
      [
        null,
        "launch",
        "cleanup",
        "manual-failed",
        "manual-diagnostics-read",
        "manual-diagnostics-write",
        "manual-identity",
        "manual-json",
      ].includes(failure)
    ) {
      assert(stopped.includes(77));
      assert(stopped.includes("status"));
      assert.equal(
        commands.filter((parts) => parts.includes("force-stop")).length,
        2
      );
    }
  }
}
console.log(
  "TF07 assigned target, installed identity, acquired/borrowed reverse and cleanup mocks passed."
);

const startSource = text.slice(
  text.indexOf("const start ="),
  text.indexOf("const command =")
);
for (const parentOwned of [false, true]) {
  let detached;
  runInNewContext(`${startSource}\nstart("bun", ["run", "start"]);`, {
    process: { env: parentOwned ? { TF07_PARENT_PROCESS_GROUP: "1" } : {} },
    spawn: (file, args, options) => {
      detached = options.detached;
      return { on() {} };
    },
  });
  assert.equal(detached, !parentOwned);
}

const portSource = text.slice(
  text.indexOf("const requireFreePort ="),
  text.indexOf("const directoryDigest =")
);
for (const failure of [null, "empty", "diagnostic", "missing-tool"]) {
  const check = runInNewContext(`${portSource}\nrequireFreePort(8797);`, {
    command: async () => {
      if (failure)
        throw Object.assign(Error(failure), {
          code: failure === "missing-tool" ? "ENOENT" : 1,
          stdout: "",
          stderr: failure === "diagnostic" ? "tool error" : "",
        });
      return "123";
    },
  });
  if (failure === "empty") await check;
  else await assert.rejects(check);
}

const diagnosticSource = text.slice(
  text.indexOf("      const diagnosticText ="),
  text.indexOf("      const diagnostics =")
);
for (const keepPrefix of [false, true]) {
  for (const trailingBytes of [0, 1, 2, 3]) {
    const input =
      "x".repeat(trailingBytes) + "🗺".repeat(40000) + "x".repeat(trailingBytes);
    const bounded = runInNewContext(
      `${diagnosticSource}\ndiagnosticText(input, keepPrefix)`,
      {
        Buffer,
        keepPrefix,
        input,
        process: { env: {} },
      }
    );
    assert(Buffer.byteLength(bounded) <= 128 * 1024);
    assert(!bounded.includes("�"));
  }
}
