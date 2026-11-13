import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  hasInvalidTextChildren,
  mapPixelSummary,
  redactWorkspaceDiagnostic,
  workspaceWebPorts,
} from "./example-workspace-observations.mjs";
import { stopOwnedProcess } from "./native-smoke-process.mjs";

const kind = process.argv[2];
const ports = workspaceWebPorts(kind);
const appURL = `http://${kind === "expo-web" ? "localhost" : "127.0.0.1"}:${ports.app}`;
const root = resolve(process.env.EXAMPLE_ROOT ?? "");
const output = process.env.EXAMPLE_OUTPUT;
assert(
  root.endsWith(`/one-map-workspace-acceptance/${kind}`),
  "Use the prepared isolated workspace root."
);
assert(
  output && !existsSync(output),
  "Set a fresh EXAMPLE_OUTPUT; prior attempts must remain intact."
);
assert(
  process.env.EXAMPLE_RUNTIME_NODE_MODULES,
  "Set the existing browser/PNG runtime path."
);
const runtime = createRequire(
  join(process.env.EXAMPLE_RUNTIME_NODE_MODULES, "package.json")
);
const { chromium } = runtime("playwright");
const { PNG } = runtime("pngjs");
const { cameraMatches, initialCamera } = await import(
  pathToFileURL(join(root, "packages/example-map/dist/camera.js"))
);
const base = dirname(root);
const style = readFileSync(join(base, "style.json"));
const originalEnvironment = { ...process.env };
process.loadEnvFile(join(root, ".env.local"));
const token = process.env.MAPBOX_ACCESS_TOKEN;
assert(
  token?.startsWith("pk."),
  "A configured public token is required for the Mapbox scope."
);
const outcomes = [],
  requests = [],
  diagnostics = [];
const startedAt = new Date().toISOString();
let badStyle = false,
  child,
  context,
  page;
const service = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "no-store");
  if (request.url?.startsWith("/style.json")) {
    const delayMs = requests.length === 0 ? 12000 : 0;
    requests.push({
      status: badStyle ? 503 : 200,
      delayMs,
      at: new Date().toISOString(),
    });
    response.writeHead(badStyle ? 503 : 200, {
      "Content-Type": "application/json",
    });
    const body = badStyle
      ? JSON.stringify({ error: "Deliberate workspace acceptance failure" })
      : style;
    // A cold resource load beyond the old ten-second deadline must still succeed.
    setTimeout(() => response.end(body), delayMs);
    return;
  }
  response.writeHead(404).end();
});
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (observe, label, timeoutMs = 45000) => {
  let last;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await observe();
      if (result) return result;
    } catch (error) {
      last = error;
    }
    if (child?.exitCode !== null && child?.exitCode !== undefined)
      throw new Error(`App server exited ${child.exitCode}`);
    await pause(200);
  }
  throw last ?? new Error(`${label} timed out.`);
};
const scenario = async (name, run) => {
  const at = new Date().toISOString();
  try {
    const observation = await run();
    outcomes.push({ name, status: "passed", startedAt: at, observation });
  } catch (error) {
    outcomes.push({
      name,
      status: "failed",
      startedAt: at,
      error: redactWorkspaceDiagnostic(error),
    });
    throw error;
  }
};
const startApp = async (enabled) => {
  const shell = join(root, "apps", kind === "vite" ? "web" : "expo");
  const command =
    kind === "vite"
      ? [
          "bun",
          "run",
          "dev",
          "--",
          "--port",
          String(ports.app),
          "--host",
          "127.0.0.1",
        ]
      : [
          "node",
          join(shell, "node_modules/expo/bin/cli"),
          "start",
          "--web",
          "--localhost",
          "--port",
          String(ports.app),
        ];
  const log = `${output}.${enabled ? "token" : "no-token"}.server.log`;
  const { openSync, closeSync } = await import("node:fs");
  const sink = openSync(log, "w");
  try {
    child = spawn(command[0], command.slice(1), {
      cwd: shell,
      env: {
        ...originalEnvironment,
        BROWSER: "none",
        CI: "1",
        EXPO_NO_TELEMETRY: "1",
        EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: enabled ? token : "",
        EXPO_PUBLIC_ONE_MAP_TEST_MODE: "1",
      },
      stdio: ["ignore", sink, sink],
      detached: true,
    });
  } finally {
    closeSync(sink);
  }
  diagnostics.push({ command, cwd: shell, tokenEnabled: enabled, log });
  await until(
    async () =>
      (
        await fetch(appURL, {
          signal: AbortSignal.timeout(5000),
        })
      ).ok,
    "app server",
    120000
  );
};
const openPage = async (label) => {
  const profile = `${output}.${label}.browser`;
  context = await chromium.launchPersistentContext(profile, {
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [`--remote-debugging-port=${ports.debugger}`, "--no-first-run"],
  });
  page = context.pages()[0] ?? (await context.newPage());
  page.on("pageerror", (error) =>
    diagnostics.push({ pageError: redactWorkspaceDiagnostic(error) })
  );
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      diagnostics.push({
        console: message.type(),
        message: redactWorkspaceDiagnostic(message.text()),
      });
  });
  await page.goto(`${appURL}/?test=1`, {
    waitUntil: "domcontentloaded",
  });
};
const status = async (expected) =>
  until(
    async () =>
      (await page.getByTestId("map-status").textContent())?.trim() === expected,
    `map ${expected}`
  );
