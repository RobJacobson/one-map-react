import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stopOwnedProcess } from "./native-smoke-process.mjs";
import { startLifetimesFixture } from "./tf06-lifetimes-fixture.mjs";
import { selectNativeEngines } from "./tf06-smoke-selection.mjs";
import {
  webShell,
  webScenarioUrl,
  nativeEnvironment,
  nativeMetroArgs,
  nativeApplicationId,
  launchNativeWorkspace,
} from "./workspace-smoke-shell.mjs";

const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = new URL("..", import.meta.url).pathname;
const iosDevice = process.env.ONE_MAP_ACCEPTANCE_IOS_UDID ?? "booted";
let nativePid;
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
        applicationId:
          process.env[`TF06_${engine.toUpperCase()}_ANDROID_ID`] ??
          `com.onemap${engine}`,
      });
    }
  }

  if (group === "ios" || group === "all") {
    for (const engine of nativeEngines) {
      results[`${engine}-ios`] = await runNative({
        directory: `native-${engine}`,
        platform: "ios",
        applicationId:
          process.env[`TF06_${engine.toUpperCase()}_IOS_ID`] ??
          `org.reactjs.native.example.OneMap${engine === "mapbox" ? "Mapbox" : "Maplibre"}`,
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
  const web = webShell(root, port);
  const shell = web.cwd;
  const vite = spawn(web.command, web.args, {
    cwd: shell,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
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
      webScenarioUrl(root, port, "tf06=queries", directory.replace("web-", "")),
    ],
    { detached: true, stdio: "ignore" }
  );

  try {
    await waitFor(
      () => viteLog.includes("Local:") || viteLog.includes("Waiting on"),
      30000,
      `${label} server`
    );
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
  const log = await command(
    "adb",
    ["logcat", "-d", "--pid", String(nativePid)],
    {},
    20000
  ).catch(() => "");
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
  applicationId = nativeApplicationId();
  const shell = join(root, "apps/expo");

  await freePort(8081);
  if (platform === "ios") await freePort(8799);

  let metroLog = "";
  const metroArgs = nativeMetroArgs();

  const nativeEnv = nativeEnvironment(
    directory.replace("native-", ""),
    lifetimes ? "tf06-lifetimes" : "tf06",
    { TF05_BASE: "http://127.0.0.1:8798", TF06_BASE: "http://127.0.0.1:8798" }
  );
  if (fixture) fixture.requests.length = 0;
  const metro = spawn("node", metroArgs, {
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
      iosDevice,
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
      const launched = launchNativeWorkspace({ platform, iosDevice });
      nativePid = launched?.pid;
      await allowNearbyDevices();

      const status = await watchNative({
        readStatus: readAndroidStatus,
      });

      return {
        ...judge(status),
        ...(fixture ? { fixtureRequests: [...fixture.requests] } : {}),
      };
    }

    launchNativeWorkspace({ platform, iosDevice });

    const status = await watchNative({
      readStatus: () => statusPort.read(),
      timeout: 600000,
    });

    return {
      ...judge(status),
      ...(fixture ? { fixtureRequests: [...fixture.requests] } : {}),
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
        iosDevice,
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
      `Acceptance port ${port} is already owned; no process was stopped.`
    );
}
