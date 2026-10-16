import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { stopOwnedProcess } from "./native-smoke-process.mjs";
import { terrainPng } from "./tf09-rendering-fixture.mjs";

const root = resolve(import.meta.dirname, "..");
const [platform, engine] = process.argv.slice(2);
assert(
  ["web", "ios", "android"].includes(platform),
  "Choose web, ios or android."
);
assert(["mapbox", "maplibre"].includes(engine), "Choose mapbox or maplibre.");
assert(process.env.TF09_OUTPUT, "Set TF09_OUTPUT to a temporary result file.");
assert(
  process.env.TF09_LIBRARY_SHA256,
  "Set TF09_LIBRARY_SHA256 to the frozen dist digest."
);
if (platform !== "web")
  assert(
    process.env.TF09_NATIVE_IDENTITY,
    "Set TF09_NATIVE_IDENTITY to independently verified installed binary identity; build/install is a separate authorized preparation step."
  );
const temporary = mkdtempSync(join(tmpdir(), "one-map-rendering-"));
const children = [];
const outcomes = [];
let currentCommand = {};
const replies = new Map();
let page;
let server;

/** Hashes sorted files using the same path/content convention as the service harness. */
const digest = (directory) => {
  const hash = createHash("sha256");
  const visit = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) visit(path);
      else {
        hash.update(path.slice(directory.length));
        hash.update(readFileSync(path));
      }
    }
  };
  visit(directory);
  return hash.digest("hex");
};

/** Bounded observation, tolerating transport startup while the app loads. */
const until = async (observe, timeoutMs = 45000) => {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      if (await observe()) return;
    } catch (error) {
      last = error;
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw last ?? new Error("Rendering observation timed out.");
};

const start = (file, args, cwd = root) => {
  const child = spawn(file, args, {
    cwd,
    env: { ...process.env, ONE_MAP_SMOKE_CACHE_ROOT: temporary },
    stdio: "ignore",
    detached: true,
  });
  children.push(child);
  return child;
};

const serve = async () => {
  const tile = terrainPng();
  server = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    if (request.url?.startsWith("/dem/")) {
      response.setHeader("Content-Type", "image/png");
      response.end(tile);
      return;
    }
    if (request.url === "/command") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(currentCommand));
      return;
    }
    if (request.url === "/result" && request.method === "POST") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const result = JSON.parse(Buffer.concat(chunks).toString());
      replies.set(result.id, result);
      response.end("ok");
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(8798, "127.0.0.1", done);
  });
};

const action = async (name, value = {}) => {
  if (page)
    return page.evaluate(
      `window.__oneMapTf09.command(${JSON.stringify(name)}, ${JSON.stringify(value)})`,
      true
    );
  const id = randomUUID();
  currentCommand = {
    id,
    environment: `${engine}-${platform}`,
    action: name,
    value,
  };
  await until(() => replies.has(id), 60000);
  const reply = replies.get(id);
  replies.delete(id);
  if (reply.error) throw new Error(reply.error);
  return reply.result;
};

/** Decodes actual captured renderer output for independent pixel assertions. */
const decodeCapture = async () => {
  const image = await action("capture");
  assert(image.uri.startsWith("data:image/png;base64,"));
  const { createRequire } = await import("node:module");
  assert(
    process.env.TF09_RUNTIME_NODE_MODULES,
    "Set TF09_RUNTIME_NODE_MODULES for PNG inspection."
  );
  const { PNG } = createRequire(
    join(process.env.TF09_RUNTIME_NODE_MODULES, "package.json")
  )("pngjs");
  return PNG.sync.read(Buffer.from(image.uri.split(",")[1], "base64"));
};

const pixelDifference = (left, right) => {
  assert.equal(left.data.length, right.data.length);
  let changed = 0;
  for (let i = 0; i < left.data.length; i += 4)
    if (
      Math.abs(left.data[i] - right.data[i]) +
        Math.abs(left.data[i + 1] - right.data[i + 1]) +
        Math.abs(left.data[i + 2] - right.data[i + 2]) >
      30
    )
      changed += 1;
  return changed;
};

