import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stopOwnedProcess } from "./native-smoke-process.mjs";
import { startLifetimesFixture } from "./tf06-lifetimes-fixture.mjs";
import {
  androidSmokeArgs,
  selectNativeEngines,
  verifyNativeBinary,
} from "./tf06-smoke-selection.mjs";

const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = new URL("..", import.meta.url).pathname;
const group = process.argv[2] ?? "web";
const scope = process.argv[3] ?? "queries";
const lifetimes = scope === "lifetimes";
const statusPrefix = lifetimes ? "TF06L " : "TF06 ";

if (!["web", "android", "ios", "all"].includes(group)) {
  console.error("Use web, android, ios, or all.");
  process.exit(1);
}

if (
  !["queries", "lifetimes"].includes(scope) ||
  (lifetimes && !["android", "ios"].includes(group))
) {
  console.error(
    "Use android lifetimes or ios lifetimes for the native lifetime scope."
  );
  process.exit(1);
}

const nativeEngines = selectNativeEngines(scope, process.argv[4]);
const reuseIosDigest = process.env.TF06_IOS_BINARY_SHA256;
if (reuseIosDigest) {
  if (!lifetimes || group !== "ios" || nativeEngines.length !== 1)
    throw new Error("Verified binary reuse requires one iOS lifetime engine.");
  verifyNativeBinary(scope, reuseIosDigest, reuseIosDigest);
}
const androidArgs =
  group === "android" || group === "all"
    ? androidSmokeArgs(scope, process.env.ANDROID_SERIAL)
    : null;

/** Bound port-release observation before the next native engine starts. */
const awaitMetroPortRelease = async () => {
  const releasedBy = Date.now() + 5000;
  while (true) {
    const listeners = await command("lsof", [
      "-nP",
      "-iTCP:8081",
      "-sTCP:LISTEN",
      "-t",
    ]).catch(() => "");
    if (!listeners.trim()) break;
    if (Date.now() >= releasedBy)
      throw new Error("Owned Metro did not release port 8081.");
    await delay(100);
  }
};

const results = {};
const fixture = lifetimes ? await startLifetimesFixture() : null;

try {
  if (group === "web" || group === "all") {
    results["mapbox-web"] = await runWeb("web-mapbox", 4177, "Mapbox web");
    results["maplibre-web"] = await runWeb(
      "web-maplibre",
      4178,
      "MapLibre web"
    );
  }

  if (group === "android" || group === "all") {
    for (const engine of nativeEngines) {
      results[`${engine}-android`] = await runNative({
        directory: `native-${engine}`,
        platform: "android",
        applicationId: `com.onemap${engine}`,
      });
    }
  }

  if (group === "ios" || group === "all") {
    for (const engine of nativeEngines) {
      results[`${engine}-ios`] = await runNative({
        directory: `native-${engine}`,
        platform: "ios",
        applicationId: `org.reactjs.native.example.OneMap${engine === "mapbox" ? "Mapbox" : "Maplibre"}`,
      });
    }
  }
} finally {
  await fixture?.close();
}

console.log(JSON.stringify(results, null, 2));

if (Object.values(results).some((result) => result.status !== "passed")) {
  process.exitCode = 1;
}

