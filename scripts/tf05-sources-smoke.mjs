import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = new URL("..", import.meta.url).pathname;
const group = process.argv[2] ?? "web";
const corrections = process.argv[3] === "corrections";
if (process.argv[3] !== undefined && (!corrections || group !== "web")) {
  throw new Error("The corrections scope requires: web corrections.");
}
const webScenario = corrections ? "corrections" : "sources";

if (!["web", "android", "ios", "all"].includes(group)) {
  console.error("Use web, android, ios, or all.");
  process.exit(1);
}

// Runs after every helper below initializes; pngPixel reads a module-level
// table that top-level execution would reach before its declaration.
async function main() {
  const fixture = await startFixtureServer();
  const results = {};

  try {
    if (group === "web" || group === "all") {
      results["mapbox-web"] = await runWeb("web-mapbox", 4175, "Mapbox web");
      results["maplibre-web"] = await runWeb(
        "web-maplibre",
        4176,
        "MapLibre web"
      );
    }

    if (group === "android" || group === "all") {
      results["mapbox-android"] = await runNative({
        directory: "native-mapbox",
        platform: "android",
        applicationId: "com.onemapmapbox",
      });
      results["maplibre-android"] = await runNative({
        directory: "native-maplibre",
        platform: "android",
        applicationId: "com.onemapmaplibre",
      });
    }

    if (group === "ios" || group === "all") {
      results["mapbox-ios"] = await runNative({
        directory: "native-mapbox",
        platform: "ios",
        applicationId: "org.reactjs.native.example.OneMapMapbox",
      });
      results["maplibre-ios"] = await runNative({
        directory: "native-maplibre",
        platform: "ios",
        applicationId: "org.reactjs.native.example.OneMapMaplibre",
      });
    }
  } finally {
    await fixture.close();
  }

  console.log(JSON.stringify(results, null, 2));

  if (Object.values(results).some((result) => result.status !== "passed")) {
    process.exitCode = 1;
  }
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

  const profile = mkdtempSync(join(tmpdir(), "one-map-tf05-chrome-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port + 1000}`,
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      "--no-first-run",
      `http://127.0.0.1:${port}/?tf05=${webScenario}`,
    ],
    { stdio: "ignore" }
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

    return judge(status);
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
      (target) =>
        target.type === "page" && target.url.includes(`tf05=${webScenario}`)
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
      "document.querySelector('#tf05-status')?.textContent ?? ''"
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

      if (body.includes("TF05 ")) {
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

  let metroLog = "";
  const metroArgs = ["run", "start", "--", "--port", "8081", "--reset-cache"];
  // MapLibre Android's HTTP stack times out on the emulator's 10.0.2.2
  // alias; the host LAN address reaches the fixture server on 0.0.0.0.
  const fixtureBase =
    platform === "android"
      ? `http://${await lanAddress()}:8798`
      : "http://127.0.0.1:8798";
  const metroEnv = {
    ...process.env,
    ONE_MAP_SMOKE: "tf05",
    TF05_BASE: fixtureBase,
  };

  if (platform === "android") {
    metroArgs.push("--host", "0.0.0.0");
  }

  const metro = spawn("bun", metroArgs, {
    cwd: shell,
    env: metroEnv,
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
        { cwd: shell, env: metroEnv },
        600000
      );
      const address = await lanAddress();

      await writeDebugHost(applicationId, `${address}:8081`);
      await command("adb", ["logcat", "-c"]);
      await startAndroidApp(applicationId);
      await allowNearbyDevices();

      const status = await watchNative({ readStatus: readAndroidStatus });

      return judge(status);
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
      { cwd: shell, env: metroEnv },
      600000
    );

    const status = await watchNative({
      readStatus: () => statusPort.read(),
      timeout: 600000,
    });

    return judge(status);
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      log: metroLog.slice(-1500),
    };
  } finally {
    await build.catch(() => undefined);

    if (platform === "ios") {
      await command("xcrun", [
        "simctl",
        "terminate",
        "booted",
        applicationId,
      ]).catch(() => undefined);
    }

    await statusPort?.close();
    metro.kill("SIGTERM");
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
    .find((entry) => entry.includes("TF05 "));

  if (!line) {
    return "";
  }

  const start = line.indexOf("TF05 ");

  return line.slice(start).split('"')[0].trim();
}

function judge(status) {
  const fields = Object.fromEntries(
    status
      .split(" ")
      .map((part) => part.split("="))
      .filter((part) => part.length === 2)
  );
  const passed =
    fields.mounted === "1" &&
    fields.reset === "ok" &&
    fields.data === "updated" &&
    fields.style === "rebuilt" &&
    fields.removed === "clean" &&
    fields.error === "none" &&
    fields.done === "1";

  return { status: passed ? "passed" : "failed", line: status, fields };
}

function encodeEmptyVectorTile(name, extent, version) {
  const layer = Buffer.concat([
    protoString(1, name),
    protoUint32(5, extent),
    protoUint32(15, version),
  ]);

  return protoLength(3, layer);
}

function protoKey(field, wire) {
  return protoVarint((field << 3) | wire);
}

function protoVarint(value) {
  const bytes = [];
  let remaining = value;

  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }

  bytes.push(remaining);
  return Buffer.from(bytes);
}

