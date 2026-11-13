import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  redactWorkspaceDiagnostic,
  fixtureBackgroundVisible,
} from "./example-workspace-observations.mjs";
import { stopOwnedProcess } from "./native-smoke-process.mjs";
import { webShell, webScenarioUrl } from "./workspace-smoke-shell.mjs";

const engine = process.argv[2];
assert(["mapbox", "maplibre"].includes(engine));
const output = process.env.ONE_MAP_OUTPUT;
assert(output && !existsSync(output), "Set a fresh ONE_MAP_OUTPUT.");
assert(
  process.env.ONE_MAP_RUNTIME_NODE_MODULES,
  "Set the existing Playwright/PNG runtime path."
);
const runtime = createRequire(
  join(process.env.ONE_MAP_RUNTIME_NODE_MODULES, "package.json")
);
const { chromium } = runtime("playwright");
const { PNG } = runtime("pngjs");
const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "one-map-ui-extended-"));
const port = Number(
  process.env.ONE_MAP_WEB_PORT ?? (engine === "mapbox" ? 4189 : 4190)
);
const web = webShell(root, port);
const outcomes = [],
  diagnostics = [];
let app, browser, page;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (read, label, timeout = 45000) => {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value) return value;
    } catch (error) {
      lastError = String(error);
    }
    await pause(100);
  }
  throw new Error(`${label} timed out. ${lastError ?? ""}`);
};
const sameCenter = (a, b) =>
  a?.length === 2 &&
  b?.length === 2 &&
  a.every((value, index) => Math.abs(value - b[index]) < 0.0001);