async function runWeb(directory, port, label) {
  const shell = join(root, "examples", directory);
  const vite = spawn(
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
    { cwd: shell, detached: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  let viteLog = "";
  const record = (chunk) => {
    viteLog += chunk.toString();
  };

  vite.stdout.on("data", record);
  vite.stderr.on("data", record);

  const profile = mkdtempSync(join(tmpdir(), "one-map-tf06-chrome-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port + 1000}`,
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      "--no-first-run",
      `http://127.0.0.1:${port}/?tf06=queries`,
    ],
    { detached: true, stdio: "ignore" }
  );

  try {
    await waitFor(() => viteLog.includes("Local:"), 30000, `${label} server`);
    const page = await attachPage(port + 1000);
    const status = await watchWeb(page, label);
    const ordinary = judge(status);

    if (ordinary.status !== "passed") return ordinary;

    try {
      const corrections = await page.evaluate(
        "window.__oneMapQueryRegressions()",
        true
      );
      const finalStatus = await page.evaluate(
        "document.querySelector('#tf06-status')?.textContent ?? ''"
      );
      const expected = [
        "missing-source",
        "unsupported-source",
        "vector-layer-omitted",
        "vector-layer-0",
        "vector-layer-3",
        "missing-rendered-layer",
        "omitted-layers",
        "empty-layers",
        "rendered-emitted-error",
        "source-emitted-error",
        "empty-result",
        "subsequent-query",
        "listener-cleanup",
      ];

      if (expected.some((name) => corrections?.[name] !== "ok"))
        throw new Error(
          "The TF06 web corrections did not complete every check."
        );

      return { ...judge(finalStatus), corrections };
    } finally {
      page.close();
    }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      log: viteLog.slice(-1500),
    };
  } finally {
    await stopOwnedProcess(chrome);
    await stopOwnedProcess(vite);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function attachPage(debugPort) {
  const started = Date.now();

  while (Date.now() - started < 20000) {
    const listed = await fetchJson(
      `http://127.0.0.1:${debugPort}/json/list`
    ).catch(() => []);
    const page = listed.find(
      (target) => target.type === "page" && target.url.includes("tf06=queries")
    );

    if (page?.webSocketDebuggerUrl) {
      const session = await connect(page.webSocketDebuggerUrl);

      await session.send("Runtime.enable");
      await session.send("Page.enable");

      return session;
    }

    await delay(200);
  }

  throw new Error("Chrome did not open the smoke page.");
}

async function watchWeb(page, label) {
  const started = Date.now();

  while (Date.now() - started < 90000) {
    const status = await page.evaluate(
      "document.querySelector('#tf06-status')?.textContent ?? ''"
    );

    if (status.includes("done=1")) {
      console.error(`${label}: ${status}`);
      return status;
    }

    await delay(500);
  }

  throw new Error(`${label} did not finish`);
}

async function removeAndroidBundle(shell) {
  await command("rm", [
    "-f",
    join(shell, "android/app/src/main/assets/index.android.bundle"),
  ]);
}

async function lanAddress() {
  const address = (await command("ipconfig", ["getifaddr", "en0"])).trim();

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
    throw new Error("en0 has no IPv4 address");
  }

  return address;
}

async function writeDebugHost(applicationId, host) {
  const prefs = `shared_prefs/${applicationId}_preferences.xml`;
  const remote = `run-as ${applicationId} sh -c 'cat > ${prefs}'`;

  await command("adb", ["shell", "am", "force-stop", applicationId]);
  await command("adb", [
    "shell",
    "run-as",
    applicationId,
    "mkdir",
    "-p",
    "shared_prefs",
  ]);

  const existing = await command("adb", [
    "exec-out",
    "run-as",
    applicationId,
    "cat",
    prefs,
  ]).catch(() => "");

  await command("adb", ["shell", remote], {
    input: debugHostPreference(existing, host),
  });
}

function debugHostPreference(existing, host) {
  const entry = `<string name="debug_http_host">${host}</string>`;

  if (existing.includes('name="debug_http_host"')) {
    return existing.replace(
      /<string name="debug_http_host">[^<]*<\/string>/,
      entry
    );
  }

  if (existing.includes("</map>")) {
    return existing.replace("</map>", `    ${entry}\n</map>`);
  }

  return [
    "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>",
    "<map>",
    `    ${entry}`,
    "</map>",
    "",
  ].join("\n");
}

async function startAndroidApp(applicationId) {
  await command("adb", [
    "shell",
    "am",
    "start",
    "-n",
    `${applicationId}/.MainActivity`,
  ]);
}

async function allowNearbyDevices() {
  const started = Date.now();

  while (Date.now() - started < 8000) {
    await command("adb", [
      "shell",
      "uiautomator",
      "dump",
      "/sdcard/ui.xml",
    ]).catch(() => "");
    const xml = await command("adb", [
      "exec-out",
      "cat",
      "/sdcard/ui.xml",
    ]).catch(() => "");
    const point = /nearby devices/i.test(xml) ? allowButtonPoint(xml) : null;

    if (point) {
      await command("adb", [
        "shell",
        "input",
        "tap",
        String(point.x),
        String(point.y),
      ]);
      return;
    }

    await delay(500);
  }
}

function allowButtonPoint(xml) {
  const nodes = xml.match(/<node\b[^>]*>/g) ?? [];
  const allow = nodes.find((node) => node.includes('text="Allow"'));
  const bounds = allow?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);

  if (!bounds) {
    return null;
  }

  return {
    x: Math.round((Number(bounds[1]) + Number(bounds[3])) / 2),
    y: Math.round((Number(bounds[2]) + Number(bounds[4])) / 2),
  };
}

async function readAndroidStatus() {
  const log = await command("adb", ["logcat", "-d"], {}, 20000).catch(() => "");
  const fromLog = latestStatus(log);

  if (fromLog) {
    return fromLog;
  }

  await command("adb", [
    "shell",
    "uiautomator",
    "dump",
    "/sdcard/ui.xml",
  ]).catch(() => "");
  const xml = await command("adb", ["exec-out", "cat", "/sdcard/ui.xml"]).catch(
    () => ""
  );

  return latestStatus(xml.replaceAll("&#10;", " "));
}

function openStatusPort() {
  let latest = "";
  const server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("");
      return;
    }

    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString().trim();

      if (body.includes(statusPrefix)) {
        latest = body;
      }

      response.writeHead(204);
      response.end();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(8799, "127.0.0.1", () => {
      resolve({
        read: () => latest,
        close: () =>
          new Promise((done) => {
            server.close(done);
          }),
      });
    });
  });
}