function protoUint32(field, value) {
  return Buffer.concat([protoKey(field, 0), protoVarint(value)]);
}

function protoString(field, text) {
  const data = Buffer.from(text, "utf8");
  return Buffer.concat([protoKey(field, 2), protoVarint(data.length), data]);
}

function protoLength(field, payload) {
  return Buffer.concat([
    protoKey(field, 2),
    protoVarint(payload.length),
    payload,
  ]);
}

// One empty MVT layer named "land". Version is required; Mapbox iOS also
// requires extent (the spec default of 4096). The path is versioned so a
// previous invalid tile is not reused from the renderer cache.
const emptyVectorTile = encodeEmptyVectorTile("land", 4096, 2);

// The scenario loads real images and tiles so renderers draw the sources.
// TileJSON URLs echo the request Host, so the Android LAN address and the
// loopback addresses all receive reachable tile URLs.
async function startFixtureServer() {
  const pixel = pngPixel([220, 38, 38, 255]);
  let holdResources = false;
  const heldResponses = new Set();
  const sendResource = (response, contentType, body) => {
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    });
    response.end(body);
  };
  const server = createServer((request, response) => {
    const origin = `http://${request.headers.host ?? "127.0.0.1:8798"}`;
    const cors = { "Access-Control-Allow-Origin": "*" };
    const url = request.url?.split("?")[0] ?? "/";

    if (url === "/hold/reset" || url === "/hold/release") {
      holdResources = url === "/hold/reset";
      if (!holdResources) {
        for (const resource of heldResponses) {
          sendResource(resource.response, resource.contentType, resource.body);
        }
        heldResponses.clear();
      }
      sendResource(response, "text/plain", "ok");
      return;
    }

    if (url === "/held-points.geojson" || url === "/held-marker.png") {
      const image = url === "/held-marker.png";
      const resource = {
        response,
        contentType: image ? "image/png" : "application/json",
        body: image
          ? pixel
          : JSON.stringify({ type: "FeatureCollection", features: [] }),
      };
      if (holdResources) {
        heldResponses.add(resource);
        response.once("close", () => heldResponses.delete(resource));
      } else {
        sendResource(response, resource.contentType, resource.body);
      }
      return;
    }

    if (url === "/delayed-style.json") {
      setTimeout(() => {
        response.writeHead(200, {
          ...cors,
          "Content-Type": "application/json",
        });
        response.end(
          JSON.stringify({
            version: 8,
            sources: {},
            layers: [
              {
                id: "replacement-background",
                type: "background",
                paint: { "background-color": "#f8fafc" },
              },
            ],
          })
        );
      }, 1500);
      return;
    }
    if (url === "/delayed-marker.png") {
      setTimeout(() => {
        response.writeHead(200, { ...cors, "Content-Type": "image/png" });
        response.end(pixel);
      }, 3500);
      return;
    }

    if (url === "/tiles.json") {
      response.writeHead(200, { ...cors, "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          tilejson: "2.2.0",
          name: "tf05-vector",
          bounds: [-122.6, 47.3, -122.0, 47.9],
          minzoom: 0,
          maxzoom: 14,
          tiles: [`${origin}/vt/{z}/{x}/{y}.pbf`],
        })
      );
      return;
    }

    if (url === "/raster.json") {
      response.writeHead(200, { ...cors, "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          tilejson: "2.2.0",
          name: "tf05-raster",
          bounds: [-122.6, 47.3, -122.0, 47.9],
          minzoom: 0,
          maxzoom: 14,
          tileSize: 256,
          tiles: [`${origin}/r/{z}/{x}/{y}.png`],
        })
      );
      return;
    }

    if (url.startsWith("/vt/") || url.startsWith("/v/")) {
      response.writeHead(200, {
        ...cors,
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "no-store",
      });
      response.end(emptyVectorTile);
      return;
    }

    if (
      url === "/marker.png" ||
      url === "/overlay.png" ||
      url.startsWith("/r/")
    ) {
      response.writeHead(200, { ...cors, "Content-Type": "image/png" });
      response.end(pixel);
      return;
    }

    response.writeHead(404, cors);
    response.end("not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(8798, "0.0.0.0", resolve);
  });

  return {
    close: () =>
      new Promise((done) => {
        server.close(done);
      }),
  };
}

