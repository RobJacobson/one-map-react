import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolves either maintained browser shell without using library source aliases.
 * @param {string} root - Prepared workspace root.
 * @param {number} port - Assigned application port.
 * @returns {object} CLI, working directory and browser origin.
 */
export const webShell = (root, port) => {
  const kind = process.env.ONE_MAP_WEB_SHELL ?? "vite";
  assert(
    ["vite", "expo"].includes(kind),
    "Choose vite or expo for ONE_MAP_WEB_SHELL."
  );
  const expo = kind === "expo";
  return {
    command: expo ? "node" : "bun",
    args: expo
      ? [
          "node_modules/expo/bin/cli",
          "start",
          "--web",
          "--localhost",
          "--port",
          String(port),
        ]
      : [
          "run",
          "dev",
          "--",
          "--port",
          String(port),
          "--strictPort",
          "--host",
          "127.0.0.1",
        ],
    cwd: join(root, "apps", expo ? "expo" : "web"),
    base: `http://${expo ? "localhost" : "127.0.0.1"}:${port}`,
  };
};

/**
 * Adds explicit engine selection while preserving each existing scenario's query.
 * @param {string} root - Prepared workspace root.
 * @param {number} port - Assigned application port.
 * @param {string} query - Original acceptance query.
 * @param {string} engine - Explicit Mapbox or MapLibre selection.
 * @returns {string} Browser URL with the preserved query.
 */
export const webScenarioUrl = (root, port, query, engine) => {
  assert(["mapbox", "maplibre"].includes(engine));
  const url = new URL(webShell(root, port).base);
  url.search = query;
  url.searchParams.set("engine", engine);
  return url.href;
};

/**
 * Pins the same Metro scenario and engine in the universal development app.
 * @param {string} engine - Selected native engine.
 * @param {string} scenario - Selected development scenario.
 * @param {object} extra - Assigned fixture transport settings.
 * @returns {object} Child environment with explicit public launch selection.
 */
export const nativeEnvironment = (engine, scenario, extra = {}) => {
  assert(["mapbox", "maplibre"].includes(engine));
  return {
    ...process.env,
    ...extra,
    EXPO_PUBLIC_ONE_MAP_TEST_MODE: "1",
    EXPO_PUBLIC_ONE_MAP_SCENARIO: scenario,
    EXPO_PUBLIC_ONE_MAP_ENGINE: engine,
    NODE_OPTIONS:
      `${process.env.NODE_OPTIONS ?? ""} --dns-result-order=ipv4first`.trim(),
  };
};

/**
 * Uses Expo's pinned CLI; builds/installations belong to the separate native preparation step.
 * @param {number} port - Assigned Metro port.
 * @returns {string[]} Development-client CLI arguments.
 */
export const nativeMetroArgs = (port = 8081) => [
  "node_modules/expo/bin/cli",
  "start",
  "--dev-client",
  "--localhost",
  "--port",
  String(port),
  "--clear",
];

/**
 * Requires a separate test sandbox rather than a developer's normal application.
 * @returns {string} The explicitly assigned acceptance application ID.
 */
export const nativeApplicationId = () => {
  const id = process.env.ONE_MAP_ACCEPTANCE_APP_ID;
  assert(
    id && /^org\.onemap\.acceptance\.[A-Za-z0-9_.]+$/.test(id),
    "Set ONE_MAP_ACCEPTANCE_APP_ID to the isolated test app."
  );
  return id;
};

/**
 * Verifies the installed image, connects fixtures and opens the same Expo development binary.
 * @param {object} options - Assigned platform, iOS simulator, Metro and fixture ports.
 * @returns {object | undefined} Android process identity when applicable.
 */