const countPixels = (image, matches) => {
  let count = 0;
  for (let i = 0; i < image.data.length; i += 4)
    if (matches(image.data[i], image.data[i + 1], image.data[i + 2]))
      count += 1;
  return count;
};

const launchWeb = async () => {
  const port = Number(
    process.env.TF09_WEB_PORT ?? (engine === "mapbox" ? 4291 : 4292)
  );
  const base = `http://127.0.0.1:${port}`;
  start(
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
    join(root, `examples/web-${engine}`)
  );
  await until(async () => (await fetch(base)).ok, 30000);
  start("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    `--remote-debugging-port=${port + 1000}`,
    `--user-data-dir=${join(temporary, "profile")}`,
    "--window-size=1280,800",
    "--no-first-run",
    `${base}/?tf09=rendering`,
  ]);
  let target;
  await until(async () => {
    const tabs = await fetch(`http://127.0.0.1:${port + 1000}/json/list`).then(
      (response) => response.json()
    );
    target = tabs.find((tab) => tab.url.includes("tf09=rendering"));
    return !!target?.webSocketDebuggerUrl;
  });
  page = await connect(target.webSocketDebuggerUrl);
  await until(async () => page.evaluate("!!window.__oneMapTf09"));
};
const connect = (url) =>
  new Promise((done, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let sequence = 0;
    const send = (method, params = {}) =>
      new Promise((resolveCall, rejectCall) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectCall(new Error(`${method} timed out.`));
        }, 45000);
        pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    socket.addEventListener("open", () =>
      done({
        send,
        evaluate: async (expression, awaitPromise = false) => {
          const result = await send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise,
          });
          if (result.exceptionDetails)
            throw new Error(
              String(
                result.exceptionDetails.exception?.description ??
                  "Browser probe rejected."
              )
            );
          return result.result?.value;
        },
        close: () => socket.close(),
      })
    );
    socket.addEventListener("error", () =>
      reject(new Error("Browser debugger unavailable."))
    );
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      clearTimeout(waiting.timer);
      if (message.error)
        waiting.reject(new Error(String(message.error.message)));
      else waiting.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const waiting of pending.values()) {
        clearTimeout(waiting.timer);
        waiting.reject(new Error("Browser debugger closed."));
      }
      pending.clear();
    });
  });

/** Runs one independent readback scenario and retains only its compact result. */
const scenario = async (name, run) => {
  try {
    outcomes.push({ name, status: "passed", observation: await run() });
  } catch (error) {
    outcomes.push({ name, status: "failed", error: String(error) });
    throw error;
  }
};

