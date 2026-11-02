import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";

import { prepareAndroidSignalCapture } from "./android-signal-capture.mjs";
import { stopOwnedProcess } from "./native-smoke-process.mjs";
import {
  judgeNativeRetained,
  nativeRetainedReportReady,
  nativeRetainedScenarios,
} from "./tf07-retained-contract.mjs";
import {
  judgeNativeUi,
  nativeUiReportReady,
  nativeUiScenarios,
} from "./tf07-smoke-contract.mjs";

const root = process.env.TF07_HARNESS_ROOT
  ? resolve(process.env.TF07_HARNESS_ROOT)
  : resolve(import.meta.dirname, "..");
const platform = process.argv[2];
const engine = process.argv[3] ?? "both";
const retained = process.argv[4] === "retained";
if (process.argv[4] !== undefined && (!retained || platform === "web"))
  throw new Error("Use retained only for native supplemental observations.");
const scenarios = retained ? nativeRetainedScenarios : nativeUiScenarios;

if (
  !["web", "android", "ios"].includes(platform) ||
  !["both", "mapbox", "maplibre"].includes(engine)
) {
  throw new Error("Use web|android|ios and optional mapbox|maplibre|both.");
}
if (platform !== "web" && engine === "both") {
  throw new Error(
    "Native UI acceptance requires one engine and its installed binary baseline."
  );
}

const main = async () => {
  const selected = engine === "both" ? ["mapbox", "maplibre"] : [engine];
  const results = {};
  const artifact = libraryDigest();

  for (const selectedEngine of selected) {
    const consumer = join(
      root,
      "examples",
      `${platform === "web" ? "web" : "native"}-${selectedEngine}`,
      "node_modules/one-map-react/dist"
    );
    assert.equal(
      directoryDigest(consumer),
      artifact.distSha256,
      "Synchronize the selected example's library copy before acceptance."
    );
    results[`${selectedEngine}-${platform}`] =
      platform === "web"
        ? await runWeb(selectedEngine)
        : await runNative(selectedEngine);
    assert.deepEqual(
      libraryDigest(),
      artifact,
      "Library artifact changed during acceptance."
    );
  }

  const result = JSON.stringify({ artifact, results }, null, 2);
  if (process.env.TF07_OUTPUT)
    writeFileSync(process.env.TF07_OUTPUT, result, { flag: "wx" });
  console.log(result);
  if (Object.values(results).some((result) => result.status !== "passed"))
    process.exitCode = 1;
};

