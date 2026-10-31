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

for (const [engine, camera, batch = false] of [
  ["mapbox", false],
  ["maplibre", false],
  ["mapbox", true],
  ["mapbox", true, true],
]) {
  const apkHash = apkHashes[engine];
  const expectedNames =
    engine === "mapbox" ? names : [names[0], names[3], names[5]];
  // Run the actual launcher with fake host boundaries; no Android tool is invoked.
  for (const failAt of [
    null,
    ...(engine === "mapbox" ? ["missing-token", "whitespace-token"] : []),
    "existing-output",
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
          "late-metro-exit",
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
    )) {
    const commands = [];
    const stopped = [];
    const removed = [];
    const children = [];
    let receipt;
    let clock = 0;
    let launched = false;
    let postIdentity = false;
    let created = false;
    let preferences;
    let cleanupStarted = false;
    const signals = [];
    let pulls = 0;
    let statusReads = 0;
    let activeEngine = engine;
    let coreRows = 0;
    let installs = 0;
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
        if (command[1].includes("create-lifetime")) {
          created = true;
          if (failAt === "create") fail("create failed");
          return "";
        }
        if (command[1].includes("launch-lifetime")) {
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
      if (adb[0] === "pull") {
        pulls++;
        postIdentity = pulls >= 2;
        return "pulled";
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
        return failAt === "api" ? "invalid" : "37";
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
      assert,
      observeCamera: batch
        ? async () => ({ engine: activeEngine, passed: true })
        : observeCamera,
      AbortSignal,
      join,
      resolve: (value) => value,
      process: {
        env: {
          MAPBOX_ACCESS_TOKEN:
            failAt === "missing-token"
              ? ""
              : failAt === "whitespace-token"
                ? "   "
                : engine === "mapbox"
                  ? "redacted-test-token"
                  : "",
        },
        execPath: "/node",
        argv: [],
        kill: (pid, signal) => signals.push([pid, signal]),
      },
      Date: { now: () => (clock += 1000) },
      setTimeout: (done) => done(),
      mkdirSync: () => {
        if (failAt === "existing-output") fail("EEXIST");
      },
      existsSync: (file) =>
        file.endsWith("scene.json") ? launched : failAt === "avd",
      statfsSync: () => ({
        bavail: failAt === "low-space" ? 1 : 10 * 1024 ** 3,
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
          file.endsWith("platform-batches-preparation.json")
        )
          return JSON.stringify({
            stagedSha256: { "/observer": "observer" },
            hostInputSha256: { "/helper": "helper" },
            freeze: { path: "/freeze", sha256: "freeze-hash" },
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
        if (file.includes("installed-") && !file.includes("after"))
          return failAt === "identity-before"
            ? "wrong"
            : apkHashes[activeEngine];
        if (file.includes("installed-") && file.includes("after"))
          return failAt === "identity-after"
            ? "wrong"
            : apkHashes[activeEngine];
        if (file.endsWith("-result.json"))
          return JSON.stringify({
            artifact: { distSha256: distHash },
            results: {
              [`${activeEngine}-android`]: {
                status: "passed",
                installedBinarySha256: apkHashes[activeEngine],
                libraryDistSha256: distHash,
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
          pid: 600 + children.length,
          exitCode: null,
          signalCode: null,
        });
        children.push(child);
        if (args.some((arg) => arg.endsWith("tf07-ui-smoke.mjs"))) {
          coreRows++;
          child.exitCode = failAt === "driver" ? 1 : 0;
          assert.equal(
            options.env.TF07_HARNESS_ROOT,
            "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/native-harness"
          );
          assert.equal(options.env.TF07_BORROWED_METRO_REVERSE, "1");
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
          String(content).startsWith('{"files"') ? "freeze-hash" : content,
      };
    };
    await runInNewContext(
      `${source}\nrun("/attempt", "${engine}", "${batch ? "acceptance" : camera ? "camera" : "rendering"}")`,
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
      if (!batch) assert.equal(pulls, 1, failAt);
    if (!batch)
      assert.deepEqual(stopped, children.map((child) => child.pid).reverse());
    if (["emulator-exit", "release-port"].includes(failAt))
      assert(!removed.some((file) => file.endsWith("OneMapU25F05.avd")));
    if (
      [
        "missing-token",
        "whitespace-token",
        "low-space",
        "apk",
        "observer",
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
      assert(!removed.some((file) => file.includes("OneMapU25F05")));
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
      assert(!removed.some((file) => file.includes("OneMapU25F05")));
      assert.deepEqual(signals, []);
    }
    if (failAt === "create")
      assert(removed.some((file) => file.endsWith("OneMapU25F05.avd")));
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
        removed.some((file) => file.endsWith("OneMapU25F05.avd")),
        failAt
      );
    if (batch) {
      assert.equal(
        installs,
        failAt === null ? 2 : failAt === "observer" ? 0 : 1
      );
      if (failAt === null) {
        assert.equal(receipt.rows.length, 6);
        assert.equal(coreRows, 4);
        assert.equal(
          commands.filter((args) =>
            args.some((arg) =>
              String(arg).includes("create-lifetime-task-avd.py")
            )
          ).length,
          1
        );
        assert.equal(pulls, 14);
      }
      if (failAt === "late-metro-exit") {
        assert.equal(receipt.rows.length, 0);
        assert.equal(coreRows, 0);
      }
      if (failAt === "driver") {
        assert.equal(receipt.rows.length, 1);
        assert.equal(coreRows, 1);
      }
      assert(
        removed.some((file) => file.endsWith("OneMapU25F05.avd")) ||
          failAt === "observer"
      );
      continue;
    }
    if (failAt === null) {
      assert.equal(pulls, 2);
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
console.log(
  "Both Android rendering branches and camera orchestration/entrypoint mocks passed."
);
