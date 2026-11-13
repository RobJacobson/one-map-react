import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stopOwnedProcess } from "./native-smoke-process.mjs";
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
const nativeEngine = process.env.TF04_ENGINE ?? "both";
if (!["both", "mapbox", "maplibre"].includes(nativeEngine))
  throw new Error("Use both, mapbox or maplibre for TF04_ENGINE.");
const corrections = process.argv[3] === "corrections";
if (process.argv[3] !== undefined && (!corrections || group !== "web")) {
  throw new Error("The corrections scope requires: web corrections.");
}
const webScenario = corrections ? "corrections" : "camera";

if (!["web", "android", "ios", "all"].includes(group)) {
  console.error("Use web, android, ios, or all.");
  process.exit(1);
}

// These helpers initialize before the script's eager web dispatch below.
const runWebCorrections = async (page) => {
  const renderer = "window.__oneMapCorrectionRenderer";
  const observe = async (expression, label, timeout = 5000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const error = await page.evaluate(
        "document.querySelector('#corrections-error')?.textContent"
      );
      if (error && error !== "none") throw new Error(error);
      if (await page.evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`${label} timed out`);
  };
  const click = (id) =>
    page.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const handlers = [
    "dragPan",
    "scrollZoom",
    "doubleClickZoom",
    "dragRotate",
    "boxZoom",
    "keyboard",
    "touchZoomRotate",
    "touchPitch",
  ];
  const handlerState = (disabled = []) =>
    handlers
      .map(
        (name) =>
          `Boolean(${renderer}.${name}.isEnabled()) === ${!disabled.includes(name)}`
      )
      .join(" && ");
  const doubleClick = async () => {
    const point = await page.evaluate(
      `(() => { const box = document.querySelector("canvas").getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; })()`
    );
    for (const clickCount of [1, 2]) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await page.send("Input.dispatchMouseEvent", {
          type,
          ...point,
          button: "left",
          clickCount,
        });
      }
    }
  };
  await observe(
    `${renderer}?.isStyleLoaded() === true`,
    "initial style",
    20000
  );
  await observe(`${renderer}.getPadding().top === 24`, "initial padding");
  await page.evaluate(
    `void ${renderer}.jumpTo({center: [-122.3, 47.65], zoom: 11})`
  );
  await click("padding-update");
  await observe(
    `${renderer}.getPadding().top === 64 && Math.abs(${renderer}.getCenter().lat - 47.65) < 0.001`,
    "padding update preserves uncontrolled camera"
  );
  await click("padding-reset");
  await observe(
    `Object.values(${renderer}.getPadding()).every(value => value === 0)`,
    "padding reset"
  );
  await observe(
    `!${renderer}.doubleClickZoom.isEnabled() && ${renderer}.touchZoomRotate._rotationDisabled === true`,
    "disabled double tap and rotation"
  );
  await click("gesture-reset");
  await observe(
    `${renderer}.touchZoomRotate._rotationDisabled === false && !${renderer}.touchZoomRotate.isEnabled()`,
    "rotation reset keeps pinch disabled"
  );
  await click("gesture-enable");
  await observe(
    `${renderer}.doubleClickZoom.isEnabled() && ${renderer}.touchZoomRotate.isEnabled()`,
    "gesture enable"
  );
  const initialZoom = await page.evaluate(`${renderer}.getZoom()`);
  await doubleClick();
  await observe(
    `${renderer}.getZoom() > ${initialZoom} + 0.5`,
    "physical double click zoom"
  );
  await observe(`${renderer}.isMoving() === false`, "zoom settles");
  await click("rotation-disable");
  await observe(
    `${renderer}.touchZoomRotate._rotationDisabled === true`,
    "rotation override"
  );
  await page.evaluate(`void (window.__oneMapPreviousRenderer = ${renderer})`);
  await click("map-toggle");
  await observe(
    `!${renderer} && window.__oneMapPreviousRenderer.touchZoomRotate._rotationDisabled === false`,
    "unmount releases rotation"
  );
  await click("map-toggle");
  await observe(
    `${renderer} === window.__oneMapPreviousRenderer && ${renderer}.touchZoomRotate._rotationDisabled === false`,
    "reused renderer rotation default",
    20000
  );

  await click("interaction-off");
  await observe(handlerState(handlers), "master disables all handlers");
  await click("interaction-individual");
  await observe(
    handlerState(handlers),
    "individual flags cannot override disabled master"
  );

  const disabledZoom = await page.evaluate(`${renderer}.getZoom()`);
  await page.evaluate(
    `(() => { window.__oneMapDisabledDoubleClick = false; document.querySelector("canvas").addEventListener("dblclick", () => { window.__oneMapDisabledDoubleClick = true; }, {once: true}); })()`
  );
  await doubleClick();
  await observe(
    "window.__oneMapDisabledDoubleClick === true",
    "disabled physical double click arrives"
  );
  // Observe several rendered frames so a delayed gesture animation cannot pass.
  const stableUntil = Date.now() + 750;
  while (Date.now() < stableUntil) {
    if (
      !(await page.evaluate(
        `Math.abs(${renderer}.getZoom() - ${disabledZoom}) < 0.001 && ${renderer}.isMoving() === false`
      ))
    ) {
      throw new Error("Disabled physical double click changed the camera.");
    }
    await page.evaluate(
      "new Promise(resolve => { requestAnimationFrame(() => resolve(true)); setTimeout(() => resolve(true), 100); })"
    );
  }

  await click("interaction-on");
  await observe(handlerState(), "master restores explicit enabled gestures");
  await click("interaction-explicit");
  const explicitDisabled = ["dragPan", "scrollZoom", "touchZoomRotate"];
  await observe(
    `${handlerState(explicitDisabled)} && ${renderer}.touchZoomRotate._rotationDisabled === false`,
    "explicit disabled gestures survive enabled master"
  );
  await click("interaction-off");
  await observe(handlerState(handlers), "master disables explicit settings");
  await click("interaction-clear");
  await observe(
    handlerState(explicitDisabled),
    "cleared master restores explicit gesture settings"
  );
  await click("interaction-defaults");
  await observe(handlerState(), "omitted gestures restore wrapper defaults");

  await click("interaction-off");
  await observe(handlerState(handlers), "disabled settings before reuse");
  await page.evaluate(`void (window.__oneMapPreviousRenderer = ${renderer})`);
  await click("map-toggle");
  await observe(`!${renderer}`, "disabled map unmount");
  await click("interaction-on");
  await click("map-toggle");
  await observe(
    `${renderer} === window.__oneMapPreviousRenderer && ${handlerState()}`,
    "reused renderer applies next enabled settings",
    20000
  );
  await click("interaction-off");
  await observe(handlerState(handlers), "reused renderer master disable");
  await click("map-toggle");
  await observe(`!${renderer}`, "second map unmount");
  await click("map-toggle");
  await observe(
    `${renderer} === window.__oneMapPreviousRenderer && ${handlerState(handlers)}`,
    "reused renderer retains disabled settings",
    20000
  );
  return {
    status: "passed",
    scenarios: [
      "padding update/reset",
      "double tap zoom",
      "rotation reset with pinch disabled",
      "rotation release/reuse",
      "master disables all eight handlers",
      "disabled physical double click",
      "explicit/default gesture restoration",
      "interaction settings on renderer reuse",
    ],
    mode: "real automation",
  };
};

