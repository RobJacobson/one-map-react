import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { stopOwnedProcess } from "./native-smoke-process.mjs";

const recovery = "/Users/rob/code/mapbox-code/one-map-f05-android-recovery";
const harness = join(recovery, "native-harness");
const udid = "8B7D7CE4-228E-409F-A156-A597D4E448A5";
const targets = {
  maplibre: {
    executable: "OneMapMaplibre",
    container: "2F6151E0-5FF8-48BA-A4C5-1EB7117C3011",
    codes: {
      OneMapMaplibre:
        "d80f726009e71ff5d3c27d4eee23020d7eddb33b0b5a526b31177cb278d67ff3",
      "OneMapMaplibre.debug.dylib":
        "70e338d2f3101368f657d885319b904fb195639b8c232532c14e6ff6f71457ff",
    },
    frameworks: { MapLibre: "6.31.0" },
  },
  mapbox: {
    executable: "OneMapMapbox",
    container: "4030A7F3-7E06-4170-96F5-ADE0A2FED943",
    codes: {
      OneMapMapbox:
        "b967daf157aa88bafb08a545fdbd41c8ab91ba996694e95b6b9383127b4bd231",
      "OneMapMapbox.debug.dylib":
        "340888a46351e6f1bf05c056bc06757c815abfde1c3f44b4b6f799ef3bc30d46",
    },
    frameworks: { MapboxCoreMaps: "11.23.1", MapboxCommon: "24.23.1" },
  },
};
const pngRoot =
  "/Users/rob/code/mapbox-code/one-map/node_modules/.bun/pngjs@7.0.0/node_modules/pngjs";
const root = resolve(import.meta.dirname, "..");
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

/** Rejects either stale app-code member before borrowing an installed app. */
export const verifyCode = (directory, expected = targets.maplibre.codes) => {
  for (const [file, hash] of Object.entries(expected))
    assert.equal(
      sha256(join(directory, file)),
      hash,
      `App code changed: ${file}`
    );
};

/** Borrows only free assigned ports; unknown listeners are never stopped. */
const requireFreePort = async (port) => {
  try {
    await promisify(execFile)(
      "/usr/sbin/lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
      { timeout: 10000 }
    );
  } catch (error) {
    if (error.code === 1 && error.stdout === "" && error.stderr === "") return;
    throw error;
  }
  throw new Error(`Assigned port ${port} already has a listener.`);
};