export const launchNativeWorkspace = ({
  platform,
  iosDevice,
  port = 8081,
  fixturePorts = [8798, 8799],
}) => {
  assert(["android", "ios"].includes(platform), "Choose a native platform.");
  assert(
    Number.isInteger(port) && port > 0 && port < 65536,
    "Invalid Metro port."
  );
  const id = nativeApplicationId();
  const expected = process.env.ONE_MAP_NATIVE_BINARY_SHA256;
  assert(
    /^[a-f0-9]{64}$/.test(expected ?? ""),
    "Set ONE_MAP_NATIVE_BINARY_SHA256 to the reviewed installed APK/debug-image hash."
  );
  const command = (file, args, options = {}) =>
    execFileSync(file, args, { encoding: "utf8", timeout: 30000, ...options });
  const url = `one-map-example://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${port}`)}&disableOnboarding=1&disableAutoLaunch=1`;
  if (platform === "android") {
    const serial = process.env.ANDROID_SERIAL;
    assert(serial, "Set ANDROID_SERIAL to the assigned emulator.");
    const adb = (args, options) =>
      command("adb", ["-s", serial, ...args], options);
    const path = adb(["shell", "pm", "path", id])
      .trim()
      .split("\n")
      .find((line) => line.endsWith("base.apk"));
    assert(path, "Reviewed test APK is not installed.");
    const installedPath = path.match(
      /^package:(\/data\/app\/[A-Za-z0-9_=~.-]+(?:\/[A-Za-z0-9_=~.-]+)*\/base\.apk)$/
    )?.[1];
    assert(
      installedPath &&
        installedPath.split("/").every((part) => part !== "." && part !== ".."),
      "Invalid installed APK path."
    );
    const digest = adb(["shell", "sha256sum", installedPath]).match(
      /^([a-f0-9]{64})  (\/[^\r\n]+)\r?\n?$/
    );
    assert(
      digest && digest[2] === installedPath,
      "Invalid installed APK digest output."
    );
    assert.equal(digest[1], expected, "Installed APK changed.");
    for (const local of [port, ...fixturePorts])
      adb(["reverse", `tcp:${local}`, `tcp:${local}`]);
    adb(["shell", "am", "force-stop", id]);
    const result = adb([
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      `'${url}'`,
      id,
    ]);
    assert(!/Error:|Exception/.test(result), result.slice(0, 2048));
    const started = Date.now();
    const deadline = started + 10000;
    const samples = [];
    const startupError = (message) =>
      new Error(
        `${message}: ${JSON.stringify({ applicationId: id, serial, start: result.slice(0, 2048), samples })}`
      );
    while (Date.now() < deadline) {
      let stdout = "";
      let stderr = "";
      let status = 0;
      let failure;
      try {
        stdout = adb(["shell", "pidof", id], {
          timeout: Math.min(2000, Math.max(1, deadline - Date.now())),
        });
      } catch (error) {
        failure = error;
        stdout = String(error.stdout ?? "");
        stderr = String(error.stderr ?? "");
        status = error.status ?? null;
      }
      samples.push({
        stdout: stdout.slice(0, 512),
        stderr: stderr.slice(0, 512),
        status,
      });
      if (
        failure &&
        (status !== 1 ||
          stdout.trim() ||
          stderr.trim() ||
          failure.signal ||
          failure.code)
      )
        throw startupError(
          `PID query failed: ${String(failure).slice(0, 512)}`
        );
      const pids = stdout.trim() ? stdout.trim().split(/\s+/) : [];
      if (
        !pids.every(
          (pid) =>
            /^[1-9][0-9]*$/.test(pid) && Number.isSafeInteger(Number(pid))
        )
      )
        throw startupError("Invalid launched app PID");
      if (pids.length === 1) {
        const pid = Number(pids[0]);
        console.log(
          `NATIVE_STARTUP_READY ${JSON.stringify({ applicationId: id, serial, pid, attempts: samples.length, elapsedMs: Date.now() - started })}`
        );
        return { pid };
      }
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        Math.min(200, Math.max(0, deadline - Date.now()))
      );
    }
    throw startupError("Launched app PID readiness timed out");
  } else {
    assert(
      iosDevice && iosDevice !== "booted",
      "Assign a dedicated iOS simulator."
    );
    const app = command("xcrun", [
      "simctl",
      "get_app_container",
      iosDevice,
      id,
      "app",
    ]).trim();
    const executable = command("/usr/libexec/PlistBuddy", [
      "-c",
      "Print:CFBundleExecutable",
      join(app, "Info.plist"),
    ]).trim();
    const debug = join(app, `${executable}.debug.dylib`);
    const image = existsSync(debug) ? debug : join(app, executable);
    assert.equal(
      createHash("sha256").update(readFileSync(image)).digest("hex"),
      expected,
      "Installed iOS image changed."
    );
    try {
      command("xcrun", ["simctl", "terminate", iosDevice, id]);
    } catch (error) {
      if (
        !/not running|No such process|found nothing to terminate/.test(
          String(error.stderr)
        )
      )
        throw error;
    }
    command("xcrun", [
      "simctl",
      "launch",
      iosDevice,
      id,
      "-EXDevMenuShowFloatingActionButton",
      "NO",
    ]);
    command("xcrun", ["simctl", "openurl", iosDevice, url]);
  }
};
