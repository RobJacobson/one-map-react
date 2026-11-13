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
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { nativeLifecyclePassed } from "./example-workspace-observations.mjs";
import { stopOwnedProcess } from "./native-smoke-process.mjs";
import {
  nativeEnvironment,
  nativeMetroArgs,
  launchNativeWorkspace,
  webShell,
  webScenarioUrl,
} from "./workspace-smoke-shell.mjs";

const [platform, engine] = process.argv.slice(2);
assert(["web", "ios", "android"].includes(platform));
assert(["mapbox", "maplibre"].includes(engine));
const output = process.env.ONE_MAP_OUTPUT;
assert(output && !existsSync(output), "Set a fresh ONE_MAP_OUTPUT.");
const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "one-map-lifecycle-"));
const outcomes = [];
let app, browser, fixture;
let log = "";
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (observe, label, timeout = 60000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await observe();
    if (value) return value;
    await pause(100);
  }
  throw new Error(`${label} timed out; ${log.slice(-1000)}`);
};
const start = (file, args, cwd, env = process.env) => {
  app = spawn(file, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [app.stdout, app.stderr])
    stream.on("data", (chunk) => {
      log += chunk.toString();
    });
};
try {
  if (platform === "web") {
    assert(
      process.env.ONE_MAP_RUNTIME_NODE_MODULES,
      "Set the existing Playwright runtime path."
    );
    const { chromium } = createRequire(
      join(process.env.ONE_MAP_RUNTIME_NODE_MODULES, "package.json")
    )("playwright");
    const port = Number(
      process.env.ONE_MAP_WEB_PORT ?? (engine === "mapbox" ? 4171 : 4172)
    );
    const web = webShell(root, port);
    start(web.command, web.args, web.cwd);
    await until(async () => {
      try {
        return (await fetch(web.base, { signal: AbortSignal.timeout(2000) }))
          .ok;
      } catch {
        return false;
      }
    }, "web startup");
    browser = await chromium.launchPersistentContext(
      join(temporary, "profile"),
      {
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: true,
        viewport: { width: 1280, height: 800 },
      }
    );
    const page = await browser.newPage();
    for (const mode of ["route", "reuse", "gl"]) {
      await page.goto(
        webScenarioUrl(root, port, `tf03=${mode}&auto=1`, engine)
      );
      const readStatus = () => page.locator("#tf03-status").textContent();
      await until(
        async () => /loads=[1-9]/.test(await readStatus()),
        "lifecycle load"
      );
      if (mode === "route") {
        const camera = () =>
          page.evaluate(() => window.__oneMapLifecycle.camera());
        const initial = await camera();
        assert(
          Math.abs(initial.longitude + 122.34) < 0.01 &&
            Math.abs(initial.latitude - 47.61) < 0.01
        );
        const features = await until(
          () => page.evaluate(() => window.__oneMapLifecycle.routeFeatures()),
          "rendered GeoJSON line"
        );
        await page
          .getByRole("button", { name: "Fly north", exact: true })
          .click();
        await until(async () => {
          const actual = await camera();
          return (
            Math.abs(actual.longitude + 122.32) < 0.005 &&
            Math.abs(actual.latitude - 47.64) < 0.005
          );
        }, "actual flight camera");
        await page
          .getByRole("button", { name: "Remount", exact: true })
          .click();
        await until(
          async () => /loads=2/.test(await readStatus()),
          "remount load"
        );
        await until(async () => {
          const actual = await camera();
          return (
            Math.abs(actual.longitude + 122.34) < 0.005 &&
            Math.abs(actual.latitude - 47.61) < 0.005
          );
        }, "remounted camera");
        outcomes.push({
          mode,
          status: "passed",
          features,
          initial,
          remounted: await camera(),
          line: await readStatus(),
        });
      } else {
        const line = await until(async () => {
          const value = await readStatus();
          return /done=1/.test(value) ? value : false;
        }, `${mode} replacement`);
        assert(/errors=0/.test(line) && /canvas=same/.test(line), line);
        if (mode === "gl") assert(/context=first/.test(line), line);
        outcomes.push({ mode, status: "passed", line });
      }
      const screenshot = `${output}.${mode}.png`;
      await page.screenshot({ path: screenshot });
      outcomes.at(-1).image = {
        path: screenshot,
        sha256: createHash("sha256")
          .update(readFileSync(screenshot))
          .digest("hex"),
      };
    }
  } else {
    fixture = createServer((_request, response) =>
      response.writeHead(404).end("missing test style")
    );
    await new Promise((done, reject) => {
      fixture.once("error", reject);
      fixture.listen(8798, "127.0.0.1", done);
    });
    start(
      "node",
      nativeMetroArgs(),
      join(root, "apps/expo"),
      nativeEnvironment(engine, "tf03")
    );
    await until(async () => {
      try {
        return (
          await fetch("http://127.0.0.1:8081/status", {
            signal: AbortSignal.timeout(2000),
          })
        ).ok;
      } catch {
        return false;
      }
    }, "Metro");
    launchNativeWorkspace({
      platform,
      iosDevice: process.env.ONE_MAP_ACCEPTANCE_IOS_UDID,
      fixturePorts: [8798],
    });
    const line = await until(
      () => log.match(/TF03 loads=\d+[^\n]*phase=done/g)?.at(-1),
      "native lifecycle",
      120000
    );
    assert(nativeLifecyclePassed(line), line);
    outcomes.push({ status: "passed", line });
  }
  writeFileSync(
    output,
    JSON.stringify({ status: "passed", platform, engine, outcomes }, null, 2)
  );
  console.log(JSON.stringify({ status: "passed", platform, engine, outcomes }));
} catch (error) {
  writeFileSync(
    output,
    JSON.stringify(
      { status: "failed", platform, engine, outcomes, error: String(error) },
      null,
      2
    )
  );
  throw error;
} finally {
  await browser?.close();
  await stopOwnedProcess(app);
  await new Promise((done) => (fixture ? fixture.close(done) : done()));
  rmSync(temporary, { recursive: true, force: true });
}
