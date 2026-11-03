import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { observeCamera } from "./android-camera-observer.mjs";

const source = readFileSync(
  new URL("./android-rendering.mjs", import.meta.url),
  "utf8"
)
  .replace(/^import[\s\S]*?from "[^\n]+";\n/gm, "")
  .replaceAll("export const", "const")
  .replace('resolve(import.meta.dirname, "..")', '"/review"')
  .replace(/if \(\s*process.argv\[1\][\s\S]*$/, "");
const apkHashes = {
  maplibre: "c4c0ccf43f9d3b7217f8085827b351f10c5ececfb6a70c603be9f766dd64d131",
  mapbox: "ee603d8083769791ce2b9a53a5595a1fa1f5ed6ac4b5705c0010906e49c73eb5",
};
const distHash =
  "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5";
const names = [
  "known rendered feature and initial no-data",
  "terrain enabled before delayed DEM attachment",
  "explicit terrain clear and projection change",
  "hillshade draws the fixture's slope patch",
  "globe projection has independently different viewport output",
  "rendered output contains the known orange feature",
];

for (const [
  engine,
  camera,
  batch = false,
  continuation = false,
  signalDiagnostic = false,
  mapboxUnit = false,
  api36Unit = false,
  api36Resume = false,
  maplibreResume = false,
  maplibreRetained = false,
] of [
  ["mapbox", false],
  ["maplibre", false],
  ["mapbox", true],
  ["mapbox", true, true],
  ["mapbox", true, true, true],
  ["mapbox", true, true, false, true],
  ["mapbox", true, true, false, false, true],
  ["mapbox", true, true, false, false, true, true],
  ["maplibre", true, true, false, false, true, true],
  ["maplibre", true, true, false, false, true, true, false, true],
  ["maplibre", true, true, false, false, true, true, true, false, true],
  ["mapbox", true, true, false, false, true, true, true],
]) {
  const avdName = api36Unit ? "OneMapF05MapboxApi36" : "OneMapU25F05";
  const apkHash = apkHashes[engine];
  const expectedNames =
    engine === "mapbox" ? names : [names[0], names[3], names[5]];
  // Run the actual launcher with fake host boundaries; no Android tool is invoked.
  for (const failAt of [
    null,
    ...(engine === "mapbox" ? ["missing-token", "whitespace-token"] : []),
    "existing-output",
    ...(continuation || (mapboxUnit && engine === "mapbox")
      ? ["prior-hash", "prior-prefix"]
      : []),
    ...(mapboxUnit ? ["retained-driver"] : []),
    ...(api36Resume
      ? [
          "core-proof-hash",
          "core-proof-row",
          "core-proof-identity",
          "core-proof-after",
          "core-proof-scope",
          "core-proof-observed",
          "core-proof-manual",
          "core-proof-remaining",
        ]
      : []),
    ...(api36Unit
      ? [
          "device",
          "image-stage",
          "image-capacity",
          "wrong-api",
          "wrong-abi",
          "pages-16k",
          "gles2",
        ]
      : []),
    "low-space",
    "apk",
    "observer",
    "busy-port",
    "ipv6-listener",
    "device",
    "avd",
    "create",
    "checkpoint-before-create",
    "launch-emulator",
    "invalid-emulator-identity",
    "malformed-emulator-identity",
    "boot",
    "reverse-conflict",
    "reverse",
    "install",
    "identity-before",
    "split-apk",
    "debug-write",
    "stdin-epipe",
    "debug-read",
    "api",
    "grant",
    "spawn",
    "metro-zero",
    "readiness",
    "app-launch",
    "driver",
    "driver-stderr",
    "driver-cleanup",
    "partial",
    "wrong-platform",
    "wrong-engine",
    "wrong-artifact",
    "wrong-identity",
    "failed-scene",
    "malformed",
    "identity-after",
    "observer-after",
    "late-metro-exit",
    "cleanup",
    "driver-record-cleanup",
    "emulator-adb-failure",
    "emulator-kill-fallback",
    "emulator-exit",
    "release-port",
  ]
    .filter((failure) => batch || failure !== "driver-stderr")
    .filter(
      (failure) =>
        !batch ||
        [
          null,
          "identity-before",
          "identity-after",
          "observer",
          "cleanup",
          "driver",
          "driver-stderr",
          "late-metro-exit",
          "prior-hash",
          "prior-prefix",
          ...(mapboxUnit ? ["low-space", "retained-driver"] : []),
          ...(api36Resume
            ? [
                "core-proof-hash",
                "core-proof-row",
                "core-proof-identity",
                "core-proof-after",
                "core-proof-scope",
                "core-proof-observed",
                "core-proof-manual",
                "core-proof-remaining",
              ]
            : []),
          ...(api36Unit
            ? [
                "device",
                "image-stage",
                "image-capacity",
                "wrong-api",
                "wrong-abi",
                "pages-16k",
                "gles2",
              ]
            : []),
        ].includes(failure)
    )
    .filter(
      (failure) =>
        batch ||
        !camera ||
        ![
          "reverse-conflict",
          "reverse",
          "driver",
          "driver-cleanup",
          "partial",
          "wrong-platform",
          "wrong-engine",
          "wrong-artifact",
          "wrong-identity",
          "failed-scene",
          "malformed",
          "driver-record-cleanup",
        ].includes(failure)
    )
    .filter((failure) => !continuation || failure !== "late-metro-exit")
    .filter((failure) => !mapboxUnit || failure !== "late-metro-exit")
    .filter(
      (failure) =>
        !signalDiagnostic ||
        [null, "driver", "identity-before", "cleanup"].includes(failure)
    )) {
    const commands = [];
    const stopped = [];
    const removed = [];
    const children = [];
    let receipt;
    let latestCheckpoint;
    const phaseMessages = [];
    let clock = 0;
    let launched = false;
    let postIdentity = false;
    let created = false;
    let preferences;
    let cleanupStarted = false;
    const signals = [];
    let identityChecks = 0;
    let statusReads = 0;
    let activeEngine = engine;
    let coreRows = 0;
    let cameraRows = 0;
    const cameraEngines = [];
    let installs = 0;
    const stderrWrites = [];
    const stderrPrinted = [];
    let priorDriver;
    const scene = {
      platform: failAt === "wrong-platform" ? "ios" : "android",
      engine:
        failAt === "wrong-engine"
          ? engine === "mapbox"
            ? "maplibre"
            : "mapbox"
          : engine,
      artifact: failAt === "wrong-artifact" ? "wrong" : distHash,
      nativeIdentity: failAt === "wrong-identity" ? "wrong" : apkHash,
      outcomes: expectedNames
        .slice(0, failAt === "partial" ? 2 : expectedNames.length)
        .map((name) => ({
          name,
          status: failAt === "failed-scene" ? "failed" : "passed",
        })),
    };
    const fail = (message) => {
      throw new Error(message);
    };
    const execute = async (file, args) => {
      commands.push([file, ...args]);
      if (file.endsWith("lsof")) {
        if (
          (!created && ["busy-port", "ipv6-listener"].includes(failAt)) ||
          (created && failAt === "release-port")
        )
          return "unknown listener";
        throw Object.assign(new Error("empty"), {
          code: 1,
          stdout: "",
          stderr: "",
        });
      }
      if (file === "ps")
        return failAt === "emulator-exit" ||
          (failAt === "emulator-kill-fallback" &&
            !signals.some(([, signal]) => signal === "SIGKILL"))
          ? "501 501 S"
          : "";
      if (file === "python3") {
        const final = statusReads++ % 2 > 0;
        return JSON.stringify(
          `TF04 fit=ok click=${final ? "hit" : "pending"} clickAt=${final ? "-122.32000,47.64000" : "pending"} stop=${final ? "rejected" : "pending"} held=${final ? "0" : "pending"} command=${final ? "applied" : "pending"} doubletap=skip center=${final ? "-120.00000,45.00000" : "-122.32000,47.64000"} note=none phase=${final ? "done" : "await-click"} done=${final ? "1" : "0"}`
        );
      }
      const command = args.slice(1);
      if (command[0] === "python3") {
        if (command[1].endsWith("/scripts/setup-android-api36.py")) {
          created = true;
          assert.equal(command[2], "/attempt");
          if (failAt === "image-stage") fail("image staging failed");
          return "";
        }
        if (command[1].includes("create-lifetime")) {
          created = true;
          if (failAt === "create") fail("create failed");
          return "";
        }
        if (
          command[1].endsWith("/scripts/launch-android-lifetime-emulator.py")
        ) {
          assert.equal(command.includes("--api36"), api36Unit);
          if (failAt === "launch-emulator") fail("emulator launch failed");
          if (failAt === "invalid-emulator-identity")
            return JSON.stringify({ pid: 0, pgid: 501 });
          if (failAt === "malformed-emulator-identity") return "{";
          return JSON.stringify({ pid: 501, pgid: 501 });
        }
        if (failAt === "boot") fail("boot timed out");
        return "booted";
      }
      assert.equal(command[0], "adb");
      if (command[1] === "devices")
        return failAt === "device"
          ? "List of devices attached\nemulator-5580\tdevice\n"
          : "List of devices attached\n";
      assert.deepEqual(Array.from(command.slice(1, 3)), [
        "-s",
        "emulator-5580",
      ]);
      const adb = command.slice(3);
      if (adb[0] === "reverse") {
        if (adb[1] === "--list")
          return failAt === "reverse-conflict"
            ? "emulator-5580 tcp:8798 tcp:8798"
            : "";
        if (failAt === "reverse" && adb[1] === "tcp:8798")
          fail("reverse failed");
        return "";
      }
      if (adb[0] === "install") {
        activeEngine = adb.at(-1).includes("native-maplibre")
          ? "maplibre"
          : engine;
        installs++;
        assert(
          adb
            .at(-1)
            .endsWith(
              `examples/native-${activeEngine}/android/app/build/outputs/apk/debug/app-debug.apk`
            )
        );
        if (failAt === "install") fail("install failed");
        return "Success";
      }
      if (adb.join(" ").includes("pm path")) {
        assert.equal(adb.at(-1), `com.onemap${activeEngine}`);
        return failAt === "split-apk"
          ? "package:/data/app/one/base.apk\npackage:/data/app/one/split.apk\n"
          : "package:/data/app/one/base.apk\n";
      }
      if (
        adb.join(" ") ===
        "shell /system/bin/toybox sha256sum /data/app/one/base.apk"
      ) {
        identityChecks++;
        postIdentity = identityChecks >= 2;
        const hash =
          (failAt === "identity-before" && !postIdentity) ||
          (failAt === "identity-after" && postIdentity)
            ? "0".repeat(64)
            : apkHashes[activeEngine];
        return `${hash}  /data/app/one/base.apk\n`;
      }
      if (adb.join(" ").includes("cat >")) {
        if (failAt === "debug-write") fail("debug host write failed");
        if (failAt === "stdin-epipe") return new Promise(() => {});
        return "";
      }
      if (adb.join(" ") === "shell wm size") return "Physical size: 1080x2400";
      if (adb[0] === "exec-out" && adb[1] === "cat") return "xml";
      if (adb[0] === "exec-out")
        return failAt === "debug-read" ? "wrong" : preferences;
      if (adb.join(" ").includes("ro.build.version.sdk"))
        return failAt === "api"
          ? "invalid"
          : api36Unit && failAt !== "wrong-api"
            ? "36"
            : "37";
      if (adb.join(" ").includes("ro.product.cpu.abi"))
        return failAt === "wrong-abi" ? "x86_64" : "arm64-v8a";
      if (adb.join(" ").includes("PAGE_SIZE"))
        return failAt === "pages-16k" ? "16384" : "4096";
      if (adb.join(" ").includes("ro.opengles.version"))
        return failAt === "gles2" ? "131072" : "196608";
      if (adb.join(" ").includes("pm grant") && failAt === "grant")
        fail("permission failed");
      if (adb.join(" ").includes("am start")) {
        launched = true;
        if (failAt === "app-launch") fail("app launch failed");
        return "Status: ok\n";
      }
      if (adb.join(" ").includes("force-stop") && launched)
        cleanupStarted = true;
      if (
        adb[0] === "emu" &&
        ["emulator-adb-failure", "emulator-kill-fallback"].includes(failAt)
      )
        fail("offline emulator transport");
      if (
        adb.join(" ").includes("force-stop") &&
        ["cleanup", "driver-cleanup"].includes(failAt) &&
        launched
      )
        fail("cleanup failed");
      return "";
    };
    const context = {
      console: {
        log: (message) => {
          if (String(message).startsWith("API36 ")) {
            const row = String(message).split(" ")[1];
            assert.equal(
              latestCheckpoint.currentRow,
              `${engine}-android-${row}`
            );
            if (!api36Resume && !maplibreResume)
              assert.equal(
                latestCheckpoint.rows.at(-1).rowId,
                `${engine}-android-${row === "core" ? "camera" : "core"}`
              );
            if (!api36Resume && !maplibreResume)
              assert.equal(latestCheckpoint.rows.at(-1).status, "passed");
            phaseMessages.push(message);
          }
        },
        error: () => {},
      },
      assert,
      loadMaplibreApi36Camera: () => ({
        row: { rowId: "maplibre-android-camera", status: "passed" },
        outcomePath: "/prior",
        outcomeSha256: "prior-hash",
      }),
      observeCamera: batch
        ? async () => {
            cameraRows++;
            cameraEngines.push(activeEngine);
            return { engine: activeEngine, passed: true };
          }
        : observeCamera,
      AbortSignal,
      join,
      resolve: (value) => value,
      process: {
        env: {
          ...(mapboxUnit && {
            TF07_ANDROID_SIGNAL_OUTPUT: "/inherited-must-not-run",
          }),
          MAPBOX_ACCESS_TOKEN:
            failAt === "missing-token"
              ? ""
              : failAt === "whitespace-token"
                ? "   "
                : engine === "mapbox" || mapboxUnit
                  ? "redacted-test-token"
                  : "",
        },
        execPath: "/node",
        stderr: { write: (text) => stderrPrinted.push(text) },
        argv: [],
        kill: (pid, signal) => signals.push([pid, signal]),
      },
      Date: { now: () => (clock += 1000) },
      setTimeout: (done) => done(),
      mkdirSync: () => {
        if (failAt === "existing-output") fail("EEXIST");
      },
      existsSync: (file) =>
        file.endsWith("scene.json")
          ? launched
          : (api36Resume || (api36Unit && engine === "maplibre")) &&
              file.endsWith("android-api36-image")
            ? failAt !== "image-capacity"
            : failAt === "avd",
      statfsSync: () => ({
        bavail:
          failAt === "low-space"
            ? mapboxUnit
              ? 11 * 1024 ** 3
              : 1
            : failAt === "image-capacity"
              ? 15 * 1024 ** 3
              : api36Unit
                ? 20 * 1024 ** 3
                : 16 * 1024 ** 3,
        bsize: 1,
      }),
      createHash: () => {
        let content;
        return {
          update(value) {
            content = value;
            return this;
          },
          digest: () => content,
        };
      },
      readFileSync: (file) => {
        if (
          /android-(rendering|camera)-preparation.json$/.test(file) ||
          file.endsWith("platform-batches-preparation.json") ||
          file.endsWith("android-kernel-console-preparation.json") ||
          file.endsWith("signal-liveness-preparation.json") ||
          file.endsWith("mapbox-android-unit-preparation.json") ||
          file.endsWith("mapbox-android-api36-preparation.json") ||
          file.endsWith("maplibre-android-api36-preparation.json") ||
          file.endsWith("maplibre-android-api36-resume-preparation.json") ||
          file.endsWith("maplibre-android-api36-retained-preparation.json") ||
          file.endsWith("mapbox-android-api36-retained-preparation.json") ||
          file.endsWith("mapbox-android-api36-console-resume-preparation.json")
        )
          return JSON.stringify({
            stagedSha256: { "/observer": "observer" },
            hostInputSha256: { "/helper": "helper" },
            operatorHelperSha256: { "/operator": "operator" },
            freeze: { path: "/freeze", sha256: "freeze-hash" },
            executionRows:
              failAt === "core-proof-scope"
                ? [`${engine}-android-core`]
                : [`${engine}-android-retained`],
          });
        if (
          file.endsWith("android-platform-batch-attempt-27/receipt.json") ||
          file.endsWith("android-platform-batch-attempt-31/receipt.json")
        )
          return JSON.stringify({
            result: "failed",
            apkSha256: apkHash,
            environment: "api36-google-apis-revision7-arm64-4k",
            frozenFiles: 695,
            rows: [
              {
                rowId:
                  failAt === "core-proof-row"
                    ? `${engine}-android-retained`
                    : `${engine}-android-core`,
                status: "passed",
                scene: {
                  status: "passed",
                  runId: "654a874e-519e-46c0-91f1-1055acaa877b",
                  observed: failAt !== "core-proof-observed",
                  manualComplete: failAt !== "core-proof-manual",
                  remaining:
                    failAt === "core-proof-remaining" ? ["unverified"] : [],
                  installedBinarySha256:
                    failAt === "core-proof-identity" ? "wrong" : apkHash,
                  libraryDistSha256: distHash,
                  environment: `${engine}-android`,
                },
              },
            ],
            identityReads: [
              `${engine}-android-core-before`,
              `${engine}-android-core-after`,
            ].map((phase) => ({
              phase,
              sha256:
                failAt === "core-proof-after" && phase.endsWith("after")
                  ? "wrong"
                  : apkHash,
            })),
          });
        if (file.endsWith("android-mapbox-api36-attempt-24.json"))
          return JSON.stringify({
            result: "stopped-at-popup-attachment-observation",
            candidateSha256:
              "33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276",
            inputApkSha256: apkHash,
            completedRows: [
              { rowId: "mapbox-android-camera", status: "passed" },
            ],
          });
        if (file.endsWith("android-platform-batch-attempt-01.json"))
          return JSON.stringify({
            result: "stopped-at-first-ui-failure",
            candidateSha256:
              "33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276",
            distSha256: distHash,
            completedRows: [
              {
                rowId:
                  failAt === "prior-prefix" ? "wrong" : "mapbox-android-camera",
                status: "passed",
              },
            ],
          });
        if (file === "/freeze")
          return JSON.stringify({
            files: Object.fromEntries(
              Array.from({ length: 695 }, (_, i) => [`/f${i}`, `f${i}`])
            ),
          });
        if (file.endsWith("app-debug.apk"))
          return failAt === "apk"
            ? "wrong"
            : apkHashes[file.includes("native-maplibre") ? "maplibre" : engine];
        if (file.endsWith("-result.json"))
          return JSON.stringify({
            artifact: { distSha256: distHash },
            results: {
              [`${activeEngine}-android`]: {
                status: "passed",
                installedBinarySha256: apkHashes[activeEngine],
                libraryDistSha256: distHash,
                ...(mapboxUnit &&
                  file.includes("retained") && { density: 2.625 }),
              },
            },
          });
        if (
          file === "/observer" &&
          failAt === "late-metro-exit" &&
          postIdentity
        )
          children[0].emit("exit", 1, null);
        if (file === "/observer")
          return failAt === "observer" ||
            (failAt === "observer-after" && postIdentity)
            ? "changed"
            : "observer";
        if (file === "/helper") return "helper";
        if (file.endsWith("scene.json"))
          return failAt === "malformed" ? "{" : JSON.stringify(scene);
        return file.slice(1);
      },
      writeFileSync: (file, value) => {
        if (file.endsWith("checkpoint.json"))
          latestCheckpoint = JSON.parse(value);
        if (file.endsWith("-driver-stderr.log")) {
          stderrWrites.push([file, value]);
          if (failAt === "driver-stderr") fail("diagnostic write failed");
        }
        if (
          file.endsWith("checkpoint.json") &&
          failAt === "checkpoint-before-create"
        )
          fail("ENOSPC before create helper");
        if (
          file.endsWith("checkpoint.json") &&
          cleanupStarted &&
          failAt === "driver-record-cleanup"
        )
          fail("ENOSPC checkpoint write");
        if (file.endsWith("receipt.json")) receipt = JSON.parse(value);
      },
      rmSync: (file) => removed.push(file),
      createRequire: () => () => ({}),
      promisify: () => (file, args) => {
        const result = execute(file, args).then((stdout) => ({ stdout }));
        const stdin = new EventEmitter();
        stdin.end = (input) => {
          preferences = input;
          if (failAt === "stdin-epipe")
            queueMicrotask(() =>
              stdin.emit(
                "error",
                Object.assign(new Error("EPIPE"), { code: "EPIPE" })
              )
            );
        };
        result.child = { stdin };
        return result;
      },
      execFile: () => {},
      spawn: (file, args, options) => {
        const child = new EventEmitter();
        Object.assign(child, {
          stderr: new EventEmitter(),
          pid: 600 + children.length,
          exitCode: null,
          signalCode: null,
        });
        children.push(child);
        if (args.some((arg) => arg.endsWith("tf07-ui-smoke.mjs"))) {
          coreRows++;
          assert.equal(options.env.TF07_REUSE_API36_ATTEMPT24 === "1", false);
          assert.equal(
            options.env.TF07_REUSE_MAPLIBRE_API36_ATTEMPT30 === "1",
            maplibreResume && coreRows === 1
          );
          if (api36Unit)
            assert.equal(
              phaseMessages.at(-1),
              `API36 ${api36Resume || coreRows === 2 ? "retained" : "core"} operator phase starting`
            );
          launched = true;
          child.exitCode =
            ["driver", "driver-stderr"].includes(failAt) ||
            (failAt === "retained-driver" && coreRows === (api36Resume ? 1 : 2))
              ? 1
              : 0;
          const prior = priorDriver;
          priorDriver = child;
          queueMicrotask(() => {
            if (prior) prior.stderr.emit("data", "late previous driver\n");
            child.stderr.emit("data", "x".repeat(140 * 1024) + "\n");
            child.stderr.emit("data", "token=redacted-");
            child.stderr.emit(
              "data",
              "test-token\nhttps://example.invalid/?access_"
            );
            child.stderr.emit("data", "token=split-private-");
            child.stderr.emit("data", "value\nflush=redacted-");
            child.stderr.emit("data", "test-token");
            child.stderr.emit("end");
          });
          assert.equal(
            options.env.TF07_HARNESS_ROOT,
            "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/native-harness"
          );
          assert.equal(options.env.TF07_BORROWED_METRO_REVERSE, "1");
          if (signalDiagnostic) {
            assert.equal(options.env.TF07_ANDROID_SIGNAL_OUTPUT, "/attempt");
            assert.equal(options.env.TF07_NATIVE_TIMEOUT_MS, "900000");
          }
          if (mapboxUnit) {
            assert.equal(options.env.TF07_ANDROID_SIGNAL_OUTPUT, "");
            assert.equal(
              args.includes("retained"),
              api36Resume || coreRows === 2
            );
            assert.equal(options.env.TF07_NATIVE_TIMEOUT_MS, "1800000");
          }
        } else if (batch || children.length === 1) {
          assert.equal(options.env.ONE_MAP_SMOKE, camera ? "tf04" : "tf09");
          assert(args.includes("--reset-cache"));
        } else {
          assert.deepEqual(Array.from(args.slice(-2)), ["android", engine]);
          assert.equal(options.env.TF09_NATIVE_IDENTITY, apkHash);
          assert(
            options.env.TF09_PEER_EVIDENCE.endsWith(
              `${engine}-android-rendering-preparation.json`
            )
          );
        }
        queueMicrotask(() => {
          if (failAt === "spawn")
            child.emit("error", new Error("spawn failed"));
          if (failAt === "metro-zero" && children.length === 1)
            child.emit("exit", 0, null);
        });
        return child;
      },
      fetch: async (url) => {
        if (failAt === "readiness")
          throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
        if (url.includes("8798")) {
          children[1].exitCode = [
            "driver",
            "driver-cleanup",
            "driver-record-cleanup",
          ].includes(failAt)
            ? 1
            : 0;
          return { ok: true };
        }
        return { text: async () => "packager-status:running" };
      },
      stopOwnedProcess: async (child) => {
        stopped.push(child.pid);
        child.emit("exit", null, "SIGTERM");
      },
      queueMicrotask,
    };
    // Freeze hashing is separate from file reading in the real runner.
    context.createHash = () => {
      let content;
      return {
        update(value) {
          content = value;
          return this;
        },
        digest: () =>
          String(content).startsWith('{"result":"failed","apkSha256"')
            ? failAt === "core-proof-hash"
              ? "wrong"
              : maplibreRetained
                ? "500b1914deb2152bdfbf3ed52fa9490bb10ea80f4354ffc6ece18f956240a190"
                : "43d2dd7e7f3de701d96e99f12cca9b45824c02e58c1af6590acffe07659b51db"
            : String(content).startsWith(
                  '{"result":"stopped-at-popup-attachment-observation"'
                )
              ? "ed5eb01cdfe604650117ebeac924add146ae5c6e1bc092964f34b74f88e9065c"
              : String(content).startsWith(
                    '{"result":"stopped-at-first-ui-failure"'
                  )
                ? failAt === "prior-hash"
                  ? "wrong"
                  : "38fb7d4b86c6ee4a76bb1551eaa53644325a2949ffbba669218663f641a3e00f"
                : String(content).startsWith('{"files"')
                  ? "freeze-hash"
                  : content,
      };
    };
    await runInNewContext(
      `${source}\nrun("/attempt", "${engine}", "${maplibreRetained ? "maplibre-acceptance-api36-retained-resume" : maplibreResume ? "maplibre-acceptance-api36-resume" : engine === "maplibre" && api36Unit ? "maplibre-acceptance-api36" : api36Resume ? "mapbox-acceptance-api36-resume" : api36Unit ? "mapbox-acceptance-api36" : mapboxUnit ? "mapbox-acceptance" : signalDiagnostic ? "signal-diagnostic" : continuation ? "acceptance-continuation" : batch ? "acceptance" : camera ? "camera" : "rendering"}")`,
      context
    ).catch((error) => {
      assert.equal(failAt, "existing-output");
      assert.match(String(error), /EEXIST/);
    });
    if (failAt === "existing-output") {
      assert.equal(receipt, undefined);
      assert.equal(commands.length, 0);
      continue;
    }
    assert.equal(
      receipt.result,
      failAt === null ? "passed" : "failed",
      `${failAt ?? "success"}: ${receipt.error}`
    );
    if (failAt?.startsWith("core-proof-")) {
      assert.equal(
        commands.length,
        0,
        "Invalid core provenance acquired Android resources."
      );
      assert.equal(children.length, 0);
      continue;
    }
    if (api36Resume && failAt === null) {
      assert.deepEqual(receipt.scope, [`${engine}-android-retained`]);
      assert.deepEqual(
        receipt.reusedRows.map(({ rowId }) => rowId),
        [`${engine}-android-camera`, `${engine}-android-core`]
      );
      assert.equal(coreRows, 1, "Exactly one retained driver, no core driver.");
    }
    if (
      [
        "partial",
        "wrong-platform",
        "wrong-engine",
        "wrong-artifact",
        "wrong-identity",
        "failed-scene",
        "malformed",
        "driver",
        "driver-cleanup",
        "app-launch",
      ].includes(failAt)
    )
      if (!batch) assert.equal(identityChecks, 1, failAt);
    if (!batch)
      assert.deepEqual(stopped, children.map((child) => child.pid).reverse());
    if (["emulator-exit", "release-port"].includes(failAt))
      assert(!removed.some((file) => file.endsWith(avdName + ".avd")));
    if (
      [
        "missing-token",
        "whitespace-token",
        "low-space",
        "apk",
        "observer",
        "prior-hash",
        "prior-prefix",
      ].includes(failAt)
    )
      assert.equal(commands.length, 0);
    const removedReverses = commands
      .filter((args) => args.includes("--remove"))
      .map((args) => args.at(-1));
    if (failAt === "reverse") assert.deepEqual(removedReverses, ["tcp:8081"]);
    if (failAt === "reverse-conflict")
      assert.deepEqual(removedReverses, ["tcp:8081"]);
    if (failAt === "checkpoint-before-create") {
      assert(
        !commands.some((args) =>
          args.some((arg) =>
            String(arg).includes("create-lifetime-task-avd.py")
          )
        )
      );
      assert(!removed.some((file) => file.includes(avdName)));
      assert(
        !receipt.cleanup.some(
          (entry) => entry.name === "owned private AVD removal"
        )
      );
    }
    if (
      [
        "launch-emulator",
        "invalid-emulator-identity",
        "malformed-emulator-identity",
      ].includes(failAt)
    ) {
      assert(
        receipt.cleanup.some(
          (entry) =>
            entry.name === "uncertain emulator ownership" && entry.error
        )
      );
      assert(!removed.some((file) => file.includes(avdName)));
      assert.deepEqual(signals, []);
    }
    if (failAt === "create")
      assert(removed.some((file) => file.endsWith(avdName + ".avd")));
    if (failAt === "driver-record-cleanup") {
      assert.match(receipt.error, /1 !== 0/);
      assert(receipt.recordErrors.every((error) => error.includes("ENOSPC")));
      assert(
        receipt.cleanup.some(
          (entry) => entry.name === "owned private AVD removal"
        )
      );
    }
    if (["emulator-adb-failure", "emulator-kill-fallback"].includes(failAt)) {
      assert(
        receipt.cleanup.some(
          (entry) => entry.name === "owned emulator group fallback"
        )
      );
      assert.deepEqual(signals, [
        [-501, "SIGTERM"],
        ...(failAt === "emulator-kill-fallback" ? [[-501, "SIGKILL"]] : []),
      ]);
    } else assert.deepEqual(signals, []);
    if (failAt === "stdin-epipe") assert.match(receipt.error, /EPIPE/);
    if (failAt === "driver-cleanup") {
      assert.match(receipt.error, /1 !== 0/);
      assert(
        receipt.cleanup.some((entry) => entry.error?.includes("cleanup failed"))
      );
    }
    if (["spawn", "metro-zero", "driver-cleanup"].includes(failAt))
      assert(
        removed.some((file) => file.endsWith(avdName + ".avd")),
        failAt
      );
    if (batch) {
      if (api36Unit) {
        assert(
          !commands.some((call) =>
            call.includes("android.permission.ACCESS_LOCAL_NETWORK")
          )
        );
        assert(!removed.some((file) => file.includes("OneMapU25F05")));
        if (["image-stage", "device"].includes(failAt)) {
          assert.equal(installs, 0);
          assert.equal(children.length, 0);
          if (failAt === "device") assert(!created);
          assert(!removed.some((file) => file.includes(avdName)));
        }
      } else if (failAt === null) {
        assert(
          commands.some((call) =>
            call.includes("android.permission.ACCESS_LOCAL_NETWORK")
          )
        );
      }
      assert.equal(
        installs,
        failAt === null && !signalDiagnostic && !mapboxUnit
          ? 2
          : [
                "observer",
                "prior-hash",
                "prior-prefix",
                "low-space",
                "device",
                "image-capacity",
                "image-stage",
                "wrong-api",
                "wrong-abi",
                "pages-16k",
                "gles2",
              ].includes(failAt)
            ? 0
            : 1
      );
      if (failAt === "driver-stderr") {
        assert.match(receipt.error, /driver failed/);
        assert(
          receipt.diagnosticErrors.some((error) =>
            error.includes("diagnostic write failed")
          )
        );
      }
      if (failAt === null) {
        assert(stderrWrites.every(([, value]) => value.length <= 128 * 1024));
        const capture =
          stderrWrites.map(([, value]) => value).join("\n") +
          stderrPrinted.join("");
        assert(
          !capture.includes("redacted-test-token"),
          "Known token split across chunks leaked."
        );
        assert(
          !capture.includes("split-private-value"),
          "Query token split across chunks leaked."
        );
        assert(
          capture.includes("flush=<REDACTED>"),
          "Flush final complete token on stream end."
        );
        const late = stderrWrites.find(([, value]) =>
          value.includes("late previous driver")
        );
        if (!signalDiagnostic && !api36Resume)
          assert(
            late[0].endsWith(`${engine}-android-core-driver-stderr.log`),
            late[0]
          );
        assert.equal(
          receipt.rows.length,
          api36Resume
            ? 1
            : api36Unit && !api36Resume && !maplibreResume
              ? 3
              : mapboxUnit
                ? 2
                : signalDiagnostic
                  ? 1
                  : continuation
                    ? 5
                    : 6
        );
        assert.equal(
          cameraRows,
          api36Unit && !api36Resume && !maplibreResume
            ? 1
            : signalDiagnostic || mapboxUnit
              ? 0
              : continuation
                ? 1
                : 2
        );
        assert.deepEqual(
          cameraEngines,
          api36Unit && !api36Resume && !maplibreResume
            ? [engine]
            : signalDiagnostic || mapboxUnit
              ? []
              : continuation
                ? ["maplibre"]
                : ["mapbox", "maplibre"]
        );
        assert.deepEqual(
          receipt.rows.map(({ rowId }) => rowId),
          api36Resume
            ? [`${engine}-android-retained`]
            : api36Unit && !api36Resume && !maplibreResume
              ? [
                  `${engine}-android-camera`,
                  `${engine}-android-core`,
                  `${engine}-android-retained`,
                ]
              : mapboxUnit
                ? [`${engine}-android-core`, `${engine}-android-retained`]
                : signalDiagnostic
                  ? ["mapbox-android-core"]
                  : [
                      ...(!continuation ? ["mapbox-android-camera"] : []),
                      "mapbox-android-core",
                      "mapbox-android-retained",
                      "maplibre-android-camera",
                      "maplibre-android-core",
                      "maplibre-android-retained",
                    ]
        );
        if ((continuation || mapboxUnit) && !api36Unit)
          assert.equal(receipt.reusedRows[0].rowId, "mapbox-android-camera");
        if ((continuation || mapboxUnit) && !api36Unit)
          assert.equal(receipt.rows[0].rowId, "mapbox-android-core");
        assert.equal(
          coreRows,
          api36Resume ? 1 : mapboxUnit ? 2 : signalDiagnostic ? 1 : 4
        );
        if (mapboxUnit) {
          assert.equal(receipt.mode, `${engine}-android-unit`);
          assert.equal(receipt.rows.at(-1).scene.density, 2.625);
          assert(
            !commands.some((call) =>
              call.some((arg) =>
                new RegExp(
                  `gradlew|native-${engine === "mapbox" ? "maplibre" : "mapbox"}|signal-calibration`
                ).test(String(arg))
              )
            )
          );
        }
        if (signalDiagnostic) assert.equal(installs, 1);
        assert.equal(
          commands.filter((args) =>
            args.some((arg) =>
              String(arg).includes(
                api36Unit
                  ? "setup-android-api36.py"
                  : "create-lifetime-task-avd.py"
              )
            )
          ).length,
          1
        );
        assert.equal(
          identityChecks,
          api36Resume
            ? 3
            : api36Unit && !api36Resume && !maplibreResume
              ? 7
              : mapboxUnit
                ? 5
                : signalDiagnostic
                  ? 3
                  : continuation
                    ? 12
                    : 14
        );
      }
      if (failAt === "late-metro-exit") {
        assert.equal(receipt.rows.length, 0);
        assert.equal(coreRows, 0);
      }
      if (["driver", "driver-stderr"].includes(failAt)) {
        assert.equal(
          receipt.rows.length,
          api36Unit && !api36Resume && !maplibreResume
            ? 1
            : signalDiagnostic || continuation || mapboxUnit
              ? 0
              : 1
        );
        assert.equal(coreRows, 1);
      }
      if (failAt === "retained-driver") {
        assert.deepEqual(
          receipt.rows.map(({ rowId }) => rowId),
          api36Resume
            ? []
            : api36Unit && !api36Resume && !maplibreResume
              ? [`${engine}-android-camera`, `${engine}-android-core`]
              : [`${engine}-android-core`]
        );
        assert.equal(coreRows, api36Resume ? 1 : 2);
        assert.match(receipt.error, /driver failed/);
        assert.equal(installs, 1);
      }
      assert(
        removed.some((file) => file.endsWith(avdName + ".avd")) ||
          [
            "observer",
            "prior-hash",
            "prior-prefix",
            "low-space",
            "device",
            "image-capacity",
            "image-stage",
          ].includes(failAt)
      );
      continue;
    }
    if (failAt === null) {
      assert.equal(identityChecks, 2);
      if (camera) {
        assert.equal(children.length, 1);
        assert.equal(commands.filter((args) => args.includes("tap")).length, 1);
        assert(
          !commands.some((args) =>
            args.some((arg) => String(arg).includes("8798"))
          )
        );
      }
      const cleanupNames = receipt.cleanup.map((entry) => entry.name);
      assert(
        cleanupNames.indexOf(
          camera ? "released port 8081" : "released port 8798"
        ) < cleanupNames.indexOf("owned private AVD removal")
      );
      assert(
        cleanupNames.indexOf("owned emulator process exit") <
          cleanupNames.indexOf("owned private AVD removal")
      );
    }
    assert(!JSON.stringify(receipt).includes("redacted-test-token"));
  }
}
for (const [engine, camera] of [
  ["mapbox", false],
  ["maplibre", false],
  ["mapbox", true],
]) {
  const entrypoint = readFileSync(
    new URL(
      `./${engine}-android-${camera ? "camera" : "rendering"}.mjs`,
      import.meta.url
    ),
    "utf8"
  )
    .replace(/^import[\s\S]*?from "[^\n]+";\n/gm, "")
    .replaceAll("export const", "const")
    .replace(/if \(\s*process.argv\[1\][\s\S]*$/, "");
  runInNewContext(`${entrypoint}\nrun("/entrypoint");`, {
    runAndroid: (output, selected, scene) => {
      assert.equal(output, "/entrypoint");
      assert.equal(selected, engine);
      assert.equal(scene, camera ? "camera" : undefined);
    },
  });
}
for (const unit of ["mapbox-acceptance", "mapbox-acceptance-api36"])
  await assert.rejects(
    runInNewContext(`${source}\nrun('/attempt', 'maplibre', '${unit}')`, {
      assert,
      join,
      mkdirSync: () => {
        throw Error("Wrong backend acquired resources.");
      },
    }),
    /targets Mapbox only/
  );
await assert.rejects(
  runInNewContext(
    `${source}\nrun('/attempt', 'mapbox', 'maplibre-acceptance-api36')`,
    {
      assert,
      join,
      mkdirSync: () => {
        throw Error("Wrong backend acquired resources.");
      },
    }
  ),
  /targets MapLibre only/
);
const maplibreApi36Entrypoint = readFileSync(
  new URL("./maplibre-android-api36-acceptance.mjs", import.meta.url),
  "utf8"
)
  .replace(/^import[^\n]+;\n/m, "")
  .replace("await run", "run");
await runInNewContext(maplibreApi36Entrypoint, {
  process: { argv: ["node", "entrypoint", "/entrypoint"] },
  run: (output, engine, scene) => {
    assert.equal(output, "/entrypoint");
    assert.equal(engine, "maplibre");
    assert.equal(scene, "maplibre-acceptance-api36");
  },
});
console.log(
  "Both Android rendering branches and camera orchestration/entrypoint mocks passed."
);
