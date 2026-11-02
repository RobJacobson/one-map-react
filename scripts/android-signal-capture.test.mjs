import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  prepareAndroidSignalCapture,
  readAndroidSignals,
  runSignalCommand,
  signalCanaryCommand,
} from "./android-signal-capture.mjs";

const converter = "/private/tmp/one-map-traceconv-v54";
assert.equal(
  createHash("sha256").update(readFileSync(converter)).digest("hex"),
  "3976ef9871626ce28ceb32a36c657505a21f63c02837bb0ea51081412d79f4d7"
);
const temporary = mkdtempSync(join(tmpdir(), "one-map-signal-test-"));
const fixture = `packet {
 timestamp: 1000000000
 process_tree {
  processes { pid: 1001 ppid: 1 cmdline: "owned-sender" }
  processes { pid: 2002 ppid: 1 cmdline: "owned-victim" }
  threads { tid: 1011 tgid: 1001 name: "sender-thread" }
  threads { tid: 2002 tgid: 2002 name: "owned-victim" }
 }
}
packet { ftrace_events { cpu: 0 event {
 timestamp: 2000000000 pid: 1011
 signal_generate { code: 0 comm: "owned-victim" group: 1 pid: 2002 result: 0 sig: 9 }
} } }
packet { ftrace_stats { phase: START_OF_TRACE cpu_stats {
 cpu: 0 entries: 0 overrun: 0 commit_overrun: 0 dropped_events: 0
} } }
packet { ftrace_stats { phase: END_OF_TRACE cpu_stats {
 cpu: 0 entries: 1 overrun: 0 commit_overrun: 0 dropped_events: 0
} } }
packet { trace_stats { buffer_stats { buffer_size: 8192 bytes_written: 100
 bytes_overwritten: 0 chunks_written: 1 chunks_overwritten: 0 chunks_discarded: 0
} } }
`;
const encode = (name, text) => {
  const source = join(temporary, `${name}.textproto`);
  const binary = join(temporary, `${name}.pftrace`);
  writeFileSync(source, text);
  execFileSync(converter, ["binary", source, binary], {
    timeout: 30000,
    maxBuffer: 131072,
  });
  return binary;
};
try {
  const hostCanary = await runSignalCommand("/bin/sh", [
    "-c",
    signalCanaryCommand,
  ]);
  const hostIdentities = hostCanary
    .trim()
    .match(/^([1-9][0-9]*) ([1-9][0-9]*)$/);
  assert(
    hostIdentities,
    "The actual canary shell must print two identities and exit0 after wait137."
  );
  assert.notEqual(hostIdentities[1], hostIdentities[2]);
  for (const pid of hostIdentities.slice(1))
    assert.throws(
      () => process.kill(Number(pid), 0),
      (error) => error.code === "ESRCH"
    );
  await assert.rejects(
    runSignalCommand(
      process.execPath,
      [
        "-e",
        'require("node:fs").closeSync(0); setTimeout(() => process.stdout.write("closed"), 50);',
      ],
      "x".repeat(1024 * 1024)
    ),
    (error) => error.code === "EPIPE"
  );
  const trace = encode("valid", fixture);
  const result = await readAndroidSignals(trace, 2002);
  assert.deepEqual(result.events, [
    {
      ts: 2000000000,
      contextTid: 1011,
      contextPid: 1001,
      contextThread: "sender-thread",
      contextProcess: "owned-sender",
      victimPid: 2002,
      victimComm: "owned-victim",
      signal: 9,
      code: 0,
      result: 0,
      targetContexts: [
        {
          tid: 2002,
          pid: 2002,
          thread: "owned-victim",
          process: "owned-victim",
        },
      ],
    },
  ]);
  for (const [name, text, message] of [
    [
      "lost",
      fixture.replace("entries: 1 overrun: 0", "entries: 1 overrun: 1"),
      /data-loss/,
    ],
    [
      "missing-end",
      fixture.replace("phase: END_OF_TRACE", "phase: START_OF_TRACE"),
      /CPU sets differ/,
    ],
    [
      "wrong-cpu",
      fixture.replace("cpu: 0 entries: 1", "cpu: 1 entries: 1"),
      /CPU sets differ/,
    ],
    [
      "setup",
      fixture.replace(
        "phase: START_OF_TRACE",
        'phase: START_OF_TRACE failed_ftrace_events: "signal/signal_generate"'
      ),
      /data-loss/,
    ],
    [
      "unknown-event",
      fixture.replace(
        "phase: START_OF_TRACE",
        'phase: START_OF_TRACE unknown_ftrace_events: "signal/signal_generate"'
      ),
      /data-loss/,
    ],
    [
      "service-loss",
      fixture.replace("chunks_overwritten: 0", "chunks_overwritten: 1"),
      /data-loss/,
    ],
  ])
    await assert.rejects(
      readAndroidSignals(encode(name, text), 2002),
      message,
      name
    );
  await assert.rejects(readAndroidSignals(trace, "2002;anything"));

  const calibration = encode("calibration", fixture.replaceAll("1011", "1001"));
  const missingMapping = encode(
    "missing-mapping",
    fixture
      .replaceAll("1011", "1001")
      .replace('  processes { pid: 1001 ppid: 1 cmdline: "owned-sender" }', "")
      .replace('  threads { tid: 1001 tgid: 1001 name: "sender-thread" }', "")
  );
  for (const failure of [
    null,
    "wrong-context",
    "missing-mapping",
    "ownership",
    "pull",
    "early-end",
    "startup",
  ]) {
    const output = join(temporary, String(failure));
    const { mkdirSync } = await import("node:fs");
    mkdirSync(output);
    let session;
    let starts = 0;
    let mainIdentityReads = 0;
    const actions = [];
    const run = async (file, args, input) => {
      if (file !== "adb")
        return execFileSync(file, args, {
          encoding: "utf8",
          timeout: 30000,
          maxBuffer: 131072,
          stdio: ["ignore", "pipe", "pipe"],
        });
      assert.deepEqual(args.slice(0, 2), ["-s", "emulator-5580"]);
      const call = args.slice(2);
      actions.push(call);
      if (call[0] === "shell" && call[1] === "perfetto") {
        starts += 1;
        assert.match(input, /size_kb: 8192/);
        assert.match(input, /max_file_size_bytes: 16777216/);
        assert(!input.includes("tids_to_trace"));
        assert(!input.includes("sched_switch"));
        if (failure === "startup") throw Error("startup failed");
        session = {
          pid: String(9000 + starts),
          args: call.slice(1),
          active: true,
        };
        return `${session.pid}\n`;
      }
      if (call[0] === "exec-out") {
        if (starts === 2 && call[2].endsWith("cmdline")) mainIdentityReads += 1;
        if (failure === "early-end" && mainIdentityReads > 1)
          session.active = false;
        if (!session.active) throw Error("absent");
        if (call[2].endsWith("cmdline"))
          return (
            (failure === "ownership" ? ["foreign"] : session.args).join("\0") +
            "\0"
          );
        return `${session.pid} (perfetto) S ${Array(18).fill("0").join(" ")} 123\n`;
      }
      if (call[1] === "sh" && call[3].startsWith("test -d"))
        return session.active ? "present" : "absent";
      if (call[1] === "sh")
        return failure === "wrong-context" ? "9999 2002\n" : "1001 2002\n";
      if (call[1] === "kill") {
        assert.equal(call[3], session.pid);
        session.active = false;
        return "";
      }
      if (call[0] === "pull") {
        if (failure === "pull") throw Error("pull failed");
        copyFileSync(
          starts === 1
            ? failure === "missing-mapping"
              ? missingMapping
              : calibration
            : trace,
          call[2]
        );
        return "";
      }
      if (call[1] === "rm") return "";
      throw Error(`Unexpected mocked boundary: ${call}`);
    };
    if (failure && failure !== "early-end") {
      await assert.rejects(
        prepareAndroidSignalCapture("emulator-5580", output, run)
      );
      assert(starts <= 1, "Do not start app trace after failed calibration.");
      if (failure === "ownership")
        assert(!actions.some((call) => call[1] === "kill"));
    } else {
      const capture = await prepareAndroidSignalCapture(
        "emulator-5580",
        output,
        run
      );
      assert.equal(starts, 2);
      const stop = capture.stop("2002");
      if (failure === "early-end") await assert.rejects(stop, /coverage gap/);
      else {
        const saved = await stop;
        assert.equal(saved.analysis.events[0].contextTid, 1011);
        assert.equal(saved.coverage, "running-before-stop");
        assert(
          actions.findIndex((call) => call[0] === "pull") <
            actions.findIndex((call) => call[1] === "rm")
        );
      }
    }
  }
  console.log(
    "Official v54 host conversion/analysis preserves distinct sender/victim; loss/setup/missing-final rejection and mocked owned calibration/capture cleanup passed. No Android command ran."
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