function pngPixel(rgba) {
  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.from([0, ...rgba]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

const crcTable = Array.from({ length: 256 }, (_, entry) => {
  let value = entry;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
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

  for (const pid of listed.split("\n").filter(Boolean)) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // The process can exit between the listing and the signal.
    }
  }

  await delay(500);
}

const runWebCorrections = async (page) => {
  const renderer = "window.__oneMapCorrectionRenderer";
  const observe = async (expression, label, timeout = 10000) => {
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
  const hold = (action) =>
    page.evaluate(
      `fetch("http://127.0.0.1:8798/hold/${action}").then(response => { if (!response.ok) throw new Error("Fixture gate failed"); return response.text(); })`
    );
  await observe(
    `${renderer}?.isStyleLoaded() === true`,
    "initial style",
    20000
  );
  // Instrument only completion of the real renderer's image load, after decode.
  await page.evaluate(`(() => {
    const map = ${renderer};
    const original = map.loadImage;
    window.__oneMapOriginalImageLoad = original;
    window.__oneMapImageStarted = false;
    window.__oneMapImageSettled = false;
    map.loadImage = function(url, callback) {
      window.__oneMapImageStarted = true;
      if (callback) return original.call(this, url, (error, image) => { callback(error, image); requestAnimationFrame(() => { window.__oneMapImageSettled = true; }); });
      return original.call(this, url).finally(() => { requestAnimationFrame(() => { window.__oneMapImageSettled = true; }); });
    };
  })()`);
  await click("image-start");
  await observe("window.__oneMapImageStarted === true", "image load started");
  await hold("reset");
  await click("resource-start");
  await observe(
    `${renderer}.isStyleLoaded() !== true && window.__oneMapImageSettled === false`,
    "style loading during pending image"
  );
  await click("image-remove");
  await hold("release");
  await observe(
    `${renderer}.isStyleLoaded() === true && window.__oneMapImageSettled === true`,
    "style and removed load settle"
  );
  if (await page.evaluate(`${renderer}.hasImage("delayed")`))
    throw new Error("Removed pending image registered after completion");
  await click("resource-stop");
  await observe(
    `${renderer}.getSource("held-loading-source") == null`,
    "first held resource released"
  );

  await click("image-register");
  await observe(`${renderer}.hasImage("owned")`, "registered owned image");
  await hold("reset");
  await click("resource-start");
  await observe(
    `${renderer}.hasImage("owned") && ${renderer}.isStyleLoaded() === false`,
    "owned image present while same style loads"
  );
  await page.evaluate(`void (window.__oneMapPreviousRenderer = ${renderer})`);
  await click("map-toggle");
  await observe(
    `!${renderer} && window.__oneMapPreviousRenderer.hasImage("owned") === false`,
    "loading-style unmount removes owned image"
  );
  await hold("release");
  await click("map-toggle");
  await observe(
    `${renderer} === window.__oneMapPreviousRenderer && ${renderer}.isStyleLoaded() === true && ${renderer}.hasImage("owned") === false`,
    "same renderer reuse keeps owned image absent",
    20000
  );

  await hold("reset");
  await page.evaluate(
    "window.__oneMapImageStarted = false; window.__oneMapImageSettled = false"
  );
  await click("image-held");
  await observe(
    "window.__oneMapImageStarted && !window.__oneMapImageSettled",
    "held image decode starts"
  );
  await click("resource-start");
  await observe(
    `${renderer}.isStyleLoaded() === false && !window.__oneMapImageSettled`,
    "pending image during loading style"
  );
  await click("map-toggle");
  await observe(`!${renderer}`, "pending image session released");
  await click("map-toggle");
  await observe(
    `${renderer} === window.__oneMapPreviousRenderer && ${renderer}.isStyleLoaded() === true`,
    "renderer reused before old decode completes",
    20000
  );
  await hold("release");
  await observe("window.__oneMapImageSettled", "released image decode settles");
  if (await page.evaluate(`${renderer}.hasImage("held")`))
    throw new Error("Released image load registered on reused renderer");
  await page.evaluate(
    `void (${renderer}.loadImage = window.__oneMapOriginalImageLoad)`
  );

  return {
    status: "passed",
    scenarios: [
      "pending image removal during style loading",
      "owned image removal during same-style loading",
      "owned image absence after renderer reuse",
      "late image load cannot register after session release/reuse",
    ],
    mode: "real automation",
  };
};

await main();