const snapshot = async (name) => {
  const bytes = await page.screenshot(),
    path = `${output}.${name}.png`;
  writeFileSync(path, bytes);
  return { path, sha256: createHash("sha256").update(bytes).digest("hex") };
};
try {
  app = spawn(web.command, web.args, {
    cwd: web.cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [app.stdout, app.stderr])
    stream.on("data", (chunk) =>
      diagnostics.push(redactWorkspaceDiagnostic(chunk))
    );
  await until(async () => {
    try {
      return (await fetch(web.base, { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      return false;
    }
  }, "web startup");
  browser = await chromium.launchPersistentContext(join(temporary, "profile"), {
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  await browser.grantPermissions(["geolocation"]);
  await browser.setGeolocation({
    longitude: -122.33,
    latitude: 47.62,
    accuracy: 25,
  });
  page = await browser.newPage();
  const locationDriver = await browser.newCDPSession(page);
  await page.goto(webScenarioUrl(root, port, "tf07=ui", engine));
  const read = () => page.evaluate(() => window.__oneMapTf07?.read());
  await until(
    async () =>
      (await read())?.features.some((feature) => String(feature.id) === "707"),
    "known feature707"
  );
  const live = page.locator('[data-tf07="live"]');
  const child = page.locator('[data-tf07-child="live"]');
  const original = await live.boundingBox();
  assert(original);
  await page.locator('[data-tf07-action="offset"]').click();
  const shifted = await until(async () => {
    const box = await live.boundingBox();
    return box &&
      Math.abs(box.x - original.x - 24) < 3 &&
      Math.abs(box.y - original.y + 12) < 3
      ? box
      : false;
  }, "actual marker offset");
  const baseline = await read();
  await child.click();
  await until(async () => {
    const value = await read();
    return (
      value.events["child-click"] ===
        (baseline.events["child-click"] ?? 0) + 1 &&
      (value.events["map-click"] ?? 0) === (baseline.events["map-click"] ?? 0)
    );
  }, "offset child touch isolation");
  await page.locator('[data-tf07-action="offset"]').click();
  await until(async () => {
    const box = await live.boundingBox();
    return (
      box &&
      Math.abs(box.x - original.x) < 3 &&
      Math.abs(box.y - original.y) < 3
    );
  }, "zero offset reset");
  outcomes.push({
    name: "offset drawing, physical child touch and reset",
    status: "passed",
    original,
    shifted,
  });

  const popup = page.locator(".mapboxgl-popup,.maplibregl-popup").first();
  const popupBefore = await popup.boundingBox();
  assert(popupBefore);
  const canvas = page.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  assert(bounds);
  const beforePan = await read();
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.8
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.62,
    bounds.y + bounds.height * 0.85,
    { steps: 12 }
  );
  await page.mouse.up();
  await until(
    async () => !sameCenter((await read()).center, beforePan.center),
    "real map pan"
  );
  await until(async () => {
    const value = await popup.boundingBox();
    return (
      value && Math.hypot(value.x - popupBefore.x, value.y - popupBefore.y) > 10
    );
  }, "popup moves with map");
  const expected = await page.evaluate(() =>
    window.__oneMapTf07.project("popup")
  );
  const popupAfter = await popup.boundingBox();
  assert(popupAfter);
  const anchor = [bounds.x + expected[0], bounds.y + expected[1]];
  assert(
    anchor[0] >= popupAfter.x - 20 &&
      anchor[0] <= popupAfter.x + popupAfter.width + 20 &&
      anchor[1] >= popupAfter.y - 20 &&
      anchor[1] <= popupAfter.y + popupAfter.height + 20,
    "Popup detached from renderer-projected geographic anchor."
  );
  await page.locator('[data-tf07-child="popup"]').click();
  outcomes.push({
    name: "popup follows actual camera and retains child input",
    status: "passed",
    popupBefore,
    popupAfter,
    anchor,
  });

  const scale = page
    .locator(".mapboxgl-ctrl-scale,.maplibregl-ctrl-scale")
    .first();
  const metric = await scale.textContent();
  await page.locator('[data-tf07-action="units"]').click();
  const imperial = await until(async () => {
    const text = await scale.textContent();
    return text !== metric && /ft|mi/.test(text) ? text : false;
  }, "actual scale unit text");
  assert((await scale.boundingBox())?.width > 0);
  await page
    .locator(
      'button[aria-label="Locate me"],button.mapboxgl-ctrl-geolocate,button.maplibregl-ctrl-geolocate'
    )
    .first()
    .click();
  await until(async () => {
    const value = await read();
    return (
      value.events.location >= 1 && sameCenter(value.center, [-122.33, 47.62])
    );
  }, "geolocation camera readback");
  outcomes.push({
    name: "scale units and resolved geolocation",
    status: "passed",
    metric,
    imperial,
    readback: await read(),
  });

  await page.locator('[data-tf07-action="style"]').click();
  const fixture = JSON.parse(
    readFileSync(
      join(root, "packages/example-map/src/scenarios/map.json"),
      "utf8"
    )
  );
  const expectedHex = fixture.replacementStyle.layers.find(
    (layer) => layer.type === "background"
  ).paint["background-color"];
  await until(async () => {
    const image = PNG.sync.read(await page.screenshot());
    const box = await canvas.boundingBox();
    if (!box) return false;
    return (
      fixtureBackgroundVisible(image, box, expectedHex) &&
      (await read()).features.some((feature) => String(feature.id) === "707")
    );
  }, "rendered replacement background and restored source");

  // The portable scene has no DOM host attributes; the focused selected entry below verifies them.
  assert(await page.locator("#tf07-map-host canvas").isVisible());
  outcomes.push({
    name: "actual style replacement and source restoration",
    status: "passed",
    background: expectedHex,
    image: await snapshot("style"),
  });

  await page.goto(webScenarioUrl(root, port, "scenario=tf07-focused", engine));
  const focused = () => page.evaluate(() => window.__tf07Focused?.read());
  const configure = (action) =>
    page.evaluate((value) => window.__tf07Focused.configure(value), action);
  await until(async () => (await focused())?.load >= 1, "focused map load");
  assert(
    await page
      .getByRole("region", { name: "Focused acceptance map", exact: true })
      .isVisible()
  );
  const ax = await page
    .getByRole("region", { name: "Focused acceptance map", exact: true })
    .ariaSnapshot();
  assert(ax.includes("Focused acceptance map"));
  await page
    .getByRole("button", { name: /Enter fullscreen/i })
    .first()
    .click();
  await until(
    () => page.evaluate(() => Boolean(document.fullscreenElement)),
    "fullscreen entry"
  );
  await page
    .getByRole("button", { name: /Exit fullscreen/i })
    .first()
    .click();
  await until(
    () => page.evaluate(() => !document.fullscreenElement),
    "fullscreen exit"
  );
  outcomes.push({
    name: "selected host accessibility and physical fullscreen enter/exit",
    status: "passed",
    accessibility: ax,
  });

  const locate = () =>
    page
      .locator(
        'button[aria-label="Locate me"],button.mapboxgl-ctrl-geolocate,button.maplibregl-ctrl-geolocate'
      )
      .first();
  const initial = await focused();
  await locationDriver.send("Browser.setPermission", {
    permission: { name: "geolocation" },
    setting: "denied",
    origin: new URL(page.url()).origin,
  });
  await locate().click();
  await until(
    async () => (await focused()).error >= 1,
    "browser permission denial"
  );
  assert(sameCenter((await focused()).center, initial.center));
  await configure("remove");
  await until(
    async () => (await locate().count()) === 0,
    "location control removal"
  );
  await locationDriver.send("Browser.setPermission", {
    permission: { name: "geolocation" },
    setting: "granted",
    origin: new URL(page.url()).origin,
  });
  await configure("restore");
  await until(
    async () => (await locate().count()) === 1,
    "location control restoration"
  );
  await locate().click();
  await until(async () => {
    const value = await focused();
    return value.location === 1 && sameCenter(value.center, [-122.33, 47.62]);
  }, "selected browser location camera");
  await configure("theme");
  await until(
    async () =>
      (await page.locator("[data-focused-theme]").textContent()) === "updated",
    "sibling context update"
  );
  await page.locator("[data-focused-theme]").click();
  assert.equal((await focused()).clicks, 1);
  outcomes.push({
    name: "browser permission error and restored raw location; sibling provider update",
    status: "passed",
    initial,
    final: await focused(),
    image: await snapshot("focused"),
  });
  writeFileSync(
    output,
    JSON.stringify(
      {
        status: "passed",
        engine,
        shell: process.env.ONE_MAP_WEB_SHELL ?? "vite",
        outcomes,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ status: "passed", engine, outcomes }));
} catch (error) {
  writeFileSync(
    output,
    JSON.stringify(
      {
        status: "failed",
        engine,
        outcomes,
        error: String(error),
        diagnostics: diagnostics.slice(-12),
      },
      null,
      2
    )
  );
  throw error;
} finally {
  await browser?.close();
  await stopOwnedProcess(app);
  rmSync(temporary, { recursive: true, force: true });
}
