import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const processor = "/private/tmp/one-map-trace-processor-shell-v54";
const processorHash =
  "23638faac4ca695e86039a01fade05ff4a38ffa89672afc7a4e4077318603507";
const execute = promisify(execFile);
/** One owned child, killed by its identifiable parent shell and reaped before return. */
export const signalCanaryCommand =
  'sleep 5 & victim=$!; printf "%s %s\\n" "$$" "$victim"; sleep 0.2; kill -9 "$victim"; wait "$victim"; sleep 0.5';
/** Runs one bounded command, awaiting child completion even when its input pipe fails. */
export const runSignalCommand = async (file, args, input) => {
  const pending = execute(file, args, {
    timeout: 35000,
    maxBuffer: 128 * 1024,
    encoding: "utf8",
  });
  let inputError;
  if (input !== undefined) {
    pending.child.stdin.once("error", (error) => {
      inputError = error;
    });
    pending.child.stdin.end(input);
  }
  const result = await pending;
  if (inputError) throw inputError;
  return result.stdout;
};

/** Reads raw signal context with the pinned official host processor, without classifying actors. */
export const readAndroidSignals = async (
  trace,
  victim,
  run = runSignalCommand
) => {
  assert.match(String(victim), /^[1-9][0-9]*$/);
  const size = statSync(trace).size;
  assert(size > 0 && size < 16 * 1024 * 1024, "Trace empty or at file bound.");
  const sql = `
    WITH signals AS (
      SELECT f.ts, t.tid AS contextTid, p.pid AS contextPid,
        t.name AS contextThread, p.name AS contextProcess,
        EXTRACT_ARG(f.arg_set_id, 'pid') AS victimPid,
        EXTRACT_ARG(f.arg_set_id, 'comm') AS victimComm,
        EXTRACT_ARG(f.arg_set_id, 'sig') AS signal,
        EXTRACT_ARG(f.arg_set_id, 'code') AS code,
        EXTRACT_ARG(f.arg_set_id, 'result') AS result,
        (SELECT json_group_array(json_object('tid',v.tid,'pid',vp.pid,
          'thread',v.name,'process',vp.name)) FROM thread v
          LEFT JOIN process vp USING(upid)
          WHERE v.tid=EXTRACT_ARG(f.arg_set_id,'pid')
            AND (v.start_ts IS NULL OR v.start_ts<=f.ts)
            AND (v.end_ts IS NULL OR v.end_ts>=f.ts)) AS targetContexts
      FROM ftrace_event f LEFT JOIN thread t USING(utid)
      LEFT JOIN process p USING(upid)
      WHERE f.name='signal_generate'
        AND EXTRACT_ARG(f.arg_set_id, 'sig')=9
    )
    SELECT json_object(
      'count', (SELECT count(*) FROM signals),
      'events', (SELECT json_group_array(json_object(
        'ts',ts,'contextTid',contextTid,'contextPid',contextPid,
        'contextThread',contextThread,'contextProcess',contextProcess,
        'victimPid',victimPid,'victimComm',victimComm,'signal',signal,
        'code',code,'result',result,'targetContexts',json(targetContexts))) FROM (SELECT * FROM signals LIMIT 256)),
      'stats', (SELECT json_group_array(json_object(
        'name',name,'idx',idx,'severity',severity,'value',value)) FROM stats
        WHERE (severity IN ('error','data_loss') AND value != 0) OR name='ftrace_setup_errors'
          OR name IN ('ftrace_cpu_entries_begin','ftrace_cpu_entries_end',
            'ftrace_cpu_overrun_delta','ftrace_cpu_commit_overrun_delta',
            'ftrace_cpu_dropped_events_delta','traced_buf_buffer_size','traced_buf_bytes_overwritten',
            'traced_buf_chunks_discarded','traced_buf_chunks_overwritten'))
    ) AS result;`;
  const csv = (await run(processor, ["-Q", sql, trace])).trim().split("\n");
  assert.equal(csv.length, 2, "Unexpected official processor output.");
  assert.equal(csv[0], '"result"');
  assert(csv[1].startsWith('"') && csv[1].endsWith('"'));
  const result = JSON.parse(csv[1].slice(1, -1).replaceAll('""', '"'));
  result.launchedPid = Number(victim);
  assert.equal(result.count, result.events.length, "Signal output truncated.");
  const cpus = result.stats.filter(
    (stat) => stat.name === "ftrace_cpu_entries_begin"
  );
  assert(cpus.length, "Missing initial ftrace statistics.");
  assert.deepEqual(
    cpus.map((stat) => stat.idx).sort(),
    result.stats
      .filter((stat) => stat.name === "ftrace_cpu_entries_end")
      .map((stat) => stat.idx)
      .sort(),
    "Initial/final ftrace CPU sets differ."
  );
  for (const cpu of cpus)
    for (const name of [
      "ftrace_cpu_entries_end",
      "ftrace_cpu_overrun_delta",
      "ftrace_cpu_commit_overrun_delta",
      "ftrace_cpu_dropped_events_delta",
    ])
      assert(
        result.stats.some((stat) => stat.name === name && stat.idx === cpu.idx),
        `Missing final ftrace statistic: ${name}/${cpu.idx}.`
      );
  assert(
    result.stats.some(
      (stat) => stat.name === "traced_buf_buffer_size" && stat.value > 0
    ),
    "Missing service buffer statistics."
  );
  for (const buffer of result.stats.filter(
    (stat) => stat.name === "traced_buf_buffer_size"
  ))
    for (const name of [
      "traced_buf_bytes_overwritten",
      "traced_buf_chunks_discarded",
      "traced_buf_chunks_overwritten",
    ])
      assert(
        result.stats.some(
          (stat) => stat.name === name && stat.idx === buffer.idx
        ),
        `Missing service loss statistic: ${name}/${buffer.idx}.`
      );
  assert(
    result.stats.every(
      (stat) =>
        stat.name === "ftrace_cpu_entries_begin" ||
        stat.name === "ftrace_cpu_entries_end" ||
        stat.name === "traced_buf_buffer_size" ||
        stat.value === 0
    ),
    "Trace reports setup, parsing or data-loss counters."
  );
  return result;
};