try {
  assert.equal(
    digest(join(root, "packages/one-map-react/dist")),
    process.env.TF09_LIBRARY_SHA256,
    "Frozen library changed."
  );
  const shell = join(
    root,
    `examples/${platform === "web" ? "web" : "native"}-${engine}`
  );
  assert.equal(
    digest(join(shell, "node_modules/one-map-react/dist")),
    process.env.TF09_LIBRARY_SHA256,
    "Example has a different library copy."
  );
  if (platform !== "web") {
    const peer =
      engine === "mapbox"
        ? "@rnmapbox/maps"
        : "@maplibre/maplibre-react-native";
    const evidence = JSON.parse(
      readFileSync(
        process.env.TF09_PEER_EVIDENCE ??
          join(root, "records/evidence/tf09-implementation.json"),
        "utf8"
      )
    );
    for (const file of evidence.nativePeerDeltaVsHead[peer])
      assert.equal(
        createHash("sha256")
          .update(readFileSync(join(shell, "node_modules", peer, file.path)))
          .digest("hex"),
        file.sha256,
        `Native peer file is stale: ${file.path}`
      );
  }
  await serve();
  if (platform === "web") await launchWeb();
  await scenario("known rendered feature and initial no-data", async () => {
    let read;
    await until(async () => {
      read = await action("read");
      assert(
        read.loads > 0 &&
          read.features.some((feature) => Number(feature.id) === 9009),
        `Initial renderer not observed: ${JSON.stringify({
          loads: read.loads,
          styleLoads: read.styleLoads,
          center: read.center,
          zoom: read.zoom,
          featureIds: read.features.map((feature) => feature.id),
          elevation: read.elevation,
        })}`
      );
      return true;
    }, 90000);
    if (platform !== "web" && engine === "maplibre")
      assert.match(read.unsupported, /unsupported/);
    else assert.equal(read.elevation, null);
    let light;
    if (page)
      await until(async () => {
        light = await page.evaluate("window.__oneMapTf09Inspect?.().light");
        return light?.anchor === "map" && light?.intensity === 0.5;
      });
    return {
      loads: read.loads,
      featureIds: read.features.map((feature) => feature.id),
      elevation: read.elevation,
      unsupported: read.unsupported,
      light,
    };
  });
  if (platform === "web" || engine === "mapbox") {
    await scenario(
      "terrain enabled before delayed DEM attachment",
      async () => {
        await action("configure", { terrain: true });
        await action("configure", { terrain: true, dem: true });
        let read;
        await until(async () => {
          read = await action("read");
          return (
            typeof read.elevation === "number" &&
            Math.abs(read.elevation - 2000) < 5
          );
        });
        return { elevation: read.elevation, expectedMeters: 2000 };
      }
    );
    await scenario("explicit terrain clear and projection change", async () => {
      await action("configure", { dem: true, globe: true });
      await until(async () => (await action("read")).elevation === null);
      await action("configure", { dem: true, terrain: true });
      await until(
        async () => Math.abs((await action("read")).elevation - 2000) < 5
      );
      const previousStyleLoads = (await action("read")).styleLoads;
      await action("replace-style");
      await until(
        async () => (await action("read")).styleLoads > previousStyleLoads
      );
      await until(
        async () => Math.abs((await action("read")).elevation - 2000) < 5
      );
      return { elevation: (await action("read")).elevation };
    });
  } else await action("configure", { dem: true });
  if (platform === "web") {
    await scenario("named selected renderer facilities", async () => {
      const result = await action("named");
      assert.deepEqual(result.tf10.dragPan, {
        before: true,
        disabled: false,
        restored: true,
      });
      for (const field of ["source", "layer", "canvas", "styleLayer"])
        assert.equal(result.tf10[field], true, `TF10 selected ${field}`);
      assert.equal(
        result.tf10.eventCalls,
        1,
        "TF10 on/fire/off removes its listener"
      );
      if (engine === "mapbox") {
        assert.equal(result.scale, 1.2);
        assert(result.rain);
        assert(result.snow);
      } else {
        assert.equal(result.globalState["rendering-fixture"], 9009);
        assert(result.sky);
      }
      return result;
    });
    await scenario(
      "selected canvas/video/custom insertion, mutable coordinates and teardown",
      async () => {
        await until(async () =>
          page.evaluate("window.__oneMapTf09Media?.().ready")
        );
        await action("configure", { dem: false });
        await action("media", { enabled: true });
        let inspected;
        await until(async () => {
          inspected = await page.evaluate("window.__oneMapTf09Inspect?.()");
          return inspected?.canvas && inspected?.video && inspected?.custom;
        });
        await until(async () =>
          page.evaluate("window.__oneMapTf09Media().frames > 0")
        );
        let blue = 0;
        let green = 0;
        let magenta = 0;
        await until(async () => {
          const image = await decodeCapture();
          blue = countPixels(
            image,
            (r, g, b) => r < 70 && g > 70 && g < 150 && b > 220
          );
          green = countPixels(
            image,
            (r, g, b) => r < 50 && g > 200 && b > 70 && b < 180
          );
          magenta = countPixels(
            image,
            (r, g, b) => r > 220 && g < 40 && b > 220
          );
          assert(
            blue > 100 && green > 100 && magenta > 100,
            `Media/custom output missing: canvas=${blue}, video=${green}, custom=${magenta}; state=${JSON.stringify(await page.evaluate("window.__oneMapTf09Inspect?.().videoState"))}.`
          );
          return true;
        });
        await action("media", { enabled: true, moved: true });
        await until(async () => {
          inspected = await page.evaluate("window.__oneMapTf09Inspect?.()");
          return inspected?.canvasCoordinates?.coordinates?.[0]?.[0] === 5;
        });
        await action("media", { enabled: false });
        await until(async () => {
          inspected = await page.evaluate("window.__oneMapTf09Inspect?.()");
          return !inspected?.canvas && !inspected?.video && !inspected?.custom;
        });
        const counts = await page.evaluate("window.__oneMapTf09Media()");
        assert.equal(counts.added, counts.removed);
        return {
          canvasBluePixels: blue,
          videoGreenPixels: green,
          magentaPixels: magenta,
          callbacks: counts,
        };
      }
    );
  }
  await scenario("hillshade draws the fixture's slope patch", async () => {
    await action("configure", { dem: true, shade: false });
    let baseline;
    await until(async () => {
      baseline = await decodeCapture();
      // iOS view snapshots encode the background as 30/49/75 rather than web sRGB 23/50/77.
      const tolerance = platform === "ios" ? 12 : 3;
      const blue = countPixels(
        baseline,
        (r, g, b) =>
          Math.abs(r - 23) < tolerance &&
          Math.abs(g - 50) < tolerance &&
          Math.abs(b - 77) < tolerance
      );
      assert(
        blue > baseline.width * baseline.height * 0.95,
        `Hillshade baseline not flat: blue=${blue}/${baseline.width * baseline.height}, corner=${[...baseline.data.subarray(0, 4)]}.`
      );
      return true;
    });
    await action("configure", { dem: true, shade: true });
    let shaded;
    await until(async () => {
      shaded = await decodeCapture();
      const changed = pixelDifference(shaded, baseline);
      assert(
        changed > 100,
        `Hillshade insertion changed only ${changed} pixels.`
      );
      return true;
    });
    await action("configure", { dem: true, shade: false });
    let flat;
    let changed = 0;
    await until(async () => {
      flat = await decodeCapture();
      assert.equal(flat.data.length, shaded.data.length);
      changed = pixelDifference(flat, shaded);
      assert(
        changed > 100,
        `Hillshade removal changed only ${changed} pixels.`
      );
      return true;
    });
    assert(
      changed > 100,
      "Hillshade insertion/removal did not alter renderer output."
    );
    return { changedPixels: changed };
  });
  if (platform === "web" || engine === "mapbox")
    await scenario(
      "globe projection has independently different viewport output",
      async () => {
        await action("projection-view", { globe: false });
        const mercator = await decodeCapture();
        await action("projection-view", { globe: true });
        if (page)
          await until(async () => {
            const read = await page.evaluate("window.__oneMapTf09Inspect?.()");
            return (
              (read?.projection?.type ?? read?.projection?.name) === "globe"
            );
          });
        let globe;
        let changed = 0;
        await until(async () => {
          globe = await decodeCapture();
          changed = pixelDifference(globe, mercator);
          return changed > 200;
        });
        assert(
          changed > 200,
          "Projection switch did not change the rendered viewport."
        );
        const projectionReadback = page
          ? await page.evaluate("window.__oneMapTf09Inspect?.().projection")
          : "native pixel comparison";
        await action("projection-view", { globe: false });
        return { changedPixels: changed, projectionReadback };
      }
    );
  await scenario(
    "rendered output contains the known orange feature",
    async () => {
      let png;
      let orange = 0;
      await until(async () => {
        png = await decodeCapture();
        orange = countPixels(
          png,
          (r, g, b) => r > 220 && g > 45 && g < 140 && b < 60
        );
        assert(orange > 30, `Known feature not observed: orange=${orange}.`);
        return true;
      });
      return { width: png.width, height: png.height, orangePixels: orange };
    }
  );
} catch (error) {
  process.exitCode = 1;
  console.error(String(error));
} finally {
  writeFileSync(
    process.env.TF09_OUTPUT,
    JSON.stringify(
      {
        scope:
          "targeted terrain/projection/light/hillshade integration; advanced extension acceptance remains separately enumerated",
        platform,
        engine,
        artifact: process.env.TF09_LIBRARY_SHA256,
        nativeIdentity: process.env.TF09_NATIVE_IDENTITY,
        outcomes,
      },
      null,
      2
    )
  );
  page?.close();
  await new Promise((done) => (server ? server.close(done) : done()));
  for (const child of children.reverse()) await stopOwnedProcess(child);
  rmSync(temporary, { recursive: true, force: true });
}
