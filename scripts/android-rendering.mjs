import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { observeCamera } from "./android-camera-observer.mjs";
import { stopOwnedProcess } from "./native-smoke-process.mjs";

const recovery = "/Users/rob/code/mapbox-code/one-map-f05-android-recovery";
const harness = join(recovery, "native-harness");
const targets = {
  mapbox: {
    applicationId: "com.onemapmapbox",
    apkSha256:
      "ee603d8083769791ce2b9a53a5595a1fa1f5ed6ac4b5705c0010906e49c73eb5",
    outcomes: [
      "known rendered feature and initial no-data",
      "terrain enabled before delayed DEM attachment",
      "explicit terrain clear and projection change",
      "hillshade draws the fixture's slope patch",
      "globe projection has independently different viewport output",
      "rendered output contains the known orange feature",
    ],
  },
  maplibre: {
    applicationId: "com.onemapmaplibre",
    apkSha256:
      "c4c0ccf43f9d3b7217f8085827b351f10c5ececfb6a70c603be9f766dd64d131",
    outcomes: [
      "known rendered feature and initial no-data",
      "hillshade draws the fixture's slope patch",
      "rendered output contains the known orange feature",
    ],
  },
};
const wrapper = join(recovery, "with-android-env.sh");
const serial = "emulator-5580";
const distSha256 =
  "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5";
const pngRoot =
  "/Users/rob/code/mapbox-code/one-map/node_modules/.bun/pngjs@7.0.0/node_modules/pngjs";
const root = resolve(import.meta.dirname, "..");

/**
 * Runs one fixed no-build Android scene and releases only acquired resources.
 * @param output - Fresh absolute directory for the attempt's durable receipts.
 * @param engine - Fixed backend selected by its entrypoint.
 * @param scene - Fixed rendering or camera sequence selected by its entrypoint.
 * @returns Completion after the first outcome and bounded owned cleanup.
 */