/** Runs the reviewed no-build scene once and releases only resources it owns. */
export const run = async (output, engine = "maplibre") => {
  assert(Object.hasOwn(targets, engine), "Choose mapbox or maplibre.");
  const { executable, container, codes, frameworks } = targets[engine];
  const shell = join(harness, `examples/native-${engine}`);
  const bundle = `org.reactjs.native.example.${executable}`;
  const installed = `/Users/rob/Library/Developer/CoreSimulator/Devices/${udid}/data/Containers/Bundle/Application/${container}/${executable}.app`;
  const produced = join(
    shell,
    `ios/build/Build/Products/Debug-iphonesimulator/${executable}.app`
  );
  assert(output, "Provide a fresh absolute output directory.");
  assert.equal(resolve(output), output);
  mkdirSync(output); // Exclusive directory prevents overwriting another attempt.
  const receipt = { result: "failed", udid, bundle, codes, cleanup: [] };
  const children = [];
  let booted = false;
  let launched = false;
  let failure;
  const execute = async (file, args, timeout = 30000) =>
    (
      await promisify(execFile)(file, args, {
        timeout,
        env: {
          ...process.env,
          DEVELOPER_DIR: "/Applications/Xcode.app/Contents/Developer",
        },
        maxBuffer: 1024 * 1024,
      })
    ).stdout;
  const simctl = (args, timeout) =>
    execute("xcrun", ["simctl", ...args], timeout);
  const terminateApp = () =>
    simctl(["terminate", udid, bundle]).catch((error) => {
      assert.match(
        String(error.stderr),
        /found nothing|not (?:currently )?running|no such process/i
      );
    });
  const start = (file, args, cwd, env = {}) => {
    const child = spawn(file, args, {
      cwd,
      detached: true,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${join(recovery, "runtime-bin")}:${process.env.PATH}`,
        ...env,
      },
    });
    child.on("error", (error) => {
      failure ??= error;
    });
    child.on("exit", (code, signal) => {
      if (code !== 0 || signal)
        failure ??= new Error(`${file} exited: ${code}/${signal}`);
    });
    children.push(child);
    return child;
  };
  const until = async (observe, timeout = 60000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      try {
        const ready = await observe();
        if (failure) throw failure;
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
  const identity = async () => {
    assert.equal(
      (await simctl(["get_app_container", udid, bundle, "app"])).trim(),
      installed
    );
    for (const directory of [produced, installed]) {
      verifyCode(directory, codes);
      const metadata = JSON.parse(
        await execute("plutil", [
          "-convert",
          "json",
          "-o",
          "-",
          join(directory, "Info.plist"),
        ])
      );
      for (const [key, value] of Object.entries({
        CFBundlePackageType: "APPL",
        CFBundleIdentifier: bundle,
        CFBundleExecutable: executable,
        CFBundleShortVersionString: "1.0",
        CFBundleVersion: "1",
      }))
        assert.equal(metadata[key], value, `Wrong app metadata: ${key}`);
      const frameworkMetadata = {};
      for (const [framework, version] of Object.entries(frameworks)) {
        const info = JSON.parse(
          await execute("plutil", [
            "-convert",
            "json",
            "-o",
            "-",
            join(directory, `Frameworks/${framework}.framework/Info.plist`),
          ])
        );
        assert.equal(
          info.CFBundleShortVersionString,
          version,
          `Wrong SDK metadata: ${framework}`
        );
        frameworkMetadata[framework] = info;
      }
      (receipt.identityReads ??= []).push({
        directory,
        codeSha256: Object.fromEntries(
          Object.keys(codes).map((file) => [
            file,
            sha256(join(directory, file)),
          ])
        ),
        metadata,
        frameworkMetadata,
      });
    }
    if (engine === "mapbox") {
      const lockSha256 =
        "8fbf35cf242d154c372cb816f4e6c3f309072799ac95c40e2ef128dbdb073874";
      for (const file of ["Podfile.lock", "Pods/Manifest.lock"])
        assert.equal(
          sha256(join(shell, "ios", file)),
          lockSha256,
          `Mapbox SDK lock changed: ${file}`
        );
      receipt.podLockSha256 = lockSha256;
      return;
    }
    const pin = JSON.parse(
      readFileSync(
        join(
          shell,
          "ios/OneMapMaplibre.xcworkspace/xcshareddata/swiftpm/Package.resolved"
        )
      )
    ).pins.find(
      (value) => value.identity === "maplibre-gl-native-distribution"
    );
    receipt.swiftPM = pin;
    assert.equal(pin.state.version, "6.31.0");
    assert.equal(
      pin.state.revision,
      "13e41ab3d77ff5113e7e5d4ee87803b1f81f5683"
    );
  };
  try {
    const peerEvidence = join(
      root,
      `records/evidence/revised-api-u25-f05-${engine}-ios-rendering-preparation.json`
    );
    if (engine === "mapbox") {
      receipt.tokenPresent = Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
      assert(receipt.tokenPresent, "Mapbox access token is required.");
    }
    const preparation = JSON.parse(readFileSync(peerEvidence));
    for (const [file, hash] of Object.entries(preparation.stagedSha256))
      assert.equal(sha256(file), hash, `Staged runtime input changed: ${file}`);
    const freeze = JSON.parse(readFileSync(preparation.freeze.path));
    assert.equal(sha256(preparation.freeze.path), preparation.freeze.sha256);
    assert.equal(Object.keys(freeze.files).length, 695);
    receipt.frozenFiles = 695;
    for (const [file, hash] of Object.entries(freeze.files))
      assert.equal(sha256(file), hash, `Frozen input changed: ${file}`);
    verifyCode(produced, codes);
    verifyCode(installed, codes);
    const disk = statfsSync(recovery);
    receipt.freeBytes = disk.bavail * disk.bsize;
    assert(
      disk.bavail * disk.bsize >= 1024 ** 3,
      "No-build runtime requires 1 GiB free reserve; stop without deleting files."
    );
    createRequire(join(pngRoot, "package.json"))("pngjs");
    for (const port of [8081, 8798]) await requireFreePort(port);
    const inventory = JSON.parse(await simctl(["list", "devices", "--json"]));
    const device = Object.values(inventory.devices)
      .flat()
      .find((value) => value.udid === udid);
    assert(device?.isAvailable, "Assigned simulator unavailable.");
    if (device.state === "Shutdown") {
      await simctl(["boot", udid], 20000);
      booted = true;
      await simctl(["bootstatus", udid], 120000);
    } else assert.equal(device.state, "Booted");
    await identity();
    // Existing app must reload the reviewed fixture rather than its cached TF05 bundle.
    await terminateApp();
    const metro = start(
      join(recovery, "runtime-bin/bun"),
      ["run", "start", "--reset-cache", "--port", "8081"],
      shell,
      { ONE_MAP_SMOKE: "tf09" }
    );
    metro.once("exit", (code, signal) => {
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
    const driver = start(
      process.execPath,
      [join(harness, "scripts/tf09-rendering-smoke.mjs"), "ios", engine],
      harness,
      {
        TF09_OUTPUT: join(output, "scene.json"),
        TF09_LIBRARY_SHA256:
          "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5",
        TF09_NATIVE_IDENTITY: JSON.stringify(codes),
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
    launched = true;
    await simctl(["launch", udid, bundle]);
    await until(
      () => driver.exitCode !== null || driver.signalCode !== null,
      600000
    );
    assert.equal(driver.exitCode, 0);
    receipt.scene = JSON.parse(readFileSync(join(output, "scene.json")));
    assert.equal(receipt.scene.platform, "ios");
    assert.equal(receipt.scene.engine, engine);
    assert.equal(
      receipt.scene.artifact,
      "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5"
    );
    assert.equal(receipt.scene.nativeIdentity, JSON.stringify(codes));
    assert.deepEqual(
      receipt.scene.outcomes.map((value) => value.name),
      [
        "known rendered feature and initial no-data",
        ...(engine === "mapbox"
          ? [
              "terrain enabled before delayed DEM attachment",
              "explicit terrain clear and projection change",
            ]
          : []),
        "hillshade draws the fixture's slope patch",
        ...(engine === "mapbox"
          ? ["globe projection has independently different viewport output"]
          : []),
        "rendered output contains the known orange feature",
      ]
    );
    assert(receipt.scene.outcomes.every((value) => value.status === "passed"));
    await identity();
    for (const [file, hash] of Object.entries(freeze.files))
      assert.equal(sha256(file), hash, `Frozen input changed: ${file}`);
    for (const [file, hash] of Object.entries(preparation.stagedSha256))
      assert.equal(sha256(file), hash, `Staged runtime input changed: ${file}`);
    receipt.result = "passed";
  } catch (error) {
    receipt.error = String(error);
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
      } catch (error) {
        receipt.cleanup.push({ name, error: String(error) });
        receipt.result = "failed";
        process.exitCode = 1;
      }
    };
    if (launched)
      await cleanup("assigned app termination", () => terminateApp());
    for (const child of children.reverse())
      await cleanup(`owned process ${child.pid}`, () =>
        stopOwnedProcess(child)
      );
    if (children.length)
      for (const port of [8081, 8798])
        await cleanup(`released port ${port}`, () => requireFreePort(port));
    if (booted)
      await cleanup("owned simulator shutdown", () =>
        simctl(["shutdown", udid])
      );
    writeFileSync(
      join(output, "receipt.json"),
      JSON.stringify(receipt, null, 2),
      { flag: "wx" }
    );
  }
};
