import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stopOwnedProcess } from "./native-smoke-process.mjs";

const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = new URL("..", import.meta.url).pathname;
const group = process.argv[2] ?? "web";
const iosUdid = process.env.TF04_IOS_UDID;
if (
  (group === "ios" || group === "all") &&
  !/^[0-9A-F-]{36}$/i.test(iosUdid ?? "")
) {
  throw new Error("TF04_IOS_UDID must identify the assigned simulator.");
}
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
  results["mapbox-android"] = await runNative({
    directory: "native-mapbox",
    platform: "android",
    applicationId: "com.onemapmapbox",
    doubleTap: false,
  });
  results["maplibre-android"] = await runNative({
    directory: "native-maplibre",
    platform: "android",
    applicationId: "com.onemapmaplibre",
    doubleTap: true,
  });
}

if (group === "ios" || group === "all") {
  const tapDriver = await startIosTapDriver();

  try {
    results["mapbox-ios"] = await runNative({
      directory: "native-mapbox",
      platform: "ios",
      applicationId: "org.reactjs.native.example.OneMapMapbox",
      doubleTap: false,
      inputDriver: tapDriver,
    });
    tapDriver.assertRunning();
    if (results["mapbox-ios"].status !== "passed") {
      console.log(JSON.stringify(results, null, 2));
      throw new Error(
        "Mapbox iOS camera smoke failed; stopping before MapLibre."
      );
    }
    results["maplibre-ios"] = await runNative({
      directory: "native-maplibre",
      platform: "ios",
      applicationId: "org.reactjs.native.example.OneMapMaplibre",
      doubleTap: true,
      inputDriver: tapDriver,
    });
  } finally {
    await stopOwnedProcess(tapDriver.driver);
  }
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

  const profile = mkdtempSync(join(tmpdir(), "one-map-tf04-chrome-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port + 1000}`,
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      "--no-first-run",
      `http://127.0.0.1:${port}/?tf04=${webScenario}`,
    ],
    { detached: true, stdio: "ignore" }
  );

  try {
    await waitFor(() => viteLog.includes("Local:"), 30000, `${label} server`);
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

async function startIosTapDriver() {
  const listed = await command("xcrun", [
    "simctl",
    "list",
    "devices",
    "--json",
  ]);
  const assigned = Object.values(JSON.parse(listed).devices)
    .flat()
    .find((device) => device.udid === iosUdid);
  if (!assigned?.isAvailable || assigned.state !== "Booted") {
    throw new Error(
      "The assigned iOS simulator must already be available and Booted."
    );
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
      `platform=iOS Simulator,id=${iosUdid}`,
      "-only-testing:TapDriverUITests/TapDriver/testDriveTaps",
    ],
    { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  const record = (chunk) => {
    log += chunk.toString();
  };

  let driverFailure;
  const abort = new AbortController();
  const fail = (error) => {
    driverFailure = error;
    abort.abort(error);
  };
  const assertRunning = () => {
    if (driverFailure) throw driverFailure;
  };
  driver.on("error", fail);
  driver.on("exit", (code) => {
    fail(new Error(`iOS tap driver exited ${code}`));
  });
  driver.stdout.on("data", record);
  driver.stderr.on("data", record);

  try {
    await waitFor(
      () => {
        assertRunning();
        return log.includes("testDriveTaps]' started");
      },
      180000,
      "iOS tap driver"
    );
  } catch (error) {
    await stopOwnedProcess(driver);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${log.slice(-1500)}`
    );
  }

  return { driver, signal: abort.signal, assertRunning };
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

async function runNative({
  directory,
  platform,
  applicationId,
  doubleTap,
  inputDriver,
}) {
  const shell = join(root, "examples", directory);

  await freePort(8081);
  if (platform === "ios") {
    try {
      await command("xcrun", ["simctl", "terminate", iosUdid, applicationId]);
    } catch (error) {
      if (
        !/application\b.*\bnot running|found nothing to terminate|no such process/i.test(
          error.message
        )
      )
        throw error;
    }
  }

  let metroLog = "";
  const metroArgs = ["run", "start", "--", "--port", "8081", "--reset-cache"];

  if (platform === "android") {
    metroArgs.push("--host", "0.0.0.0");
  }

  const metro = spawn("bun", metroArgs, {
    cwd: shell,
    env: { ...process.env, ONE_MAP_SMOKE: "tf04" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = (chunk) => {
    metroLog += chunk.toString();
  };

  let metroFailure;
  metro.on("error", (error) => {
    metroFailure = error;
  });
  metro.on("exit", (code) => {
    metroFailure = new Error(`Metro exited ${code}`);
  });
  metro.stdout.on("data", record);
  metro.stderr.on("data", record);

  let statusPort;

  try {
    statusPort = platform === "ios" ? await openStatusPort() : null;
    await waitFor(
      () => {
        inputDriver?.assertRunning();
        if (metroFailure) throw metroFailure;
        return metroLog.includes("Dev server ready");
      },
      60000,
      "Metro"
    );

    if (platform === "android") {
      await removeAndroidBundle(shell);
      await command(
        "bun",
        ["run", "android", "--", "--no-packager"],
        { cwd: shell, env: { ...process.env, ONE_MAP_SMOKE: "tf04" } },
        600000
      );
      const address = await lanAddress();

      await writeDebugHost(applicationId, `${address}:8081`);
      await command("adb", ["logcat", "-c"]);
      await startAndroidApp(applicationId);
      await allowNearbyDevices();

      const status = await watchNative({
        readStatus: readAndroidStatus,
        doubleTap,
        applicationId,
        platform,
      });

      return judge(status, doubleTap, platform);
    }

    await command(
      "bun",
      [
        "run",
        "ios",
        "--",
        "--no-packager",
        "--port",
        "8081",
        "--udid",
        iosUdid,
      ],
      {
        cwd: shell,
        env: { ...process.env, ONE_MAP_SMOKE: "tf04" },
        signal: inputDriver?.signal,
      },
      600000
    );
    const status = await watchNative({
      readStatus: () => {
        inputDriver?.assertRunning();
        if (metroFailure) throw metroFailure;
        return statusPort.read();
      },
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
    try {
      if (platform === "ios") {
        await command("xcrun", [
          "simctl",
          "terminate",
          iosUdid,
          applicationId,
        ]).catch((error) => {
          if (
            !/application\b.*\bnot running|found nothing to terminate|no such process/i.test(
              error.message
            )
          )
            throw error;
        });
      }
    } finally {
      try {
        await statusPort?.close();
      } finally {
        await stopOwnedProcess(metro);
      }
    }
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
      signal: options.signal,
      detached: true,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    let output = "";
    let stopping = false;
    const stop = async (error) => {
      if (stopping) return;
      stopping = true;
      clearTimeout(timer);
      try {
        await stopOwnedProcess(child);
        reject(error);
      } catch (cleanupError) {
        reject(cleanupError);
      }
    };
    const timer = setTimeout(() => {
      void stop(new Error(`${file} timed out`));
    }, timeout);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      void stop(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (stopping) return;
      if (code === 0) resolve(output);
      else
        void stop(new Error(output.slice(-2000) || `${file} exited ${code}`));
    });
  });
}

async function freePort(port) {
  try {
    await command("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  } catch (error) {
    if (error.message === "lsof exited 1") return;
    throw error;
  }
  throw new Error(`Port ${port} is occupied; no listener was terminated.`);
}
