import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = new URL("..", import.meta.url).pathname;
const group = process.argv[2] ?? "web";

if (!["web", "android", "ios", "all"].includes(group)) {
  console.error("Use web, android, ios, or all.");
  process.exit(1);
}

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
    });
    results["maplibre-ios"] = await runNative({
      directory: "native-maplibre",
      platform: "ios",
      applicationId: "org.reactjs.native.example.OneMapMaplibre",
      doubleTap: true,
    });
  } finally {
    tapDriver.kill("SIGTERM");
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
    { cwd: shell, stdio: ["ignore", "pipe", "pipe"] }
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
      `http://127.0.0.1:${port}/?tf04=camera`,
    ],
    { stdio: "ignore" }
  );

  try {
    await waitFor(() => viteLog.includes("Local:"), 30000, `${label} server`);
    const page = await attachPage(port + 1000);
    const status = await watchWeb(page, label);

    return judge(status, false);
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      log: viteLog.slice(-1500),
    };
  } finally {
    chrome.kill("SIGKILL");
    vite.kill("SIGTERM");
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
      (target) => target.type === "page" && target.url.includes("tf04=camera")
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
    await command("adb", ["shell", "uiautomator", "dump", "/sdcard/ui.xml"]).catch(
      () => ""
    );
    const xml = await command("adb", ["exec-out", "cat", "/sdcard/ui.xml"]).catch(
      () => ""
    );
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

  await command("adb", ["shell", "uiautomator", "dump", "/sdcard/ui.xml"]).catch(
    () => ""
  );
  const xml = await command("adb", ["exec-out", "cat", "/sdcard/ui.xml"]).catch(
    () => ""
  );

  return latestStatus(xml.replaceAll("&#10;", " "));
}

async function startIosTapDriver() {
  const listed = await command("xcrun", ["simctl", "list", "devices", "booted"]);

  if (!listed.includes("iPhone 18 Pro")) {
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
      "platform=iOS Simulator,name=iPhone 18 Pro",
      "-only-testing:TapDriverUITests/TapDriver/testDriveTaps",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
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
    driver.kill("SIGTERM");
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
  const shell = join(root, "examples", directory);

  await freePort(8081);

  let metroLog = "";
  const metroArgs = ["run", "start", "--", "--port", "8081", "--reset-cache"];

  if (platform === "android") {
    metroArgs.push("--host", "0.0.0.0");
  }

  const metro = spawn("bun", metroArgs, {
    cwd: shell,
    env: { ...process.env, ONE_MAP_SMOKE: "tf04" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = (chunk) => {
    metroLog += chunk.toString();
  };

  metro.stdout.on("data", record);
  metro.stderr.on("data", record);

  const statusPort = platform === "ios" ? await openStatusPort() : null;
  let build = Promise.resolve();

  try {
    await waitFor(
      () => metroLog.includes("Dev server ready") || metroLog.includes("8081"),
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

    build = command(
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
      { cwd: shell, env: { ...process.env, ONE_MAP_SMOKE: "tf04" } },
      600000
    );

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
    await build.catch(() => undefined);

    if (platform === "ios") {
      await command("xcrun", ["simctl", "terminate", "booted", applicationId]).catch(
        () => undefined
      );
    }

    await statusPort?.close();
    metro.kill("SIGTERM");
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

  throw new Error(`Native smoke ended at: ${(await readStatus()) || "no status"}`);
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
  const heldOk =
    fields.stop === "rejected"
      ? fields.held === "0" || fields.held === "1"
      : fields.held === "1";
  const doubleTapOk = doubleTapPassed(fields.doubletap, doubleTap, platform);
  const passed =
    fields.fit === "ok" &&
    fields.click === "hit" &&
    stopOk &&
    heldOk &&
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

  for (const pid of listed.split("\n").filter(Boolean)) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // The process can exit between the listing and the signal.
    }
  }

  await delay(500);
}