const runWeb = async (selectedEngine) => {
  const port = selectedEngine === "mapbox" ? 4187 : 4188;
  await requireFreePort(port);
  await requireFreePort(port + 1000);
  const profile = mkdtempSync(join(tmpdir(), "one-map-tf07-browser-"));
  const shell = join(root, "examples", `web-${selectedEngine}`);
  const vite = start(
    "bun",
    [
      "run",
      "dev",
      "--",
      "--port",
      String(port),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    { cwd: shell }
  );
  let browser;
  let page;

  try {
    await until(
      async () => (await fetch(`http://127.0.0.1:${port}/`)).ok,
      30000,
      "web server startup"
    );
    browser = start(
      process.env.TF07_CHROME ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      [
        "--headless=new",
        `--remote-debugging-port=${port + 1000}`,
        `--user-data-dir=${profile}`,
        "--window-size=1280,800",
        "--no-first-run",
        `http://127.0.0.1:${port}/?tf07=ui`,
      ]
    );
    let target;
    await until(
      async () => {
        const tabs = await (
          await fetch(`http://127.0.0.1:${port + 1000}/json/list`)
        ).json();
        target = tabs.find((tab) => tab.url.includes("tf07=ui"));
        return !!target?.webSocketDebuggerUrl;
      },
      20000,
      "browser target discovery"
    );
    page = await connect(target.webSocketDebuggerUrl);
    await until(
      async () => {
        const observed = await page.evaluate(
          "window.__oneMapTf07?.read()",
          true
        );
        return (
          observed?.events.load >= 1 &&
          observed.features.some((feature) => feature.id === 707)
        );
      },
      60000,
      "known renderer feature"
    );
    const read = () => page.evaluate("window.__oneMapTf07.read()", true);
    const before = await read();

    await click(page, '[data-tf07="annotation"]');
    await click(page, '[data-tf07="annotation"]');
    await until(
      async () => (await read()).events["annotation-click"] === 2,
      5000
    );

    await click(page, '[data-tf07-child="live"]');
    await until(async () => (await read()).events["child-click"] === 1, 5000);
    const afterChild = await read();
    assert.equal(
      afterChild.events["map-click"] ?? 0,
      before.events["map-click"] ?? 0,
      "Child click reached the map."
    );

    await drag(page, '[data-tf07="live"] > span');
    await until(async () => (await read()).events["live-end"] >= 1, 10000);
    const dragged = await read();
    assert(
      dragged.positions.live &&
        Math.abs(dragged.positions.live[0] + 122.34) > 0.001,
      "Live drag did not change longitude."
    );
    await drag(page, '[data-tf07="annotation"]');
    await until(
      async () => (await read()).events["annotation-end"] >= 1,
      10000
    );

    const mapOrigin = await page.evaluate(
      "(() => {const r=document.querySelector('#tf07-map-host').getBoundingClientRect();return [r.x,r.y]})()"
    );
    const source = await page.evaluate(
      "window.__oneMapTf07.project('source')",
      true
    );
    const sourceInput = [source[0] + mapOrigin[0], source[1] + mapOrigin[1]];
    const beforeSource = await read();
    await press(page, sourceInput);
    await until(async () => (await read()).events["source-click"] >= 1, 5000);
    assert.equal(
      (await read()).events["map-click"],
      (beforeSource.events["map-click"] ?? 0) + 1
    );
    const beforeRepeated = await read();
    await press(page, sourceInput);
    await until(async () => (await read()).events["source-click"] >= 2, 5000);
    assert.equal(
      (await read()).events["map-click"],
      beforeRepeated.events["map-click"] + 1
    );

    const zoom = (await read()).zoom;
    await click(page, 'button[title="Zoom in"], button[aria-label="Zoom in"]');
    await until(async () => (await read()).zoom > zoom + 0.8, 10000);
    await click(
      page,
      ".mapboxgl-popup-close-button, .maplibregl-popup-close-button"
    );
    await until(async () => (await read()).events["popup-close"] === 1, 5000);
    await click(page, '[data-tf07-action="popup"]');
    await click(page, '[data-tf07-action="remount"]');
    await until(async () => (await read()).events.load >= 2, 60000);
    const remounted = await read();
    assert.equal(
      remounted.events["popup-close"],
      1,
      "Popup teardown requested dismissal."
    );
    await until(
      async () =>
        page.evaluate(
          `Boolean(document.querySelector('[data-tf07-child="popup"]'))`,
          true
        ),
      5000
    );
    await click(
      page,
      ".mapboxgl-popup-close-button, .maplibregl-popup-close-button"
    );
    await until(
      async () =>
        (await read()).events["popup-close"] === 2 &&
        (await page.evaluate(
          `!document.querySelector('[data-tf07-child="popup"]')`,
          true
        )),
      5000
    );
    const final = await read();
    assert.equal(
      final.events.error ?? 0,
      0,
      "The fixture reported an operation error."
    );

    return {
      status: "passed",
      execution: "browser-input",
      scope: [
        "known-feature",
        "child-click",
        "annotation-repeat-tap",
        "live-drag",
        "annotation-drag",
        "source-propagation",
        "navigation",
        "popup-dismissal",
        "remount-teardown",
      ],
      observation: final,
      remaining: [
        "offset-touch-bounds",
        "popup-follow",
        "scale-units",
        "geolocation",
        "accessibility",
        "style-replacement",
        "fullscreen",
      ],
    };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "Browser interaction failed.",
      rendererStatus: await page
        ?.evaluate("document.querySelector('#tf07-status')?.textContent")
        .catch(() => undefined),
      observation: await page
        ?.evaluate("window.__oneMapTf07?.read()", true)
        .catch(() => undefined),
    };
  } finally {
    page?.close();
    if (browser) await stopOwnedProcess(browser);
    await stopOwnedProcess(vite);
    rmSync(profile, { recursive: true, force: true });
  }
};