const results = {};

if (group === "web" || group === "all") {
  results["mapbox-web"] = await runWeb("web-mapbox", 4173, "Mapbox web");
  results["maplibre-web"] = await runWeb("web-maplibre", 4174, "MapLibre web");
}

if (group === "android" || group === "all") {
  if (nativeEngine === "both" || nativeEngine === "mapbox") {
    results["mapbox-android"] = await runNative({
      directory: "native-mapbox",
      platform: "android",
      applicationId: process.env.TF04_MAPBOX_ANDROID_ID ?? "com.onemapmapbox",
      doubleTap: false,
    });
  }
  if (nativeEngine === "both" || nativeEngine === "maplibre") {
    results["maplibre-android"] = await runNative({
      directory: "native-maplibre",
      platform: "android",
      applicationId:
        process.env.TF04_MAPLIBRE_ANDROID_ID ?? "com.onemapmaplibre",
      doubleTap: true,
    });
  }
}

if (group === "ios" || group === "all") {
  const tapDriver = await startIosTapDriver();

  try {
    if (nativeEngine === "both" || nativeEngine === "mapbox") {
      results["mapbox-ios"] = await runNative({
        directory: "native-mapbox",
        platform: "ios",
        applicationId:
          process.env.TF04_MAPBOX_IOS_ID ??
          "org.reactjs.native.example.OneMapMapbox",
        doubleTap: false,
      });
    }
    if (nativeEngine === "both" || nativeEngine === "maplibre") {
      results["maplibre-ios"] = await runNative({
        directory: "native-maplibre",
        platform: "ios",
        applicationId:
          process.env.TF04_MAPLIBRE_IOS_ID ??
          "org.reactjs.native.example.OneMapMaplibre",
        doubleTap: true,
      });
    }
  } finally {
    await stopOwnedProcess(tapDriver);
  }
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

  const profile = mkdtempSync(join(tmpdir(), "one-map-tf04-chrome-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port + 1000}`,
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      "--no-first-run",
      webScenarioUrl(
        root,
        port,
        `tf04=${webScenario}`,
        directory.replace("web-", "")
      ),
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
    if (corrections) {
      try {
        return await runWebCorrections(page);
      } finally {
        page.close();
      }
    }
    const status = await watchWeb(page, label);

    return judge(status, false);
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
      (target) =>
        target.type === "page" && target.url.includes(`tf04=${webScenario}`)
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
  let clicks = 0;

  while (Date.now() - started < 50000) {
    const status = await page.evaluate(
      "document.querySelector('#tf04-status')?.textContent ?? ''"
    );

    if (
      status.includes("phase=await-click") &&
      !status.includes("click=hit") &&
      clicks < 4
    ) {
      clicks += 1;
      const point = await page.evaluate(`(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return null;
        const rectangle = canvas.getBoundingClientRect();
        return {
          x: rectangle.left + rectangle.width / 2,
          y: rectangle.top + rectangle.height / 2,
        };
      })()`);

      if (point) {
        await clickPoint(page, point.x, point.y);
      }
    }

    if (status.includes("done=1")) {
      console.error(`${label}: ${status}`);
      return status;
    }

    await delay(500);
  }

  throw new Error(`${label} did not finish`);
}

async function clickPoint(page, x, y) {
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

async function startIosTapDriver() {
  const listed = await command("xcrun", [
    "simctl",
    "list",
    "devices",
    "booted",
  ]);

  if (!listed.includes(iosDevice === "booted" ? "iPhone 18 Pro" : iosDevice)) {
    throw new Error("iPhone 18 Pro is not booted");
  }

  await freePort(8799);
  let log = "";
  const driver = spawn(
    "xcodebuild",
    [
      "test",
      "-project",
      join(root, "scripts/ios-tap/TapDriver.xcodeproj"),
      "-scheme",
      "TapDriver",
      "-destination",
      iosDevice === "booted"
        ? "platform=iOS Simulator,name=iPhone 18 Pro"
        : `platform=iOS Simulator,id=${iosDevice}`,
      "-only-testing:TapDriverUITests/TapDriver/testDriveTaps",
    ],
    { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  const record = (chunk) => {
    log += chunk.toString();
  };

  driver.stdout.on("data", record);
  driver.stderr.on("data", record);

  try {
    await waitFor(
      () => log.includes("testDriveTaps]' started"),
      180000,
      "iOS tap driver"
    );
  } catch (error) {
    await stopOwnedProcess(driver);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${log.slice(-1500)}`
    );
  }

  return driver;
}

function openStatusPort() {
  let latest = "";
  let tap = "";
  let armed = false;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url?.startsWith("/tap")) {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(tap);
      return;
    }

    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString().trim();

      if (request.url?.startsWith("/tap")) {
        tap = body;
      } else if (body.includes("TF04 ")) {
        if (
          !armed &&
          (body.includes("phase=await-load") ||
            body.includes("phase=await-fit") ||
            body.includes("click=pending"))
        ) {
          armed = true;
        }

        if (armed) {
          latest = body;
        }
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

async function runNative({ directory, platform, applicationId, doubleTap }) {
  applicationId = nativeApplicationId();
  const shell = join(root, "apps/expo");

  await freePort(8081);

  let metroLog = "";
  const metroArgs = nativeMetroArgs();

  const metro = spawn("node", metroArgs, {
    cwd: shell,
    env: nativeEnvironment(directory.replace("native-", ""), "tf04"),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = (chunk) => {
    metroLog += chunk.toString();
  };

  metro.stdout.on("data", record);
  metro.stderr.on("data", record);

  const statusPort = platform === "ios" ? await openStatusPort() : null;

  try {
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
        doubleTap,
        applicationId,
        platform,
      });

      return judge(status, doubleTap, platform);
    }

    if (iosDevice === "booted") {
      throw new Error("Isolated acceptance requires an explicit iOS UDID");
    }
    launchNativeWorkspace({ platform, iosDevice });

    const status = await watchNative({
      readStatus: () => statusPort.read(),
      doubleTap,
      applicationId,
      platform,
      timeout: 600000,
    });

    return judge(status, doubleTap, platform);
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      log: metroLog.slice(-1500),
    };
  } finally {
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
  }
}

async function watchNative({
  readStatus,
  doubleTap,
  applicationId,
  platform,
  timeout = 180000,
}) {
  const started = Date.now();
  let clicks = 0;
  let doubleTaps = 0;
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

    if (status.includes("phase=await-click") && clicks < 3) {
      clicks += 1;
      await tapMap(platform, applicationId, 1);
    }

    if (
      status.includes("phase=await-double-tap") &&
      doubleTap &&
      doubleTaps < 4
    ) {
      doubleTaps += 1;
      await delay(800);
      await tapMap(platform, applicationId, 2);
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
    .find((entry) => entry.includes("TF04 "));

  if (!line) {
    return "";
  }

  const start = line.indexOf("TF04 ");

  return line.slice(start).split('"')[0].trim();
}

async function tapMap(platform, applicationId, times) {
  if (platform === "android") {
    const size = await command("adb", ["shell", "wm", "size"]);
    const match = /(\d+)x(\d+)/.exec(size);
    const x = Math.round(Number(match?.[1] ?? 1080) / 2);
    const y = Math.round(Number(match?.[2] ?? 1920) * 0.62);

    if (times > 1) {
      await command("adb", [
        "shell",
        `input tap ${x} ${y}; sleep 0.1; input tap ${x} ${y}`,
      ]);
      return;
    }

    await command("adb", ["shell", "input", "tap", String(x), String(y)]);
    return;
  }

  await fetch("http://127.0.0.1:8799/tap", {
    method: "POST",
    body: `tap ${applicationId} 0.5 0.62 ${times} ${Date.now()}`,
  });
}

function judge(status, doubleTap, platform = "web") {
  const fields = Object.fromEntries(
    status
      .split(" ")
      .map((part) => part.split("="))
      .filter((part) => part.length === 2)
  );
  const stopOk = fields.stop === "stayed" || fields.stop === "rejected";
  const cameraOk =
    platform === "web"
      ? fields.held === "1"
      : fields.held === "0" && fields.command === "applied";
  const doubleTapOk = doubleTapPassed(fields.doubletap, doubleTap, platform);
  const passed =
    fields.fit === "ok" &&
    fields.click === "hit" &&
    stopOk &&
    cameraOk &&
    doubleTapOk &&
    fields.done === "1";

  return { status: passed ? "passed" : "failed", line: status, fields };
}

// MapLibre Android SDK 13.6.1 does not zoom from a double tap while zoom
// gestures are off. That timeout is the Android pass. iOS still has to zoom.
function doubleTapPassed(observed, doubleTap, platform) {
  if (!doubleTap) {
    return observed === "skip";
  }

  if (platform === "android") {
    return observed === "timeout";
  }

  return observed === "zoomed";
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
        evaluate: async (expression) => {
          const result = await send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
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