const camera = async (expected) => {
  await page.getByRole("button", { name: "Read camera", exact: true }).click();
  return until(async () => {
    const read = JSON.parse(
      await page.getByTestId("camera-readback").textContent()
    );
    assert(
      [
        read.longitude,
        read.latitude,
        read.zoom,
        read.bearing,
        read.pitch,
      ].every(Number.isFinite)
    );
    if (expected)
      assert(
        cameraMatches(read, expected),
        `Camera mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(read)}`
      );
    return read;
  }, "camera readback");
};
const settledCamera = async () => {
  let previous,
    stableSamples = 0;
  return until(async () => {
    const read = await camera();
    stableSamples =
      previous && cameraMatches(read, previous) ? stableSamples + 1 : 0;
    previous = read;
    return stableSamples >= 3 ? read : false;
  }, "settled gesture camera");
};
const mapImage = async (label) => {
  let bytes, summary;
  await until(async () => {
    bytes = await page.screenshot();
    summary = mapPixelSummary(PNG.sync.read(bytes));
    return summary.colors > 30 && summary.samples > 1000;
  }, "rendered basemap detail");
  const path = `${output}.${label}.png`;
  writeFileSync(path, bytes);
  return {
    ...summary,
    screenshot: path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
};
const switchTo = async (engine, expected) => {
  const before = Number(await page.getByTestId("map-generation").textContent());
  await page
    .getByRole("button", {
      name: new RegExp(
        `^${engine === "mapbox" ? "Mapbox" : "MapLibre"}(?: \\(selected\\))?$`
      ),
    })
    .click();
  await until(
    async () =>
      Number(await page.getByTestId("map-generation").textContent()) ===
      before + 1,
    "replacement map generation"
  );
  await status("ready");
  const after = Number(await page.getByTestId("map-generation").textContent());
  assert.equal(after, before + 1);
  return { engine, generation: after, camera: await camera(expected) };
};
const closeBrowser = async () => {
  await context?.close();
  context = undefined;
  page = undefined;
};
try {
  await new Promise((done, reject) => {
    service.once("error", reject);
    service.listen(ports.fixture, "127.0.0.1", done);
  });
  await startApp(false);
  await openPage("no-token");
  await scenario(
    "token-free MapLibre Seattle startup and disabled Mapbox",
    async () => {
      await status("ready");
      const read = await camera(initialCamera);
      assert(await page.getByRole("button", { name: /^Mapbox/ }).isDisabled());
      assert(
        (await page.locator("body").textContent()).includes(
          "Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN"
        )
      );
      return {
        camera: read,
        generation: Number(
          await page.getByTestId("map-generation").textContent()
        ),
        image: await mapImage("no-token-maplibre"),
      };
    }
  );
  await closeBrowser();
  await stopOwnedProcess(child);
  child = undefined;
  await startApp(true);
  await openPage("token");
  await scenario(
    "both web engines render and retain a changed camera",
    async () => {
      await status("ready");
      await camera(initialCamera);
      const libreImage = await mapImage("maplibre");
      await page.mouse.move(640, 600);
      await page.mouse.down();
      await page.mouse.move(790, 650, { steps: 12 });
      await page.mouse.up();
      await page
        .getByRole("button", { name: "Read camera", exact: true })
        .click();
      await until(async () => {
        const read = await camera();
        return !cameraMatches(read, initialCamera);
      }, "real pan");
      await page.mouse.move(640, 650);
      await page.mouse.down({ button: "right" });
      await page.mouse.move(800, 530, { steps: 12 });
      await page.mouse.up({ button: "right" });
      const pose = await settledCamera();
      diagnostics.push({ settledGestureCamera: pose });
      assert(
        Math.abs(pose.bearing) > 1 || pose.pitch > 1,
        "Real right-drag did not change orientation."
      );
      const box = await switchTo("mapbox", pose);
      const boxImage = await mapImage("mapbox");
      const libre = await switchTo("maplibre", pose);
      const repeated = [];
      for (const engine of ["mapbox", "maplibre", "mapbox", "maplibre"])
        repeated.push(await switchTo(engine, pose));
      await pause(1000);
      await status("ready");
      return {
        pose,
        maplibre: libre,
        mapbox: box,
        repeated,
        finalCamera: await camera(pose),
        images: { maplibre: libreImage, mapbox: boxImage },
      };
    }
  );
  await closeBrowser();
  badStyle = true;
  await openPage("recovery");
  for (const engine of ["maplibre", "mapbox"]) {
    await scenario(
      `${engine} actual style failure and retry recovery`,
      async () => {
        if (engine === "mapbox") {
          badStyle = true;
          await page.getByRole("button", { name: /^Mapbox/ }).click();
        }
        await status("error");
        const message = await page.getByRole("alert").textContent();
        assert(message.includes("could not load or restore"));
        assert(!message.includes(token), "Credential appeared in error UI.");
        badStyle = false;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await status("ready");
        return {
          camera: await camera(initialCamera),
          generation: Number(
            await page.getByTestId("map-generation").textContent()
          ),
          image: await mapImage(`${engine}-recovered`),
          message,
        };
      }
    );
  }
  assert(requests.some((request) => request.status === 503));
  assert(
    !diagnostics.some(
      ({ message }) => message && hasInvalidTextChildren(message)
    ),
    "Expo controls emitted invalid raw text children."
  );
} catch (error) {
  process.exitCode = 1;
  diagnostics.push({ error: redactWorkspaceDiagnostic(error.stack ?? error) });
  if (page)
    try {
      await page.screenshot({ path: `${output}.failure.png` });
    } catch {}
} finally {
  await closeBrowser();
  if (child) await stopOwnedProcess(child);
  service.closeAllConnections();
  await new Promise((done) => service.close(done));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        kind,
        status: process.exitCode ? "failed" : "passed",
        startedAt,
        finishedAt: new Date().toISOString(),
        root,
        ports,
        fixtureStyleSha256: createHash("sha256").update(style).digest("hex"),
        outcomes,
        requests,
        diagnostics,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      kind,
      status: process.exitCode ? "failed" : "passed",
      outcomes: outcomes.map(({ name, status }) => ({ name, status })),
      output,
    })
  );
}