const runNative = async (selectedEngine) => {
  const expected = process.env.TF07_NATIVE_BINARY_SHA256;
  if (!expected || !/^[a-f0-9]{64}$/.test(expected))
    throw new Error(
      "Set TF07_NATIVE_BINARY_SHA256 to the coordinator's built native executable/APK baseline."
    );
  const applicationId =
    platform === "android"
      ? `com.onemap${selectedEngine}`
      : `org.reactjs.native.example.OneMap${selectedEngine === "mapbox" ? "Mapbox" : "Maplibre"}`;
  const metroPort = Number(process.env.TF07_METRO_PORT ?? 8081);
  const iosDevice = process.env.TF07_IOS_UDID;
  if (platform === "ios" && !iosDevice)
    throw new Error("Set TF07_IOS_UDID to the assigned simulator.");
  const serial = process.env.ANDROID_SERIAL;
  if (platform === "android" && !serial)
    throw new Error("Set ANDROID_SERIAL to the assigned device.");
  const adb = (args) => command("adb", ["-s", serial, ...args]);
  const temporary = mkdtempSync(join(tmpdir(), "one-map-tf07-native-"));
  let metro;
  let stoppingMetro = false;
  let status;
  let androidLaunch;
  let androidRecorder;
  let androidSignalCapture;
  let diagnostics;
  let acquiredApp = false;
  const acquiredReverses = [];
  const failures = [];
  let result;

  try {
    await requireFreePort(metroPort);
    await requireFreePort(8797);
    let actual;
    if (platform === "android") {
      const installed = (await adb(["shell", "pm", "path", applicationId]))
        .trim()
        .split(/\r?\n/);
      assert.equal(installed.length, 1, "Expected one installed base APK.");
      assert.match(installed[0], /^package:\/data\/app\/[^\s]+\/base\.apk$/);
      const apk = join(temporary, "installed.apk");
      await adb(["pull", installed[0].slice("package:".length), apk]);
      actual = createHash("sha256").update(readFileSync(apk)).digest("hex");
      assert.equal(actual, expected, "Installed APK differs from baseline.");
      const reverses = (await adb(["reverse", "--list"]))
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.trim().split(/\s+/));
      for (const [local, remote] of [
        [8081, metroPort],
        [8797, 8797],
      ]) {
        const existing = reverses.filter(
          (fields) => fields[1] === `tcp:${local}`
        );
        if (local === 8081 && process.env.TF07_BORROWED_METRO_REVERSE === "1") {
          assert.equal(existing.length, 1, "Missing borrowed Metro reverse.");
          assert.equal(
            existing[0][2],
            `tcp:${remote}`,
            "Conflicting borrowed Metro reverse."
          );
        } else {
          assert.equal(existing.length, 0, `Reverse ${local} already exists.`);
          await adb(["reverse", `tcp:${local}`, `tcp:${remote}`]);
          acquiredReverses.push(local);
        }
      }
      acquiredApp = true;
      await adb(["shell", "am", "force-stop", applicationId]);
    } else {
      const app = (
        await command("xcrun", [
          "simctl",
          "get_app_container",
          iosDevice,
          applicationId,
          "app",
        ])
      ).trim();
      const executable = (
        await command("/usr/libexec/PlistBuddy", [
          "-c",
          "Print:CFBundleExecutable",
          join(app, "Info.plist"),
        ])
      ).trim();
      actual = createHash("sha256")
        .update(readFileSync(join(app, executable)))
        .digest("hex");
      acquiredApp = true;
      await command("xcrun", [
        "simctl",
        "terminate",
        iosDevice,
        applicationId,
      ]).catch(() => undefined);
    }
    assert.equal(
      actual,
      expected,
      "Installed native binary does not match the frozen baseline."
    );
    const identity = {
      installedBinarySha256: actual,
      libraryDistSha256: libraryDigest().distSha256,
      environment: `${selectedEngine}-${platform}`,
      runId: randomUUID(),
    };
    const manualPath = process.env.TF07_MANUAL_REPORT;
    let completed;
    let nativeFailure;
    let observing = false;
    const readManual = () => {
      if (!manualPath) return;
      try {
        const operatorFailure = join(
          dirname(manualPath),
          "operator-first-failure.json"
        );
        if (existsSync(operatorFailure))
          throw new Error(
            `Operator stopped: ${readFileSync(operatorFailure, "utf8")}`
          );
        const manual = JSON.parse(readFileSync(manualPath, "utf8"));
        for (const field of [
          "installedBinarySha256",
          "libraryDistSha256",
          "environment",
          "runId",
        ])
          assert.equal(
            manual?.[field],
            identity[field],
            `TF07 report ${field} differs from this run.`
          );
        for (const scenario of scenarios) {
          const outcome = manual.scenarios?.[scenario];
          assert(
            ["unverified", "passed", "failed"].includes(outcome),
            `Invalid TF07 report outcome: ${scenario}.`
          );
          assert.notEqual(
            outcome,
            "failed",
            `TF07 physical observation failed: ${scenario}.`
          );
        }
        return manual;
      } catch (error) {
        nativeFailure ??= new Error(`TF07 manual report failed: ${error}`);
      }
    };
    status = await nativeStatus((observation) => {
      if (!observing) return;
      const manual = readManual();
      if (
        nativeFailure ||
        (retained
          ? observation?.focusedComplete !== true
          : !(observation?.generation >= 1))
      )
        return;
      if (
        manualPath &&
        !(retained ? nativeRetainedReportReady : nativeUiReportReady)(
          manual,
          identity
        )
      )
        return;
      completed = { observation, manual };
    });
    metro = start(
      "bun",
      ["run", "start", "--", "--port", String(metroPort), "--reset-cache"],
      {
        cwd: join(root, "examples", `native-${selectedEngine}`),
        env: {
          ...process.env,
          ONE_MAP_SMOKE: retained ? "tf07-retained" : "tf07",
        },
      }
    );
    metro.on("error", (error) => {
      nativeFailure ??= error;
    });
    metro.on("exit", (code, signal) => {
      if (!stoppingMetro)
        nativeFailure ??= new Error(
          `TF07 Metro exited before completion: ${code}/${signal}.`
        );
    });
    await until(async () => {
      if (nativeFailure) return true;
      const response = await fetch(`http://127.0.0.1:${metroPort}/status`);
      const body = await response.text();
      if (!response.ok || body !== "packager-status:running")
        nativeFailure ??= new Error(
          "TF07 Metro returned an unexpected packager status."
        );
      return true;
    }, 60000);
    if (nativeFailure) throw nativeFailure;
    if (platform === "android") {
      if (process.env.TF07_ANDROID_SIGNAL_OUTPUT) {
        assert.equal(selectedEngine, "mapbox");
        androidSignalCapture = await prepareAndroidSignalCapture(
          serial,
          process.env.TF07_ANDROID_SIGNAL_OUTPUT
        );
      }
      if (process.env.TF07_ANDROID_DIAGNOSTICS)
        androidRecorder = await startAndroidRecorder(
          serial,
          applicationId,
          () => androidLaunch?.pid
        );
      androidLaunch = { requestedAtUTC: new Date().toISOString() };
      const launch = await adb([
        "shell",
        "am",
        "start",
        "-W",
        "-n",
        `${applicationId}/.MainActivity`,
      ]);
      assert.match(
        launch,
        /Status: ok/,
        "TF07 selected app launch was not confirmed."
      );
      assert(
        !/Error:|Exception/.test(launch),
        "TF07 selected app launch failed."
      );
    } else
      await command("xcrun", [
        "simctl",
        "launch",
        iosDevice,
        applicationId,
        "-RCT_jsLocation",
        `127.0.0.1:${metroPort}`,
      ]);
    if (platform === "android" && process.env.TF07_ANDROID_DIAGNOSTICS) {
      try {
        const pid = (await adb(["shell", "pidof", applicationId])).trim();
        androidLaunch.pid = /^[1-9][0-9]*$/.test(pid) ? pid : null;
      } catch {
        androidLaunch.pid = null;
      }
      androidLaunch.observedAtUTC = new Date().toISOString();
    }
    if (manualPath) {
      writeFileSync(
        manualPath,
        JSON.stringify(
          {
            ...identity,
            scenarios: Object.fromEntries(
              scenarios.map((scenario) => [scenario, "unverified"])
            ),
          },
          null,
          2
        ),
        { flag: "wx" }
      );
    }
    observing = true;
    console.error(
      `Perform the native touch flow from the approved acceptance plan, then press Read renderer. Required observations: ${scenarios.join(", ")}.`
    );
    console.error(`Native report identity: ${JSON.stringify(identity)}`);
    await until(
      async () => {
        readManual();
        return nativeFailure !== undefined || completed !== undefined;
      },
      Number(process.env.TF07_NATIVE_TIMEOUT_MS ?? 60 * 60 * 1000)
    );
    if (nativeFailure) throw nativeFailure;
    const { observation, manual } = completed;

    result = {
      ...(retained ? judgeNativeRetained : judgeNativeUi)(
        observation,
        manual,
        identity
      ),
      ...identity,
      ...(retained
        ? { nativeTarget: platform === "ios" ? iosDevice : serial }
        : {}),
      observation,
    };
  } catch (error) {
    failures.push(error);
  } finally {
    const clean = async (action) => {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    };
    if (
      failures.length &&
      acquiredApp &&
      platform === "android" &&
      process.env.TF07_ANDROID_DIAGNOSTICS
    ) {
      const diagnosticText = (value, keepPrefix = false) => {
        const redacted = String(value)
          .replaceAll(process.env.MAPBOX_ACCESS_TOKEN || "\0", "<REDACTED>")
          .replace(/([?&](?:access_token|token)=)[^&\s"']+/gi, "$1<REDACTED>");
        const bytes = Buffer.from(redacted);
        const retained = keepPrefix
          ? bytes.subarray(0, 128 * 1024)
          : bytes.subarray(-128 * 1024);
        return retained.toString("utf8").replace(/^\uFFFD+|\uFFFD+$/g, "");
      };
      diagnostics = {
        applicationId,
        serial,
        launch: androidLaunch,
        capturedAtUTC: new Date().toISOString(),
        exitHistoryClassification:
          "unclassified; correlate PID and timestamps with launch; history may include earlier intentional stops",
        logWindow:
          "last 2000 buffer records; filtering and 128KiB retention do not guarantee the full row interval",
        reads: [],
      };
      for (const args of [
        ["shell", "dumpsys", "activity", "exit-info", applicationId],
        [
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
        ],
        ["shell", "pidof", applicationId],
        ["shell", "dumpsys", "activity", "activities"],
        ["logcat", "-b", "crash", "-d", "-t", "2000"],
        ["logcat", "-b", "system", "-b", "main", "-d", "-t", "2000"],
      ]) {
        try {
          const text = await adb(args);
          let relevant = text;
          if (args.includes("events")) {
            const isSelectedProcessEvent = (line) => {
              const event = line.match(
                /\b(am_proc_died|am_kill|am_crash|am_anr|am_proc_start)\s*:\s*\[([^\]]*)/
              );
              if (!event) return false;
              const fields = event[2].split(",");
              const processName =
                fields[event[1] === "am_proc_start" ? 3 : 2]?.trim();
              return (
                processName === applicationId ||
                processName?.startsWith(`${applicationId}:`)
              );
            };
            relevant = text
              .split("\n")
              .filter(isSelectedProcessEvent)
              .join("\n");
          } else if (args.includes("main")) {
            relevant = text
              .split("\n")
              .filter(
                (line) =>
                  /ActivityManager|ActivityTaskManager|AndroidRuntime|ReactNative|Bridgeless|am_crash|am_kill|libc|DEBUG/i.test(
                    line
                  ) || line.includes(applicationId)
              )
              .join("\n");
          }
          // Exit history is newest-first within each UID; logs are chronological.
          diagnostics.reads.push({
            args,
            selection: args.includes("exit-info") ? "prefix" : "tail",
            text: diagnosticText(relevant, args.includes("exit-info")),
          });
        } catch (error) {
          diagnostics.reads.push({
            args,
            error: diagnosticText(error),
          });
        }
      }
    }
    if (androidRecorder) {
      const snapshot = await androidRecorder.stop();
      if (diagnostics) diagnostics.recorder = snapshot;
      if (result) result.androidRecorder = snapshot;
    }
    if (androidSignalCapture)
      await clean(() => androidSignalCapture.stop(androidLaunch?.pid));
    if (diagnostics) {
      try {
        writeFileSync(
          process.env.TF07_ANDROID_DIAGNOSTICS,
          JSON.stringify(diagnostics, null, 2),
          { flag: "wx" }
        );
      } catch {
        console.error("Android failure diagnostics could not be saved.");
      }
    }
    if (acquiredApp)
      await clean(() =>
        platform === "android"
          ? adb(["shell", "am", "force-stop", applicationId])
          : command("xcrun", ["simctl", "terminate", iosDevice, applicationId])
      );
    stoppingMetro = true;
    if (metro)
      await clean(() => {
        // The batch owns this process group, including descendants after driver exit.
        if (process.env.TF07_PARENT_PROCESS_GROUP === "1")
          metro.kill("SIGTERM");
        else return stopOwnedProcess(metro);
      });
    await clean(() => status?.close());
    for (const port of acquiredReverses.reverse())
      await clean(() => adb(["reverse", "--remove", `tcp:${port}`]));
    rmSync(temporary, { recursive: true, force: true });
  }
  if (failures.length)
    throw new AggregateError(failures, "TF07 flow or owned cleanup failed.");
  return result;
};

/** Owns one scoped logcat stream; oversized lines are dropped before retention/redaction. */
const startAndroidRecorder = async (serial, applicationId, launchPid) => {
  const startedAtUTC = new Date().toISOString();
  const limit = 128 * 1024;
  const lineLimit = 16 * 1024;
  const decoder = new StringDecoder("utf8");
  const lines = [];
  const gaps = [];
  let bytes = 0;
  let inputBytes = 0;
  let evictedLines = 0;
  let oversizedLines = 0;
  let partial = "";
  let dropping = false;
  let stopping = false;
  let closed = false;
  let finalized = false;
  let child;
  let exit;
  const gap = (reason) => {
    if (finalized) return;
    if (!gaps.includes(reason) && gaps.length < 8) gaps.push(reason);
  };
  const retain = (line) => {
    const tag = line.match(
      /^\d\d-\d\d \d\d:\d\d:\d\d\.\d+\s+\d+\s+\d+\s+[VDIWEF]\s+(lowmemorykiller|lmkd|ActivityManager)\s*:\s*(.*)/
    );
    if (!tag) return;
    // Package boundaries exclude lookalikes; PID matching uses explicit process fields.
    const packagePattern = applicationId.replaceAll(".", "\\.");
    const selectedPackage = new RegExp(
      `(^|[^\\w.])${packagePattern}(?=[:/\\s),}]|$)`
    );
    const pid = launchPid();
    const selectedPid =
      pid &&
      new RegExp(
        `(?:\\bpid[=: ]+|\\bKilling +|\\bProcess +)${pid}(?=[ :),]|$)`,
        "i"
      ).test(tag[2]);
    if (
      tag[1] === "ActivityManager" &&
      !selectedPackage.test(tag[2]) &&
      !selectedPid
    )
      return;
    const redacted = line
      .replaceAll(process.env.MAPBOX_ACCESS_TOKEN || "\0", "<REDACTED>")
      .replace(/([?&](?:access_token|token)=)[^&\s"']+/gi, "$1<REDACTED>");
    const size = Buffer.byteLength(redacted);
    lines.push({ text: redacted, size, timestamp: line.slice(0, 18) });
    bytes += size;
    while (bytes > limit) {
      bytes -= lines.shift().size;
      evictedLines++;
    }
  };
  const consume = (text) => {
    for (const fragment of text.split(/(?<=\n)/)) {
      if (!dropping) {
        if (
          Buffer.byteLength(partial) + Buffer.byteLength(fragment) >
          lineLimit
        ) {
          partial = "";
          dropping = true;
          oversizedLines++;
        } else partial += fragment;
      }
      if (fragment.endsWith("\n")) {
        if (!dropping) retain(partial);
        partial = "";
        dropping = false;
      }
    }
  };
  let resolveClosed;
  const close = new Promise((resolve) => {
    resolveClosed = resolve;
  });
  try {
    child = spawn(
      "adb",
      [
        "-s",
        serial,
        "logcat",
        "-b",
        "main",
        "-b",
        "system",
        "-v",
        "threadtime",
        "-T",
        "1",
        "lowmemorykiller:I",
        "lmkd:I",
        "ActivityManager:I",
        "*:S",
      ],
      {
        detached: process.env.TF07_PARENT_PROCESS_GROUP !== "1",
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    child.on("error", () => gap("recorder child error"));
    child.stdout.on("error", () => gap("recorder stdout error"));
    child.stderr.on("error", () => gap("recorder stderr error"));
    child.stderr.on("data", () => gap("recorder stderr output"));
    child.stdout.on("data", (chunk) => {
      if (finalized || closed) return;
      inputBytes += chunk.length;
      // Decoding bounded slices also bounds split fragments for arbitrary chunk sizes.
      for (let offset = 0; offset < chunk.length; offset += 4096)
        consume(decoder.write(chunk.subarray(offset, offset + 4096)));
    });
    child.on("exit", (code, signal) => {
      if (finalized) return;
      exit = { code, signal };
      if (!stopping) gap("recorder exited before owned stop");
    });
    child.on("close", () => {
      if (closed || finalized) return;
      consume(decoder.end());
      if (!dropping && partial) retain(partial);
      partial = "";
      closed = true;
      resolveClosed();
    });
    await new Promise((resolve) => {
      child.once("spawn", resolve);
      child.once("error", resolve);
      child.once("close", resolve);
    });
  } catch {
    gap("recorder startup failed");
  }
  return {
    stop: async () => {
      stopping = true;
      if (child) {
        try {
          if (process.env.TF07_PARENT_PROCESS_GROUP === "1")
            child.kill("SIGTERM");
          else await stopOwnedProcess(child);
        } catch {
          gap("recorder termination failed");
        }
        let timer;
        try {
          await Promise.race([
            close,
            new Promise((resolve) => {
              timer = setTimeout(resolve, 1000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        if (!closed) {
          gap("recorder flush deadline exceeded");
          try {
            child.kill("SIGKILL");
          } catch {
            gap("recorder final termination failed");
          }
          try {
            await Promise.race([
              close,
              new Promise((resolve) => {
                timer = setTimeout(resolve, 1000);
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
          if (!closed)
            gap("recorder remained unclosed after final termination");
        }
      }
      finalized = true;
      return {
        startedAtUTC,
        stoppedAtUTC: new Date().toISOString(),
        coverage:
          gaps.length || evictedLines || oversizedLines
            ? "gap"
            : "scoped stream; buffer rotation and unlogged kills remain possible",
        gaps,
        exit,
        closed,
        inputBytes,
        retainedBytes: bytes,
        limitBytes: limit,
        evictedLines,
        oversizedLines,
        truncated: evictedLines > 0 || oversizedLines > 0,
        firstRetainedTimestamp: lines[0]?.timestamp ?? null,
        lastRetainedTimestamp: lines.at(-1)?.timestamp ?? null,
        text: lines.map((line) => line.text).join(""),
      };
    },
  };
};

const nativeStatus = (onObservation) =>
  new Promise((resolveStatus, reject) => {
    let observation;
    const server = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/tf07") {
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify(observation ?? null));
        return;
      }
      if (request.method !== "POST" || request.url !== "/tf07") {
        response.writeHead(404).end();
        return;
      }
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 65536) request.destroy();
      });
      request.on("end", () => {
        try {
          observation = JSON.parse(body);
          onObservation(observation);
          response.writeHead(204).end();
        } catch {
          response.writeHead(400).end();
        }
      });
    });
    server.once("error", reject);
    server.listen(8797, "127.0.0.1", () =>
      resolveStatus({
        read: () => observation,
        close: () => new Promise((done) => server.close(done)),
      })
    );
  });

const click = async (page, selector) => {
  const point = await page.evaluate(
    `(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing input target');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`
  );
  await press(page, point);
};

const press = async (page, [x, y]) => {
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
};

const drag = async (page, selector) => {
  const point = await page.evaluate(
    `(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`
  );
  const [x, y] = point;
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let step = 1; step <= 6; step += 1)
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x + step * 8,
      y: y + step * 4,
      buttons: 1,
    });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: x + 48,
    y: y + 24,
    button: "left",
    clickCount: 1,
  });
};

const connect = (url) =>
  new Promise((resolveConnection, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let sequence = 0;
    const send = (method, params = {}) =>
      new Promise((resolveCall, rejectCall) => {
        const id = ++sequence;
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectCall(new Error(`Debugger ${method} timed out.`));
        }, 15000);
        pending.set(id, { resolve: resolveCall, reject: rejectCall, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    socket.addEventListener("open", () =>
      resolveConnection({
        send,
        evaluate: async (expression, awaitPromise = false) => {
          const result = await send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise,
          });
          if (result.exceptionDetails)
            throw new Error("The renderer probe failed.");
          return result.result?.value;
        },
        close: () => socket.close(),
      })
    );
    socket.addEventListener("error", () =>
      reject(new Error("Browser debugger connection failed."))
    );
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      clearTimeout(waiting.timeout);
      if (message.error)
        waiting.reject(new Error("Browser debugger operation failed."));
      else waiting.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const waiting of pending.values()) {
        clearTimeout(waiting.timeout);
        waiting.reject(new Error("Browser debugger closed."));
      }
      pending.clear();
    });
  });

const until = async (ready, timeout, description = "required observation") => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await ready().catch(() => false)) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`TF07 observation timed out: ${description}.`);
};

const start = (file, args, options = {}) => {
  const child = spawn(file, args, {
    ...options,
    detached: process.env.TF07_PARENT_PROCESS_GROUP !== "1",
    stdio: "ignore",
  });
  child.on("error", () => undefined);
  return child;
};

const command = (file, args) =>
  new Promise((resolveCommand, reject) => {
    const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${file} timed out.`));
    }, 30000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveCommand(output);
      else
        reject(
          Object.assign(new Error(`${file} exited ${code}.`), {
            code,
            stdout: output,
            stderr,
          })
        );
    });
  });

const requireFreePort = async (port) => {
  try {
    await command("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  } catch (error) {
    if (error.code === 1 && error.stdout === "" && error.stderr === "") return;
    throw error;
  }
  throw new Error(
    `Port ${port} is occupied; its owner must release it before acceptance.`
  );
};

const directoryDigest = (directoryRoot) => {
  const digest = createHash("sha256");
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name)
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else {
        digest.update(path.slice(directoryRoot.length));
        digest.update(readFileSync(path));
      }
    }
  };
  visit(directoryRoot);
  return digest.digest("hex");
};

const libraryDigest = () => ({
  distSha256: directoryDigest(join(root, "packages/one-map-react/dist")),
});

await main();