export const run = async (output, engine = "mapbox", scene = "rendering") => {
  assert(
    [
      "rendering",
      "camera",
      "acceptance",
      "acceptance-continuation",
      "signal-diagnostic",
      "mapbox-acceptance",
      "mapbox-acceptance-api36",
      "mapbox-acceptance-api36-resume",
    ].includes(scene),
    "Unknown fixed scene."
  );
  assert(
    scene !== "camera" || engine === "mapbox",
    "Camera targets Mapbox only."
  );
  const continuation = scene === "acceptance-continuation";
  const signalDiagnostic = scene === "signal-diagnostic";
  const api36Resume = scene === "mapbox-acceptance-api36-resume";
  const api36Unit = scene === "mapbox-acceptance-api36" || api36Resume;
  const mapboxUnit = scene === "mapbox-acceptance" || api36Unit;
  const avdName = api36Unit ? "OneMapF05MapboxApi36" : "OneMapU25F05";
  assert(
    !(signalDiagnostic || mapboxUnit) || engine === "mapbox",
    "Selected scene targets Mapbox only."
  );
  const batch =
    scene === "acceptance" || continuation || signalDiagnostic || mapboxUnit;
  const camera = scene === "camera" || batch;
  const ports = batch
    ? [5580, 5581, 8081, 8797]
    : camera
      ? [5580, 5581, 8081]
      : [5580, 5581, 8081, 8798];
  assert(Object.hasOwn(targets, engine), "Choose mapbox or maplibre.");
  let { applicationId, apkSha256, outcomes } = targets[engine];
  let shell = join(harness, `examples/native-${engine}`);
  let apk = join(shell, "android/app/build/outputs/apk/debug/app-debug.apk");
  assert(output, "Provide a fresh absolute output directory.");
  assert.equal(resolve(output), output);
  mkdirSync(output);

  const receipt = {
    result: "failed",
    serial,
    applicationId,
    apkSha256,
    cleanup: [],
    checkpoints: [],
    ...(mapboxUnit && {
      mode: "mapbox-android-unit",
      scope: [
        ...(api36Unit && !api36Resume ? ["mapbox-android-camera"] : []),
        "mapbox-android-core",
        "mapbox-android-retained",
      ],
      signalCalibration:
        "omitted; unsupported event and unresolved application SIGKILL",
    }),
    ...(api36Unit && { environment: "api36-google-apis-revision7-arm64-4k" }),
    ...(signalDiagnostic && {
      mode: "signal-diagnostic",
      scope: ["mapbox-android-core"],
      manualObservationLimitMs: 900000,
      traceLimitMs: 1200000,
    }),
  };
  const children = [];
  const stoppingChildren = new Set();
  const reverses = [];
  let emulator;
  let launchAttempted = false;
  let createdAvd = false;
  let installed = false;
  let failure;
  const record = () =>
    writeFileSync(
      join(output, "checkpoint.json"),
      JSON.stringify(receipt, null, 2)
    );
  const redact = (value) =>
    String(value ?? "")
      .replaceAll(process.env.MAPBOX_ACCESS_TOKEN || "\0", "<REDACTED>")
      .replace(/([?&](?:access_token|token)=)[^&\s"']+/gi, "$1<REDACTED>");
  const execute = async (file, args, timeout = 30000, input) => {
    const started = Date.now();
    try {
      const child = promisify(execFile)(file, args, {
        timeout,
        maxBuffer: 1024 * 1024,
        env: process.env,
      });
      if (input === undefined) return (await child).stdout;
      const inputFailure = new Promise((_, reject) => {
        child.child.stdin.once("error", reject);
      });
      child.child.stdin.end(input);
      return (await Promise.race([child, inputFailure])).stdout;
    } catch (error) {
      const failures = (receipt.commandFailures ??= []);
      if (failures.length < 8)
        failures.push({
          file: redact(file),
          args: args.map(redact),
          timeoutMs: timeout,
          elapsedMs: Date.now() - started,
          code: error.code ?? null,
          signal: error.signal ?? null,
          killed: error.killed ?? false,
          stdout: redact(error.stdout).slice(-4096),
          stderr: redact(error.stderr).slice(-4096),
        });
      throw error;
    }
  };
  const android = (args, timeout, input) =>
    execute("/bin/sh", [wrapper, ...args], timeout, input);
  const adb = (args, timeout, input) =>
    android(["adb", "-s", serial, ...args], timeout, input);
  const checkpoint = async (name, action) => {
    receipt.checkpoints.push({ name, state: "started" });
    record();
    const result = await action();
    receipt.checkpoints.push({ name, state: "completed" });
    record();
    return result;
  };
  const verifyInputs = (preparation, freeze) => {
    assert.equal(sha256(apk), apkSha256, "Verified retained APK changed.");
    if (batch && !mapboxUnit)
      for (const [selected, target] of Object.entries(targets))
        assert.equal(
          sha256(
            join(
              harness,
              `examples/native-${selected}/android/app/build/outputs/apk/debug/app-debug.apk`
            )
          ),
          target.apkSha256,
          "Verified retained batch APK changed."
        );
    assert.equal(sha256(preparation.freeze.path), preparation.freeze.sha256);
    assert.equal(Object.keys(freeze.files).length, 695);
    for (const [file, hash] of Object.entries({
      ...freeze.files,
      ...preparation.stagedSha256,
      ...preparation.hostInputSha256,
      ...preparation.cameraInputSha256,
      ...preparation.batchInputSha256,
      ...preparation.operatorHelperSha256,
    }))
      assert.equal(sha256(file), hash, `Frozen runtime input changed: ${file}`);
  };
  const start = (file, args, cwd, env = {}) => {
    const diagnosticDriver = args.some((arg) =>
      arg.endsWith("tf07-ui-smoke.mjs")
    );
    const child = spawn(file, args, {
      cwd,
      detached: true,
      stdio: diagnosticDriver ? ["inherit", "inherit", "pipe"] : "inherit",
      env: {
        ...process.env,
        PATH: `${join(recovery, "runtime-bin")}:${process.env.PATH}`,
        ...env,
      },
    });
    if (diagnosticDriver) {
      const logPath = join(output, `${receipt.currentRow}-driver-stderr.log`);
      let tail = "";
      let pending = "";
      let oversized = false;
      const retainLine = (line) => {
        const redacted = line
          .replaceAll(process.env.MAPBOX_ACCESS_TOKEN || "\0", "<REDACTED>")
          .replace(/([?&](?:access_token|token)=)[^&\s"']+/gi, "$1<REDACTED>");
        tail = (tail + redacted).slice(-128 * 1024);
        process.stderr.write(redacted);
        try {
          writeFileSync(logPath, tail);
        } catch (error) {
          receipt.diagnosticErrors = [
            ...(receipt.diagnosticErrors ?? []),
            String(error).slice(-512),
          ].slice(-8);
        }
      };
      child.stderr.on("data", (chunk) => {
        const lines = (pending + chunk).split("\n");
        pending = lines.pop();
        for (const line of lines) {
          retainLine(
            oversized || line.length > 128 * 1024
              ? "[Oversized diagnostic line omitted]\n"
              : `${line}\n`
          );
          oversized = false;
        }
        if (pending.length > 128 * 1024) {
          pending = "";
          oversized = true;
        }
      });
      child.stderr.on("end", () => {
        if (oversized) retainLine("[Oversized diagnostic line omitted]\n");
        else if (pending) retainLine(pending);
      });
    }
    child.on("error", (error) => {
      failure ??= error;
    });
    child.on("exit", (code, signal) => {
      if (!stoppingChildren.has(child) && (code !== 0 || signal))
        failure ??= new Error(`${file} exited: ${code}/${signal}`);
    });
    children.push(child);
    return child;
  };
  const stopChild = async (child) => {
    stoppingChildren.add(child);
    await stopOwnedProcess(child);
  };
  const until = async (observe, timeout = 60000, checkChildren = true) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (checkChildren && failure) throw failure;
      try {
        const ready = await observe();
        if (checkChildren && failure) throw failure;
        if (ready) return;
      } catch (error) {
        if (
          error.code !== "ECONNREFUSED" &&
          error.cause?.code !== "ECONNREFUSED" &&
          error.name !== "TimeoutError"
        )
          throw error;
      }
      await new Promise((done) => setTimeout(done, 200));
    }
    throw new Error("Assigned runtime readiness timed out.");
  };
  const identity = async (phase) => {
    assert.equal(sha256(apk), apkSha256, "Verified retained APK changed.");
    const paths = (await adb(["shell", "pm", "path", applicationId]))
      .trim()
      .split(/\r?\n/);
    assert.equal(paths.length, 1, "Expected one installed base APK.");
    assert.match(
      paths[0],
      /^package:\/data\/app\/[A-Za-z0-9_~+./=-]+\/base\.apk$/
    );
    const path = paths[0].slice(8);
    // Hash installed bytes in place; bulk APK transfer is unnecessary for identity.
    const digest = (
      await adb(["shell", "/system/bin/toybox", "sha256sum", path])
    )
      .trim()
      .match(/^([a-f0-9]{64})  (\/data\/app\/[^\s]+\/base\.apk)$/);
    assert(digest, "Malformed installed APK SHA256 output.");
    assert.equal(digest[2], path, "Installed APK SHA256 path differs.");
    const hash = digest[1];
    (receipt.identityReads ??= []).push({ phase, path, sha256: hash });
    record();
    assert.equal(hash, apkSha256, "Installed APK differs from verified APK.");
  };
  const isEmulatorRunning = async () => {
    const inventory = await execute("ps", ["-ax", "-o", "pid=,pgid=,stat="]);
    return inventory.split("\n").some((line) => {
      const [pid, group, state] = line.trim().split(/\s+/);
      return (
        (Number(pid) === emulator.pid || Number(group) === emulator.pgid) &&
        !state?.startsWith("Z")
      );
    });
  };
  try {
    if (engine === "mapbox") {
      receipt.tokenPresent = Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
      assert(receipt.tokenPresent, "Mapbox access token is required.");
    }
    if (continuation || mapboxUnit) {
      const priorPath = join(
        root,
        "records/evidence/revised-api-u26-android-platform-batch-attempt-01.json"
      );
      assert.equal(
        sha256(priorPath),
        "38fb7d4b86c6ee4a76bb1551eaa53644325a2949ffbba669218663f641a3e00f",
        "Prior outcome changed."
      );
      const prior = JSON.parse(readFileSync(priorPath));
      assert.equal(prior.result, "stopped-at-first-ui-failure");
      assert.equal(
        prior.candidateSha256,
        "33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276"
      );
      assert.equal(prior.distSha256, distSha256);
      assert.deepEqual(
        prior.completedRows.map(({ rowId, status }) => ({ rowId, status })),
        [{ rowId: "mapbox-android-camera", status: "passed" }]
      );
      if (api36Unit) receipt.previousEnvironmentRows = prior.completedRows;
      else receipt.reusedRows = prior.completedRows;
      receipt.priorOutcome = { path: priorPath, sha256: sha256(priorPath) };
    }
    if (api36Resume) {
      const path = join(
        root,
        "records/evidence/revised-api-u26-android-mapbox-api36-attempt-24.json"
      );
      const hash =
        "ed5eb01cdfe604650117ebeac924add146ae5c6e1bc092964f34b74f88e9065c";
      assert.equal(sha256(path), hash, "API36 prior outcome changed.");
      const prior = JSON.parse(readFileSync(path));
      assert.equal(
        prior.candidateSha256,
        "33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276"
      );
      assert.equal(prior.inputApkSha256, apkSha256);
      assert.equal(prior.result, "stopped-at-popup-attachment-observation");
      assert.deepEqual(
        prior.completedRows.map(({ rowId, status }) => ({ rowId, status })),
        [{ rowId: "mapbox-android-camera", status: "passed" }]
      );
      receipt.reusedRows = prior.completedRows;
      receipt.api36PriorOutcome = { path, sha256: hash };
    }
    const peerEvidence = join(
      root,
      api36Resume
        ? "records/evidence/revised-api-u26-mapbox-android-api36-console-resume-preparation.json"
        : api36Unit
          ? "records/evidence/revised-api-u26-mapbox-android-api36-preparation.json"
          : mapboxUnit
            ? "records/evidence/revised-api-u26-mapbox-android-unit-preparation.json"
            : signalDiagnostic
              ? "records/evidence/revised-api-u26-signal-liveness-preparation.json"
              : continuation
                ? "records/evidence/revised-api-u26-android-kernel-console-preparation.json"
                : batch
                  ? "records/evidence/revised-api-u26-platform-batches-preparation.json"
                  : `records/evidence/revised-api-u25-f05-${engine}-android-${scene}-preparation.json`
    );
    const preparation = JSON.parse(readFileSync(peerEvidence));
    const freeze = JSON.parse(readFileSync(preparation.freeze.path));
    verifyInputs(preparation, freeze);
    receipt.frozenFiles = 695;
    const disk = statfsSync(recovery);
    receipt.freeBytes = disk.bavail * disk.bsize;
    const imageNeeded =
      api36Unit && !existsSync(join(recovery, "android-api36-image"));
    assert(
      !api36Resume || !imageNeeded,
      "Resume requires the retained verified API36 image; no download is authorized."
    );
    const requiredBytes =
      (mapboxUnit ? 12 * 1024 ** 3 : 8804682957) +
      (imageNeeded ? 4575096761 : 0);
    assert(
      receipt.freeBytes >= requiredBytes,
      api36Unit
        ? `API36 setup and batch require ${requiredBytes} free bytes; stop before staging.`
        : `Android preboot requires ${mapboxUnit ? "12" : "8.2"} GiB free; stop without deleting files.`
    );
    if (!camera) createRequire(join(pngRoot, "package.json"))("pngjs");
    for (const port of ports) await requireFreePort(port, execute);
    assert(
      !(await android(["adb", "devices"]))
        .split(/\r?\n/)
        .some((line) => line.startsWith(`${serial}\t`)),
      "Assigned emulator already exists."
    );
    const avd = join(recovery, `android-avd/${avdName}.avd`);
    const ini = join(recovery, `android-avd/${avdName}.ini`);
    assert(!existsSync(avd) && !existsSync(ini), "Task AVD already exists.");
    await checkpoint("create private AVD", () => {
      if (api36Unit)
        return android(
          ["python3", join(root, "scripts/setup-android-api36.py"), output],
          1500000
        ).then(() => {
          createdAvd = true;
        });
      // The legacy helper does not own its partial cleanup.
      createdAvd = true;
      return android([
        "python3",
        join(recovery, "create-lifetime-task-avd.py"),
      ]);
    });
    if (api36Unit)
      assert(
        !(await android(["adb", "devices"]))
          .split(/\r?\n/)
          .some((line) => line.startsWith(`${serial}\t`)),
        "Assigned emulator already exists."
      );
    const launched = JSON.parse(
      await checkpoint("launch private emulator", () => {
        launchAttempted = true;
        return android(
          [
            "python3",
            join(root, "scripts/launch-android-lifetime-emulator.py"),
            join(output, "emulator.log"),
            ...(api36Unit ? ["--api36"] : []),
          ],
          10000
        );
      })
    );
    assert(
      Number.isSafeInteger(launched.pid) &&
        launched.pid > 1 &&
        launched.pid === launched.pgid,
      "Invalid owned emulator identity."
    );
    emulator = launched;
    receipt.emulator = emulator;
    record();
    await checkpoint("boot private emulator", () =>
      android(
        ["python3", "/private/tmp/one-map-approved-android-boot-poll.py"],
        190000
      )
    );
    if (api36Unit) {
      const api = (
        await adb(["shell", "getprop", "ro.build.version.sdk"])
      ).trim();
      const abi = (
        await adb(["shell", "getprop", "ro.product.cpu.abi"])
      ).trim();
      const pageBytes = (await adb(["shell", "getconf", "PAGE_SIZE"])).trim();
      const gles = Number(
        (await adb(["shell", "getprop", "ro.opengles.version"])).trim()
      );
      receipt.deviceIdentity = { api, abi, pageBytes, gles };
      record();
      assert(
        api === "36" &&
          abi === "arm64-v8a" &&
          pageBytes === "4096" &&
          Number.isInteger(gles) &&
          gles >= 196608,
        "API36 unit requires API36, arm64-v8a, 4K pages and GLES3 before installation."
      );
    }
    const existingReverses = await adb(["reverse", "--list"]);
    for (const port of camera ? [8081] : [8081, 8798]) {
      assert(
        !existingReverses.split(/\s+/).includes(`tcp:${port}`),
        `Reverse ${port} already exists.`
      );
      await adb(["reverse", `tcp:${port}`, `tcp:${port}`], 20000);
      reverses.push(port);
    }
    receipt.rows = batch ? [] : undefined;
    for (const selectedEngine of batch && !signalDiagnostic && !mapboxUnit
      ? ["mapbox", "maplibre"]
      : [engine]) {
      engine = selectedEngine;
      ({ applicationId, apkSha256, outcomes } = targets[engine]);
      shell = join(harness, `examples/native-${engine}`);
      apk = join(shell, "android/app/build/outputs/apk/debug/app-debug.apk");
      installed = false;
      assert.equal(sha256(apk), apkSha256);
      await checkpoint(`install verified ${engine} APK`, () =>
        adb(["install", "-r", "-t", apk], 120000).then((result) => {
          assert.match(
            result,
            /\bSuccess\b/,
            "APK installation was not confirmed."
          );
          installed = true;
        })
      );
      await identity(batch ? `${engine}-installed` : "before");
      await adb(["shell", "am", "force-stop", applicationId]);
      await adb([
        "shell",
        "run-as",
        applicationId,
        "mkdir",
        "-p",
        "shared_prefs",
      ]);
      // A fresh private emulator has no user preferences to preserve.
      const preferences = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map><string name="debug_http_host">localhost:8081</string></map>\n`;
      await adb(
        [
          "shell",
          `run-as ${applicationId} sh -c 'cat > shared_prefs/${applicationId}_preferences.xml'`,
        ],
        30000,
        preferences
      );
      assert.equal(
        (
          await adb([
            "exec-out",
            "run-as",
            applicationId,
            "cat",
            `shared_prefs/${applicationId}_preferences.xml`,
          ])
        ).trim(),
        preferences.trim()
      );
      const api = Number(
        (await adb(["shell", "getprop", "ro.build.version.sdk"])).trim()
      );
      assert(
        Number.isInteger(api) && (api36Unit ? api === 36 : api >= 37),
        api36Unit
          ? "Expected Android API36."
          : "Expected cached Android API 37 or later."
      );
      if (!api36Unit)
        await adb([
          "shell",
          "pm",
          "grant",
          applicationId,
          "android.permission.ACCESS_LOCAL_NETWORK",
        ]);
      for (const row of api36Unit
        ? api36Resume
          ? ["core", "retained"]
          : ["camera", "core", "retained"]
        : mapboxUnit
          ? ["core", "retained"]
          : signalDiagnostic
            ? ["core"]
            : batch
              ? ["camera", "core", "retained"]
              : [scene]) {
        if (continuation && engine === "mapbox" && row === "camera") continue;
        const rowId = `${engine}-android-${row}`;
        if (batch) {
          receipt.currentRow = rowId;
          record();
        }
        if (batch) {
          await identity(`${rowId}-before`);
          verifyInputs(preparation, freeze);
        }
        const rowChildren = children.length;
        if (row === "core" || row === "retained") {
          if (api36Unit) console.log(`API36 ${row} operator phase starting`);
          const driver = start(
            "/bin/sh",
            [
              wrapper,
              process.execPath,
              join(root, "scripts/tf07-ui-smoke.mjs"),
              "android",
              engine,
              ...(row === "retained" ? ["retained"] : []),
            ],
            harness,
            {
              TF07_HARNESS_ROOT: harness,
              TF07_METRO_PORT: "8081",
              ANDROID_SERIAL: serial,
              TF07_NATIVE_BINARY_SHA256: apkSha256,
              TF07_BORROWED_METRO_REVERSE: "1",
              TF07_PARENT_PROCESS_GROUP: "1",
              TF07_MANUAL_REPORT: join(output, `${rowId}-manual.json`),
              TF07_REUSE_API36_ATTEMPT24:
                api36Resume && row === "core" ? "1" : "",
              TF07_OUTPUT: join(output, `${rowId}-result.json`),
              TF07_NATIVE_TIMEOUT_MS: signalDiagnostic ? "900000" : "1800000",
              ...(signalDiagnostic && { TF07_ANDROID_SIGNAL_OUTPUT: output }),
              ...(mapboxUnit && { TF07_ANDROID_SIGNAL_OUTPUT: "" }),
              TF07_ANDROID_DIAGNOSTICS: join(
                output,
                `${rowId}-diagnostics.json`
              ),
            }
          );
          await until(
            () => driver.exitCode !== null || driver.signalCode !== null,
            signalDiagnostic ? 1500000 : 2100000
          );
          assert.equal(driver.exitCode, 0, `${rowId} driver failed.`);
          const result = JSON.parse(
            readFileSync(join(output, `${rowId}-result.json`))
          );
          assert.equal(result.artifact.distSha256, distSha256);
          assert.deepEqual(Object.keys(result.results), [`${engine}-android`]);
          const observed = result.results[`${engine}-android`];
          assert.equal(observed.status, "passed");
          assert.equal(observed.installedBinarySha256, apkSha256);
          assert.equal(observed.libraryDistSha256, distSha256);
          receipt.scene = observed;
        } else {
          const metro = start(
            "/bin/sh",
            [
              wrapper,
              join(recovery, "runtime-bin/bun"),
              "run",
              "start",
              "--reset-cache",
              "--port",
              "8081",
            ],
            shell,
            { ONE_MAP_SMOKE: camera ? "tf04" : "tf09" }
          );
          metro.once("exit", (code, signal) => {
            if (!stoppingChildren.has(metro))
              failure ??= new Error(
                `Metro exited before scene completion: ${code}/${signal}`
              );
          });
          await until(async () =>
            (
              await fetch("http://127.0.0.1:8081/status", {
                signal: AbortSignal.timeout(2000),
              })
            )
              .text()
              .then((body) => body === "packager-status:running")
          );
          let driver;
          if (!camera) {
            driver = start(
              process.execPath,
              [
                join(harness, "scripts/tf09-rendering-smoke.mjs"),
                "android",
                engine,
              ],
              harness,
              {
                TF09_OUTPUT: join(output, "scene.json"),
                TF09_LIBRARY_SHA256: distSha256,
                TF09_NATIVE_IDENTITY: apkSha256,
                TF09_PEER_EVIDENCE: peerEvidence,
                TF09_RUNTIME_NODE_MODULES: pngRoot,
              }
            );
            await until(
              async () =>
                (
                  await fetch("http://127.0.0.1:8798/command", {
                    signal: AbortSignal.timeout(2000),
                  })
                ).ok
            );
          }
          const launch = await checkpoint("launch selected app", () =>
            adb([
              "shell",
              "am",
              "start",
              "-W",
              "-n",
              `${applicationId}/.MainActivity`,
            ])
          );
          assert.match(launch, /Status: ok/);
          assert(
            !/Error:|Exception/.test(launch),
            "Selected app launch failed."
          );
          if (camera) {
            receipt.scene = await observeCamera({
              adb,
              execute,
              until,
              engine,
              record: (observation) => {
                receipt.camera = observation;
                record();
              },
            });
          } else {
            await until(
              () => driver.exitCode !== null || driver.signalCode !== null,
              600000
            );
            assert.equal(driver.exitCode, 0);
            receipt.scene = JSON.parse(
              readFileSync(join(output, "scene.json"))
            );
            assert.equal(receipt.scene.platform, "android");
            assert.equal(receipt.scene.engine, engine);
            assert.equal(receipt.scene.artifact, distSha256);
            assert.equal(receipt.scene.nativeIdentity, apkSha256);
            assert.deepEqual(
              receipt.scene.outcomes.map((value) => value.name),
              outcomes
            );
            assert(
              receipt.scene.outcomes.every((value) => value.status === "passed")
            );
          }
        }
        await identity(batch ? `${rowId}-after` : "after");
        verifyInputs(preparation, freeze);
        if (failure) throw failure;
        if (batch) {
          receipt.rows.push({ rowId, status: "passed", scene: receipt.scene });
          record();
          await adb(["shell", "am", "force-stop", applicationId]);
          for (const child of children.slice(rowChildren).reverse())
            await stopChild(child);
          children.splice(rowChildren);
          await requireFreePort(8081, execute);
          await requireFreePort(8797, execute);
        }
      }
    }
    receipt.result = "passed";
  } catch (error) {
    receipt.error = redact(error);
    if (existsSync(join(output, "scene.json"))) {
      try {
        receipt.scene = JSON.parse(readFileSync(join(output, "scene.json")));
      } catch (sceneError) {
        receipt.sceneReadError = String(sceneError);
      }
    }
    process.exitCode = 1;
  } finally {
    const cleanup = async (name, action) => {
      try {
        await action();
        receipt.cleanup.push({ name, result: "passed" });
        return true;
      } catch (error) {
        receipt.cleanup.push({ name, error: redact(error) });
        receipt.result = "failed";
        process.exitCode = 1;
        return false;
      } finally {
        try {
          record();
        } catch (error) {
          (receipt.recordErrors ??= []).push(String(error));
          receipt.result = "failed";
          process.exitCode = 1;
        }
      }
    };
    if (installed)
      await cleanup("selected app termination", () =>
        adb(["shell", "am", "force-stop", applicationId])
      );
    for (const child of children.reverse())
      await cleanup(`owned process ${child.pid}`, () => stopChild(child));
    for (const port of reverses.reverse())
      await cleanup(`owned reverse ${port}`, () =>
        adb(["reverse", "--remove", `tcp:${port}`], 20000)
      );
    let emulatorStopped = !launchAttempted;
    if (launchAttempted && !emulator)
      await cleanup("uncertain emulator ownership", async () => {
        throw new Error(
          "Emulator launch attempted without authenticated PID/PGID; preserve private AVD for coordinator review."
        );
      });
    if (emulator) {
      const stoppedByAdb = await cleanup("owned emulator shutdown", () =>
        adb(["emu", "kill"], 20000)
      );
      if (!stoppedByAdb)
        await cleanup("owned emulator group fallback", async () => {
          const signalOwnedGroup = (signal) => {
            try {
              process.kill(-emulator.pgid, signal);
            } catch (error) {
              if (error.code !== "ESRCH") throw error;
            }
          };
          signalOwnedGroup("SIGTERM");
          let exited = false;
          try {
            await until(async () => !(await isEmulatorRunning()), 5000, false);
            exited = true;
          } catch (error) {
            if (error.message !== "Assigned runtime readiness timed out.")
              throw error;
          } finally {
            if (!exited) signalOwnedGroup("SIGKILL");
          }
        });
      emulatorStopped = await cleanup("owned emulator process exit", () =>
        until(async () => !(await isEmulatorRunning()), 30000, false)
      );
    }
    let portsReleased = true;
    if (createdAvd || children.length) {
      for (const port of ports) {
        if (
          !(await cleanup(`released port ${port}`, () =>
            requireFreePort(port, execute)
          ))
        )
          portsReleased = false;
      }
    }
    if (createdAvd && emulatorStopped && portsReleased)
      await cleanup("owned private AVD removal", async () => {
        rmSync(join(recovery, `android-avd/${avdName}.avd`), {
          recursive: true,
          force: true,
        });
        rmSync(join(recovery, `android-avd/${avdName}.ini`), { force: true });
      });
    try {
      writeFileSync(
        join(output, "receipt.json"),
        JSON.stringify(receipt, null, 2),
        { flag: "wx" }
      );
    } catch (error) {
      process.exitCode = 1;
      console.error(`Final receipt write failed after owned cleanup: ${error}`);
    }
  }
};

const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

/** Rejects unknown IPv4 and IPv6 listeners without stopping them. */
const requireFreePort = async (port, execute) => {
  try {
    await execute(
      "/usr/sbin/lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
      10000
    );
  } catch (error) {
    if (error.code === 1 && error.stdout === "" && error.stderr === "") return;
    throw error;
  }
  throw new Error(`Assigned port ${port} already has a listener.`);
};