async function runNative({ directory, platform, applicationId }) {
  const shell = join(root, "examples", directory);

  await freePort(8081);
  if (platform === "ios") await freePort(8799);

  let metroLog = "";
  const metroArgs = ["run", "start", "--", "--port", "8081", "--reset-cache"];

  if (platform === "android") {
    metroArgs.push("--host", "0.0.0.0");
  }

  const nativeEnv = {
    ...process.env,
    ONE_MAP_SMOKE: lifetimes ? "tf06-lifetimes" : "tf06",
    ...(lifetimes
      ? {
          TF06_BASE:
            platform === "android"
              ? `http://${await lanAddress()}:8798`
              : "http://127.0.0.1:8798",
        }
      : {}),
  };
  if (fixture) fixture.requests.length = 0;
  const metro = spawn("bun", metroArgs, {
    cwd: shell,
    env: nativeEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = (chunk) => {
    metroLog += chunk.toString();
  };

  metro.stdout.on("data", record);
  metro.stderr.on("data", record);

  if (platform === "ios") {
    // Stop a prior run before accepting status from the new installation.
    await command("xcrun", [
      "simctl",
      "terminate",
      "booted",
      applicationId,
    ]).catch(() => undefined);
  }
  let statusPort = null;

  try {
    if (platform === "ios") statusPort = await openStatusPort();
    await waitFor(
      () => metroLog.includes("Dev server ready") || metroLog.includes("8081"),
      60000,
      "Metro"
    );

    if (platform === "android") {
      await removeAndroidBundle(shell);
      await command("bun", androidArgs, { cwd: shell, env: nativeEnv }, 600000);

      await writeDebugHost(applicationId, `${await lanAddress()}:8081`);
      await command("adb", ["logcat", "-c"]);
      await startAndroidApp(applicationId);
      await allowNearbyDevices();

      const status = await watchNative({
        readStatus: readAndroidStatus,
      });

      return {
        ...judge(status),
        ...(fixture ? { fixtureRequests: [...fixture.requests] } : {}),
      };
    }

    if (reuseIosDigest) {
      const app = (
        await command("xcrun", [
          "simctl",
          "get_app_container",
          "booted",
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
      const digest = (
        await command("shasum", ["-a", "256", join(app, executable)])
      )
        .trim()
        .split(/\s+/)[0];
      verifyNativeBinary(scope, reuseIosDigest, digest);
      await command("xcrun", ["simctl", "launch", "booted", applicationId]);
    } else {
      await command(
        "bun",
        [
          "run",
          "ios",
          "--",
          "--no-packager",
          "--port",
          "8081",
          "--simulator",
          "iPhone 18 Pro",
        ],
        { cwd: shell, env: nativeEnv },
        600000
      );
    }

    const status = await watchNative({
      readStatus: () => statusPort.read(),
      timeout: 600000,
    });

    return {
      ...judge(status),
      ...(fixture ? { fixtureRequests: [...fixture.requests] } : {}),
      ...(reuseIosDigest
        ? {
            reusedNativeBuild: true,
            installedExecutableSha256: reuseIosDigest,
          }
        : {}),
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      log: metroLog.slice(-1500),
    };
  } finally {
    if (platform === "android") {
      await command("adb", ["shell", "am", "force-stop", applicationId]).catch(
        () => undefined
      );
    }
    if (platform === "ios") {
      await command("xcrun", [
        "simctl",
        "terminate",
        "booted",
        applicationId,
      ]).catch(() => undefined);
    }

    await statusPort?.close();
    await stopOwnedProcess(metro);
    await awaitMetroPortRelease();
  }
}

async function watchNative({ readStatus, timeout = 240000 }) {
  const started = Date.now();
  let last = "";

  while (Date.now() - started < timeout) {
    const status = await readStatus();

    if (!status) {
      await delay(300);
      continue;
    }

    if (status !== last) {
      console.error(status);
      last = status;
    }

    if (status.includes("done=1")) {
      return status;
    }

    await delay(300);
  }

  throw new Error(
    `Native smoke ended at: ${(await readStatus()) || "no status"}`
  );
}

function latestStatus(log) {
  const line = log
    .split("\n")
    .reverse()
    .find((entry) => entry.includes(statusPrefix));

  if (!line) {
    return "";
  }

  const start = line.indexOf(statusPrefix);

  return line.slice(start).split('"')[0].trim();
}

function judge(status) {
  const fields = Object.fromEntries(
    status
      .split(" ")
      .map((part) => part.split("="))
      .filter((part) => part.length === 2)
  );
  if (lifetimes) {
    const operations = [
      "vector-queries",
      "key-remove",
      "whole-remove",
      "vector-namespaces",
    ];
    const transitions = [
      "vector-remount",
      "vector-style",
      "vector-to-geojson",
      "geojson-to-vector",
      "final-remount",
    ];
    const passed =
      fields.loaded === "1" &&
      operations.every((key) => fields[key] === "ok") &&
      transitions.every((key) => fields[key] === "explicitly-cleared") &&
      fields.error === "none" &&
      fields.phase === "done" &&
      fields.done === "1";
    return { status: passed ? "passed" : "failed", line: status, fields };
  }
  const passed =
    fields.loaded === "1" &&
    fields.point === "ok" &&
    fields.bounds === "ok" &&
    fields.viewport === "ok" &&
    fields.empty === "ok" &&
    fields.source === "ok" &&
    fields.filters === "ok" &&
    fields.pagination === "ok" &&
    fields["whole-state"] === "ok" &&
    fields["recreated-state"] === "explicitly-cleared" &&
    fields["cluster-zoom"] === "ok" &&
    fields.leaves === "ok" &&
    fields.children === "ok" &&
    fields["set-state"] === "ok" &&
    fields["get-state"] === "ok" &&
    fields["remove-state"] === "ok" &&
    fields["cleared-state"] === "explicitly-cleared" &&
    fields.error === "none" &&
    fields.done === "1";

  return { status: passed ? "passed" : "failed", line: status, fields };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let next = 0;
    const pending = new Map();
    const send = (method, params = {}) =>
      new Promise((done, fail) => {
        const id = next + 1;

        next = id;
        pending.set(id, { done, fail });
        socket.send(JSON.stringify({ id, method, params }));
      });

    socket.addEventListener("open", () => {
      resolve({
        send,
        evaluate: async (expression, awaitPromise = false) => {
          const result = await send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise,
          });

          if (result.exceptionDetails) {
            throw new Error(JSON.stringify(result.exceptionDetails));
          }

          return result.result?.value;
        },
        close: () => {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", () => {
      reject(new Error(`Chrome debugger failed: ${url}`));
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiter = pending.get(message.id);

      if (!waiter) {
        return;
      }

      pending.delete(message.id);

      if (message.error) {
        waiter.fail(new Error(JSON.stringify(message.error)));
        return;
      }

      waiter.done(message.result);
    });
  });
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}

async function waitFor(ready, timeout, label) {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    if (ready()) {
      return;
    }

    await delay(200);
  }

  throw new Error(`${label} was not ready`);
}

function delay(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

function command(file, args, options = {}, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input);
    }
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${file} timed out`));
    }, timeout);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        resolve(output);
        return;
      }

      reject(new Error(output.slice(-2000) || `${file} exited ${code}`));
    });
  });
}

async function freePort(port) {
  const listed = await command("lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-t",
  ]).catch(() => "");
  if (listed.trim())
    throw new Error(
      `Port ${port} is already occupied; stop its owner before acceptance.`
    );
}