/** Calibrates a short trace before app launch, then owns one bounded app trace through final pull. */
export const prepareAndroidSignalCapture = async (
  serial,
  output,
  run = runSignalCommand
) => {
  assert.equal(serial, "emulator-5580");
  assert.equal(
    createHash("sha256").update(readFileSync(processor)).digest("hex"),
    processorHash,
    "Official trace processor changed."
  );
  const adb = (args, input) => run("adb", ["-s", serial, ...args], input);
  const receipt = { status: "preparing", sessions: [] };
  const save = () =>
    writeFileSync(
      join(output, "signal-capture.json"),
      JSON.stringify(receipt, null, 2)
    );
  let current;
  const identity = async (pid) => {
    try {
      const cmdline = await adb(["exec-out", "cat", `/proc/${pid}/cmdline`]);
      const stat = await adb(["exec-out", "cat", `/proc/${pid}/stat`]);
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(/\s+/);
      if (fields[0] === "Z") return null;
      return { cmdline, start: fields[19] };
    } catch (error) {
      const check = await adb([
        "shell",
        "sh",
        "-c",
        `test -d /proc/${pid} && echo present || echo absent`,
      ]);
      if (check.trim() === "absent") return null;
      throw error;
    }
  };
  const stop = async (victim) => {
    if (!current) return;
    const session = current;
    assert(
      session.authenticated,
      "Trace PID ownership was not authenticated; do not signal it."
    );
    const observed = await identity(session.pid);
    session.coverage = observed ? "running-before-stop" : "ended-before-stop";
    if (observed) {
      assert.deepEqual(
        observed,
        session.identity,
        "Trace PID ownership changed."
      );
      await adb(["shell", "kill", "-TERM", session.pid]);
    }
    const deadline = Date.now() + 30000;
    while (await identity(session.pid)) {
      assert(
        Date.now() < deadline,
        "Owned trace did not stop; duration/owned emulator bound remains."
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await adb(["pull", session.deviceFile, session.hostFile]);
    assert(statSync(session.hostFile).size <= 16 * 1024 * 1024);
    await adb(["shell", "rm", "-f", session.deviceFile]);
    current = undefined;
    session.stoppedAtUTC = new Date().toISOString();
    if (victim)
      session.analysis = await readAndroidSignals(
        session.hostFile,
        victim,
        run
      );
    save();
    return session;
  };
  const start = async (name, duration) => {
    const deviceFile = `/data/misc/perfetto-traces/one-map-${process.pid}-${name}.pftrace`;
    const config = `buffers { size_kb: 8192 fill_policy: RING_BUFFER }
duration_ms: ${duration}
write_into_file: true
file_write_period_ms: 1000
max_file_size_bytes: 16777216
data_sources { config { name: "linux.ftrace"
  ftrace_config { ftrace_events: "signal/signal_generate"
    ftrace_events: "task/task_newtask" ftrace_events: "task/task_rename" }
} }
data_sources { config { name: "linux.process_stats"
  process_stats_config { scan_all_processes_on_start: true record_thread_names: true }
} }
`;
    const args = [
      "perfetto",
      "--background-wait",
      "--txt",
      "-c",
      "-",
      "-o",
      deviceFile,
    ];
    let result;
    let failure;
    try {
      result = await adb(["shell", ...args], config);
    } catch (error) {
      result = error.stdout || "";
      failure = error;
    }
    const pids = result
      .trim()
      .split(/\r?\n/)
      .filter((line) => /^[1-9][0-9]*$/.test(line));
    assert.equal(
      pids.length,
      1,
      "Trace startup did not authenticate a unique PID; app must not launch."
    );
    const session = {
      pid: pids[0],
      deviceFile,
      hostFile: join(output, `${name}.pftrace`),
      startedAtUTC: new Date().toISOString(),
      durationMs: duration,
    };
    current = session;
    receipt.sessions.push(session);
    save();
    session.identity = await identity(session.pid);
    assert(session.identity, "Trace exited during startup.");
    assert.deepEqual(
      session.identity.cmdline.split("\0").filter(Boolean),
      args,
      "Unexpected trace command line; do not signal this PID."
    );
    assert.match(
      session.identity.start,
      /^[0-9]+$/,
      "Invalid trace process start time."
    );
    session.authenticated = true;
    save();
    if (failure) throw failure;
  };
  try {
    await start("signal-calibration", 5000);
    const canary = (await adb(["shell", "sh", "-c", signalCanaryCommand]))
      .trim()
      .match(/^([1-9][0-9]*) ([1-9][0-9]*)$/);
    assert(canary, "Canary did not report actor/victim identity.");
    const [, actor, victim] = canary;
    assert.notEqual(actor, victim);
    receipt.canary = { actor, victim };
    const calibration = await stop(victim);
    const matches = calibration.analysis.events.filter(
      (event) =>
        event.contextTid === Number(actor) &&
        event.contextPid === Number(actor) &&
        event.victimPid === Number(victim) &&
        event.signal === 9 &&
        event.result === 0
    );
    assert.equal(
      matches.length,
      1,
      "Canary signal context missing or ambiguous; app must not launch."
    );
    assert(
      matches[0].contextThread &&
        matches[0].contextProcess &&
        matches[0].targetContexts.length === 1 &&
        matches[0].targetContexts[0].pid === Number(victim),
      "Canary thread/process identity missing or ambiguous; app must not launch."
    );
    receipt.status = "calibrated";
    save();
    await start("signal-app", 1200000);
    receipt.status = "recording";
    save();
    return {
      stop: async (victimPid) => {
        try {
          const session = await stop(victimPid);
          assert(
            victimPid,
            "App launch PID unavailable; trace retained without attribution."
          );
          assert.equal(
            session.coverage,
            "running-before-stop",
            "Trace ended before final stop; coverage gap."
          );
          receipt.status = "captured";
          save();
          return session;
        } catch (error) {
          receipt.error = String(error);
          receipt.status = "capture-failed";
          save();
          throw error;
        }
      },
    };
  } catch (error) {
    receipt.error = String(error);
    receipt.status = "preparation-failed";
    try {
      await stop();
    } catch (cleanupError) {
      receipt.cleanupError = String(cleanupError);
    }
    save();
    throw error;
  }
};
