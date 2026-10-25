import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stopOwnedProcess } from "./native-smoke-process.mjs";
import {
  captureInclusion,
  observeCoveragePixels,
} from "./tf08-final-observations.mjs";
import { withFusedLocationFixture } from "./tf08-fused-location-fixture.mjs";
import { observeFixturePixels } from "./tf08-image-observations.mjs";
import {
  assertMissingDatabaseRejection,
  readAndroidAppFile,
  unexpectedResetWarnings,
} from "./tf08-offline-observations.mjs";

const root = resolve(import.meta.dirname, "..");
const startedAt = new Date().toISOString();
const harnessSha256 = Object.fromEntries(
  [
    "scripts/tf08-services-smoke.mjs",
    "scripts/tf08-image-observations.mjs",
    "scripts/tf08-offline-observations.mjs",
    "scripts/tf08-fused-location-fixture.mjs",
    "examples/shared/tf08-acceptance-scene.tsx",
    "examples/shared/native-tf08-screen.tsx",
    "examples/shared/web-tf08-app.tsx",
    "examples/native-mapbox/App.tsx",
    "examples/native-maplibre/App.tsx",
    "scripts/ios-tap/TapDriverUITests/TapDriver.swift",
  ].map((file) => [
    file,
    createHash("sha256")
      .update(readFileSync(join(root, file)))
      .digest("hex"),
  ])
);
const [platform, engine] = process.argv.slice(2);
const scope = process.env.TF08_SCOPE ?? "all";
assert(
  [
    "all",
    "offline",
    "pending",
    "pending-reset",
    "pending-merge",
    "pending-repair",
    "pending-storage",
    "capture-coverage",
  ].includes(scope),
  "Select all, offline, pending, pending-reset, pending-merge, pending-repair, pending-storage or capture-coverage scope."
);
if (scope.startsWith("pending")) {
  assert(platform !== "web", "Pending scope requires a native platform.");
  assert.equal(
    process.env.TF08_ISOLATED_SANDBOX,
    "1",
    "Pending cache/reset tests require an isolated application sandbox."
  );
}
assert(
  ["web", "ios", "android"].includes(platform),
  "Select web, ios or android."
);
assert(["mapbox", "maplibre"].includes(engine), "Select mapbox or maplibre.");
const output = process.env.TF08_OUTPUT;
assert(output, "Set TF08_OUTPUT to a temporary result path.");
const expectedLibrary = process.env.TF08_LIBRARY_SHA256;
assert(expectedLibrary, "Set TF08_LIBRARY_SHA256 to the frozen dist digest.");
const runtimeRoot = process.env.TF08_RUNTIME_NODE_MODULES;
assert(
  runtimeRoot,
  "Set TF08_RUNTIME_NODE_MODULES to the bundled workspace Node packages."
);
const { PNG } = createRequire(join(runtimeRoot, "package.json"))("pngjs");
const fixturePort = Number(process.env.TF08_FIXTURE_PORT ?? 8798);
const metroPort = Number(process.env.TF08_METRO_PORT ?? 8081);
const shell = join(
  root,
  "examples",
  `${platform === "web" ? "web" : "native"}-${engine}`
);
const temporary = mkdtempSync(join(tmpdir(), "one-map-tf08-run-"));
const scenarios = [];
const imageObservations = [];
let currentScenario;
let server;
let browser;
let vite;
let metro;
let page;
let tapDriver;
let currentCommand = {};
const replies = new Map();
let resourcesAvailable = true;
let resourceRequests = 0;
let blockedRequests = 0;
const resourceObservations = [];
let applicationId;
let nativeLibraries;
let lastRendererObservation;
let locationDiagnostic;
let dataContainer;
const storageFixturePaths = {};
const storageManifest =
  scope === "pending-storage"
    ? JSON.parse(
        readFileSync(
          join(process.env.TF08_STORAGE_FIXTURES ?? "", "manifest.json"),
          "utf8"
        )
      )
    : undefined;
const adb = (args, binary = false) =>
  command(
    process.env.TF08_ADB ?? "/Users/rob/Library/Android/sdk/platform-tools/adb",
    ["-s", process.env.ANDROID_SERIAL ?? "emulator-5556", ...args],
    { binary }
  );
const simulator =
  process.env.TF08_IOS_UDID ?? "8B7D7CE4-228E-409F-A156-A597D4E448A5";
const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
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

const main = async () => {
  assert.equal(
    digest(join(root, "packages/one-map-react/dist")),
    expectedLibrary
  );
  assert.equal(
    digest(join(shell, "node_modules/one-map-react/dist")),
    expectedLibrary
  );
  await serveFixtures();
  if (platform === "web") await launchWeb();
  else await launchNative();
  if (scope === "pending-storage") {
    await storageScenarios();
    return;
  }
  await scenario("known renderer feature", async () => {
    await until(async () => {
      const value = await action("read");
      lastRendererObservation = {
        ...pickRead(value),
        featureIds: value.features.map((feature) => feature.id),
      };
      return (
        value.loads >= 1 &&
        value.features.some((feature) => Number(feature.id) === 8008)
      );
    }, 90000);
    return pickRead(await action("read"));
  });
  if (scenarios.at(-1).status === "passed") {
    if (scope === "capture-coverage") {
      await captureCoverageScenarios();
      return;
    }
    if (scope === "pending-repair") {
      if (engine === "mapbox") {
        for (const [operation, reason] of [
          ["ambient-invalidate", "no in-place ambient cache invalidation API"],
          ["ambient-size", "no legacy ambient cache size API"],
        ]) {
          await scenario(
            `SDK v11 explicitly rejects unavailable ${operation}`,
            async () => {
              let message;
              await assert.rejects(
                action("named-offline", { operation }),
                (error) => {
                  message = error.message;
                  return message.includes(reason);
                }
              );
              return {
                availability:
                  "unavailable in pinned SDK; no working-operation claim",
                message,
              };
            }
          );
        }
        await nativeOfflineScenarios();
      } else await pendingResetScenario();
      await pendingMergeScenario();
      return;
    }
    if (scope === "pending-reset" || scope === "pending-merge") {
      if (scope === "pending-reset") await pendingResetScenario();
      else await pendingMergeScenario();
      return;
    }
    if (scope === "pending") {
      await pendingNativeScenarios();
      return;
    }
    if (scope === "offline") {
      assert(platform !== "web", "Offline scope requires a native platform.");
      await nativeOfflineScenarios();
      return;
    }
    await scenario("injected location display and following", async () => {
      await activateLocation();
      await until(async () => (await action("read")).watches === 1, 5000);
      await action("emit", { longitude: -122.33, latitude: 47.62 });
      await until(
        async () => near((await action("read")).center, [-122.33, 47.62]),
        15000
      );
      await until(
        async () =>
          (await action("read")).features.some(
            (feature) => feature.properties?.kind === "position"
          ),
        10000
      );
      return pickRead(await action("read"));
    });
    if (platform === "web") await browserScenarios();
    await scenario(
      "selected SDK PNG content and overlay observation",
      async () => {
        await configure("injected");
        const image = await action("capture");
        const pixels = imagePixels(image.uri);
        if (pixels.red <= 20 && process.env.TF08_CAPTURE_OUTPUT)
          writeFileSync(
            process.env.TF08_CAPTURE_OUTPUT,
            Buffer.from(image.uri.split(",")[1], "base64")
          );
        assert(
          pixels.red > 20,
          "Known renderer point is absent from the capture."
        );
        assert(
          pixels.navy > 1000,
          "Known background is absent from the capture."
        );
        if (platform === "web")
          assert.equal(
            pixels.green,
            0,
            "DOM marker leaked into canvas output."
          );
        return {
          ...pixels,
          overlayInclusion:
            pixels.green > 20
              ? "green-host-overlay-observed"
              : "green-host-overlay-excluded",
        };
      }
    );
    await scenario(
      "detach releases tracking and suppresses late fixes",
      async () => {
        await activateLocation();
        await action("emit");
        const before = await action("read");
        await action("configure", { mode: "detached" });
        await delay(500);
        const late = await action("emit", {
          longitude: -122.31,
          latitude: 47.64,
        });
        assert.equal(late.fixes, before.fixes);
        assert.equal(late.releases, late.watches);
        await configure("injected");
        return late;
      }
    );
    if (platform !== "web") await nativeScenarios();
  }
};

const pendingNativeScenarios = async () => {
  await scenario(
    "independent images at the pending native display density",
    async () => {
      const device = await action("device-info");
      if (platform === "ios")
        assert.equal(device.scale, 2, "Use a second, 2x iOS display.");
      const image = await action("snapshot", { width: 128, height: 80 });
      const pixels = imagePixels(image.uri);
      assert.equal(pixels.width, 128);
      assert.equal(pixels.height, 80);
      assert(pixels.red > 20 && pixels.navy > 1000);
      const file = await action("snapshot", {
        width: 128,
        height: 80,
        output: "file",
      });
      const decoded = imagePixels(await readNativeImage(file.uri));
      assert.equal(decoded.width, 128);
      assert.equal(decoded.height, 80);
      return { device, dataUrl: pixels, file: decoded };
    }
  );
  await scenario(
    "current-map file capture includes rendered content",
    async () => {
      const image = await action("capture", { output: "file" });
      const pixels = imagePixels(await readNativeImage(image.uri));
      assert(pixels.width > 0 && pixels.height > 0);
      assert(pixels.red > 100 && pixels.navy > 1000);
      assert.equal(pixels.green, 0, "Host marker unexpectedly included.");
      return pixels;
    }
  );
  for (const operation of [
    "ambient-invalidate",
    "ambient-clear",
    "ambient-size",
    "tile-limit",
    "throttle",
    ...(engine === "mapbox"
      ? [
          "quota",
          "migrate",
          "legacy-list",
          "legacy-migrate",
          "legacy-limit",
          "legacy-reset",
        ]
      : []),
  ]) {
    await scenario(`named offline ${operation}`, async () => {
      const result = await action("named-offline", { operation });
      assert.deepEqual(
        result.warnings,
        [],
        "Wrapper reported a no-op instead of a native operation."
      );
      return {
        ...result,
        verification:
          "public wrapper invocation; no storage/quota readback API",
      };
    });
  }
  await pendingMergeScenario();
  if (engine === "mapbox") {
    await scenario("named legacy offline pack lifecycle", async () => {
      const invoke = async (operation) => {
        const result = await action("named-offline", { operation });
        assert.deepEqual(result.warnings, []);
        return result.value;
      };
      try {
        assert.equal(await invoke("legacy-create"), "tf08-legacy-pending");
        await invoke("legacy-pause");
        const status = await invoke("legacy-status");
        assert.equal(status.name, "tf08-legacy-pending");
        await invoke("legacy-resume");
        await invoke("legacy-invalidate");
        assert.equal(await invoke("legacy-delete"), null);
        return {
          status,
          completion: "lifecycle acknowledgement; full download not certified",
        };
      } finally {
        await invoke("legacy-delete").catch(() => undefined);
      }
    });
  }
  await pendingResetScenario();
};

const pendingMergeScenario = async () => {
  await scenario("named offline missing merge input rejects", async () => {
    const started = Date.now();
    let message;
    await assert.rejects(
      action("named-offline", { operation: "merge-missing" }),
      (error) => {
        message = error.message;
        assertMissingDatabaseRejection(message);
        return true;
      }
    );
    return {
      message,
      elapsedMs: Date.now() - started,
      validDatabaseImport: "not exercised",
    };
  });
};

const storageFixture = (purpose) => {
  const fixture = storageManifest.fixtures.find((entry) =>
    entry.file.endsWith(`${engine}-${platform}-${purpose}.db`)
  );
  assert(fixture, `Missing ${purpose} database fixture.`);
  assert.equal(
    createHash("sha256").update(readFileSync(fixture.file)).digest("hex"),
    fixture.sha256
  );
  return fixture;
};

const readAppFile = async (path) =>
  platform === "android"
    ? readAndroidAppFile(adb, applicationId, path)
    : readFileSync(join(dataContainer, path));

const copyAppFile = async (fixture, path) => {
  if (platform === "android") {
    const upload = `/data/local/tmp/tf08-${randomUUID()}.db`;
    try {
      await adb(["push", fixture.file, upload]);
      await adb([
        "shell",
        "run-as",
        applicationId,
        "mkdir",
        "-p",
        path.slice(0, path.lastIndexOf("/")),
      ]);
      await adb(["shell", "run-as", applicationId, "cp", upload, path]);
    } finally {
      await adb(["shell", "rm", "-f", upload]);
    }
  } else {
    mkdirSync(join(dataContainer, path, ".."), { recursive: true });
    writeFileSync(join(dataContainer, path), readFileSync(fixture.file));
  }
  assert.equal(
    createHash("sha256")
      .update(await readAppFile(path))
      .digest("hex"),
    fixture.sha256
  );
};

const stageStorageFixtures = async () => {
  if (platform === "ios")
    dataContainer = (
      await command("xcrun", [
        "simctl",
        "get_app_container",
        simulator,
        applicationId,
        "data",
      ])
    ).trim();
  const fixture = storageFixture("import");
  const path =
    platform === "android"
      ? "files/tf08-import.db"
      : "Documents/tf08-import.db";
  await copyAppFile(fixture, path);
  storageFixturePaths.import =
    platform === "android"
      ? `/data/user/0/${applicationId}/${path}`
      : join(dataContainer, path);
  if (engine === "mapbox") {
    storageFixturePaths.migrationSource =
      platform === "android"
        ? "files/mbgl-offline.db"
        : "Library/Application Support/com.mapbox.examples/.mapbox/cache.db";
    storageFixturePaths.migrationTarget =
      platform === "android"
        ? "files/.mapbox/map_data/map_data.db"
        : "Library/Application Support/.mapbox/map_data/map_data.db";
    await assert.rejects(readAppFile(storageFixturePaths.migrationTarget));
    await copyAppFile(
      storageFixture("migration"),
      storageFixturePaths.migrationSource
    );
  }
};

const storageReadback = async (fixture) => {
  const result = await action("named-offline", { operation: "storage-packs" });
  assert(
    result.value.some((pack) => pack.metadata?.name === fixture.identity),
    JSON.stringify(result)
  );
  return result.value;
};

const renderStoredStyle = async (fixture) => {
  resourcesAvailable = false;
  if (engine === "mapbox")
    assert.equal(await action("network", { connected: false }), false);
  await configure("storage", fixture.styleURL);
  await action("camera", { longitude: 0, latitude: 0, zoom: 1 });
  await until(
    async () => {
      const camera = await action("read");
      return near(camera.center, [0, 0]) && Math.abs(camera.zoom - 1) < 0.1;
    },
    10000,
    "storage fixture camera over its cached zoom-zero raster"
  );
  let pixels;
  await until(
    async () => {
      const image = await action("capture");
      pixels = observeCoveragePixels(
        PNG.sync.read(Buffer.from(image.uri.split(",")[1], "base64"))
      );
      return pixels.yellow > 1000;
    },
    30000,
    "populated database pixels with fixture sockets closed"
  );
  return {
    pixels,
    view: "center0,0 zoom1; cached source maxzoom0 raster is overzoomed",
    networking:
      engine === "mapbox"
        ? "SDK disconnected and fixture resource sockets closed"
        : "fixture resource sockets closed",
  };
};

const storageScenarios = async () => {
  if (engine === "mapbox")
    await scenario(
      "populated pre-v10 cache migration before map creation",
      async () => {
        const fixture = storageFixture("migration");
        const result = await action("named-offline", { operation: "migrate" });
        assert.deepEqual(result.warnings, []);
        await until(
          async () => {
            const bytes = await readAppFile(
              storageFixturePaths.migrationTarget
            );
            return (
              createHash("sha256").update(bytes).digest("hex") ===
              fixture.sha256
            );
          },
          15000,
          "migration destination retains populated source bytes"
        );
        await assert.rejects(readAppFile(storageFixturePaths.migrationSource));
        const packs = await storageReadback(fixture);
        const rendered = await renderStoredStyle(fixture);
        await restartNative();
        await storageReadback(fixture);
        const cold = await renderStoredStyle(fixture);
        return {
          fixture,
          movedBytesVerified: true,
          packs,
          rendered,
          coldRestart: cold,
        };
      }
    );
  await scenario(
    "valid populated database import and cold cached rendering",
    async () => {
      const fixture = storageFixture("import");
      const before = await action("named-offline", {
        operation: "storage-packs",
      });
      assert(
        !before.value.some((pack) => pack.metadata?.name === fixture.identity)
      );
      const merged = await action("named-offline", {
        operation: "merge-valid",
        path: storageFixturePaths.import,
      });
      assert.deepEqual(merged.warnings, []);
      const packs = await storageReadback(fixture);
      const rendered = await renderStoredStyle(fixture);
      await restartNative();
      await storageReadback(fixture);
      const cold = await renderStoredStyle(fixture);
      return { fixture, packs, rendered, coldRestart: cold };
    }
  );
};

const coverageImages = async () => {
  const image = await action("capture");
  const exported = PNG.sync.read(
    Buffer.from(image.uri.split(",")[1], "base64")
  );
  assert(
    observeFixturePixels(exported).red > 20,
    "Known rendered map point is missing from the coverage PNG."
  );
  const liveBytes =
    platform === "web"
      ? Buffer.from(
          (await page.send("Page.captureScreenshot", { format: "png" })).data,
          "base64"
        )
      : platform === "android"
        ? await adb(["exec-out", "screencap", "-p"], true)
        : await command("xcrun", [
            "simctl",
            "io",
            simulator,
            "screenshot",
            "--type=png",
            join(temporary, "live.png"),
          ]).then(() => readFileSync(join(temporary, "live.png")));
  assert(
    liveBytes.length > 8 && liveBytes.subarray(1, 4).toString() === "PNG",
    "The live screenshot did not produce PNG bytes."
  );
  return {
    exported: observeCoveragePixels(exported),
    live: observeCoveragePixels(PNG.sync.read(liveBytes)),
    dimensions: { width: exported.width, height: exported.height },
  };
};

const captureCoverageScenarios = async () => {
  await configure("coverage-base");
  await delay(700);
  const baseline = await coverageImages();
  for (const [kind, color] of [
    ["annotation", "green"],
    ["popup", "green"],
    ["ornaments", "bright"],
    ["puck", "blue"],
  ]) {
    await scenario(
      `backend capture inclusion for visible ${kind}`,
      async () => {
        await configure(`coverage-${kind}`);
        if (kind === "annotation") await action("annotation-refresh");
        const observe = async () => {
          let images;
          await until(
            async () => {
              images = await coverageImages();
              return images.live[color] - baseline.live[color] > 60;
            },
            25000,
            `visible ${kind} before capture classification`
          );
          return {
            ...captureInclusion(baseline, images.live, images.exported, color),
            images,
            baseline,
            scope:
              "backend; inclusion is recorded per renderer, not assumed identical",
          };
        };
        if (kind === "puck" && engine === "maplibre" && platform === "android")
          return withFusedLocationFixture(adb, async (inject) => {
            await inject();
            return observe();
          });
        if (kind === "puck" && platform === "ios")
          await command("xcrun", [
            "simctl",
            "location",
            simulator,
            "set",
            "47.615,-122.34",
          ]);
        if (kind === "puck" && platform === "web") {
          await activateLocation();
          await action("emit", { longitude: -122.34, latitude: 47.615 });
        }
        return observe();
      }
    );
  }
};

const pendingResetScenario = async () => {
  await scenario(
    "named offline reset removes a discoverable test pack",
    async () => {
      const id = `tf08-reset-${engine}-${platform}-${Date.now()}`;
      await action("offline-create", { id });
      let before;
      await until(
        async () => {
          before = await action("offline-status", { id });
          return ["inactive", "active", "complete"].includes(
            before.status.state
          );
        },
        30000,
        "native test pack status before database reset"
      );
      assert.equal(before.pack.id, id);
      const reset = await action("named-offline", { operation: "reset" });
      const after = await action("named-offline", { operation: "packs" });
      assert.equal(after.value, 0);
      assert.deepEqual(unexpectedResetWarnings(engine, reset.warnings), []);
      return {
        id,
        before: before.status,
        warnings: reset.warnings,
        remainingPacks: after.value,
      };
    }
  );
};

const readNativeImage = async (uri) => {
  const bytes =
    platform === "android"
      ? await adb(
          ["exec-out", "run-as", applicationId, "cat", fileURLToPath(uri)],
          true
        )
      : readFileSync(fileURLToPath(uri));
  return `data:image/png;base64,${bytes.toString("base64")}`;
};

const browserScenarios = async () => {
  await scenario(
    "gesture interruption and resume without another watch",
    async () => {
      const before = await action("read");
      await page.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: 550,
        y: 350,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      for (let step = 1; step <= 8; step += 1)
        await page.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: 550 + step * 10,
          y: 350 + step * 3,
          buttons: 1,
        });
      await page.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: 630,
        y: 374,
        button: "left",
        clickCount: 1,
      });
      await delay(500);
      const moved = await action("read");
      await action("emit", { longitude: -122.32, latitude: 47.63 });
      await delay(700);
      assert(
        near((await action("read")).center, moved.center),
        "An injected fix overrode the interrupted camera."
      );
      await activateLocation();
      await until(
        async () => near((await action("read")).center, [-122.32, 47.63]),
        15000
      );
      assert.equal((await action("read")).watches, before.watches);
      return pickRead(await action("read"));
    }
  );
  await scenario("browser geolocation success after activation", async () => {
    await configure("default");
    const before = await action("read");
    await page.send("Browser.setPermission", {
      permission: { name: "geolocation" },
      setting: "granted",
      origin: browserUrl(),
    });
    await page.send("Emulation.setGeolocationOverride", {
      longitude: -122.33,
      latitude: 47.62,
      accuracy: 25,
    });
    await activateLocation();
    await until(async () => (await action("read")).fixes > before.fixes, 10000);
    await until(
      async () => near((await action("read")).center, [-122.33, 47.62]),
      15000
    );
    return pickRead(await action("read"));
  });
  await scenario(
    "browser permission denial reaches the control error callback",
    async () => {
      await configure("default");
      const before = await action("read");
      await page.send("Browser.setPermission", {
        permission: { name: "geolocation" },
        setting: "denied",
        origin: browserUrl(),
      });
      await activateLocation();
      await until(
        async () => (await action("read")).errors > before.errors,
        10000
      );
      return { observedError: true };
    }
  );
  await scenario("canvas export failure propagates", async () => {
    await configure("injected");
    await page.evaluate(
      "window.__tf08OriginalExport=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(){throw new DOMException('blocked','SecurityError')}"
    );
    try {
      await assert.rejects(action("capture"));
    } finally {
      await page.evaluate(
        "HTMLCanvasElement.prototype.toDataURL=window.__tf08OriginalExport;delete window.__tf08OriginalExport"
      );
    }
    return { rejectedExport: true };
  });
};

const nativeScenarios = async () => {
  await scenario(
    "native gesture interruption and resume without another watch",
    async () => {
      await configure("injected");
      const inactive = await action("read");
      await activateLocation();
      await until(
        async () => (await action("read")).watches > inactive.watches,
        15000,
        "native control watch registration"
      );
      await action("emit");
      await until(
        async () => {
          const value = await action("read");
          return (
            near(value.center, [-122.33, 47.62]) &&
            !value.moving &&
            value.moveEnds > inactive.moveEnds
          );
        },
        15000,
        "native initial follow completion"
      );
      const before = await action("read");
      if (platform === "android") {
        const size = (await adb(["shell", "wm", "size"])).match(/(\d+)x(\d+)/);
        assert(size);
        const width = Number(size[1]);
        const height = Number(size[2]);
        await adb([
          "shell",
          "input",
          "swipe",
          String(width * 0.5),
          String(height * 0.5),
          String(width * 0.7),
          String(height * 0.6),
          "400",
        ]);
      } else {
        currentTap = `drag ${applicationId} ${randomUUID()}`;
      }
      await until(
        async () => {
          const value = await action("read");
          return (
            !near(value.center, before.center) &&
            !value.moving &&
            value.moveEnds > before.moveEnds
          );
        },
        15000,
        "native physical drag completion"
      );
      const moved = await action("read");
      assert(
        !near(moved.center, before.center),
        "Native drag did not move the camera."
      );
      await action("emit", { longitude: -122.32, latitude: 47.63 });
      await delay(1000);
      assert(
        near((await action("read")).center, moved.center),
        "Location fix overrode native gesture interruption."
      );
      await activateLocation();
      await until(
        async () => near((await action("read")).center, [-122.32, 47.63]),
        15000,
        "native control follow resume"
      );
      assert.equal((await action("read")).watches, before.watches);
      return {
        before: pickRead(before),
        afterDrag: pickRead(moved),
        afterResume: pickRead(await action("read")),
      };
    }
  );
  await scenario("foreground permission boundary", async () => {
    if (platform === "ios" && engine === "mapbox") {
      await assert.rejects(action("permission"));
      return { applicationIntegrationRequired: true };
    }
    const permission = await action("permission");
    assert.equal(permission.status, "granted");
    return permission;
  });
  await scenario("fresh native position from simulator injection", async () => {
    if (platform === "android" && engine === "maplibre")
      return withFusedLocationFixture(adb, async (inject) => {
        const requested = action("position");
        await delay(1000);
        await inject();
        const position = await requested;
        assertFreshPosition(position);
        return { ...position, injection: "Android OS fused mock provider" };
      });
    // Establish an older distinct cached fix; the target injection is actual
    // movement, rather than an unchanged emulator coordinate being suppressed.
    if (platform === "android")
      await adb(["emu", "geo", "fix", "-122.34", "47.61"]);
    else
      await command("xcrun", [
        "simctl",
        "location",
        simulator,
        "set",
        "47.61,-122.34",
      ]);
    await delay(1000);
    const requested = action("position");
    await delay(1000);
    for (let index = 0; index < 3; index += 1) {
      if (platform === "android")
        await adb(["emu", "geo", "fix", "-122.33", "47.62"]);
      else
        await command("xcrun", [
          "simctl",
          "location",
          simulator,
          "set",
          "47.62,-122.33",
        ]);
      await delay(300);
    }
    const position = await requested;
    assertFreshPosition(position);
    return position;
  });
  await scenario(
    "independent zero-zoom PNG dimensions and file output",
    async () => {
      const image = await action("snapshot");
      const pixels = imagePixels(image.uri);
      assert.equal(pixels.width, 96);
      assert.equal(pixels.height, 64);
      assert(pixels.navy > 1000);
      assert(
        pixels.red > 20,
        "The offset style point is missing: native snapshot zoom zero was not established."
      );
      const file = await action("snapshot", { output: "file" });
      const bytes =
        platform === "android"
          ? await adb(
              [
                "exec-out",
                "run-as",
                applicationId,
                "cat",
                fileURLToPath(file.uri),
              ],
              true
            )
          : readFileSync(fileURLToPath(file.uri));
      const decoded = imagePixels(
        `data:image/png;base64,${bytes.toString("base64")}`
      );
      assert.equal(decoded.width, 96);
      assert.equal(decoded.height, 64);
      return { dataUrl: pixels, file: decoded };
    }
  );
  await scenario(
    "invalid snapshot style rejects before the facade deadline",
    async () => {
      const started = Date.now();
      await assert.rejects(
        action("snapshot", {
          mapStyle: `${fixtureUrl}/invalid-style.json`,
          timeoutMs: 20000,
        })
      );
      const elapsedMs = Date.now() - started;
      assert(
        elapsedMs < 19000,
        "Only the facade deadline rejected a stalled native snapshot."
      );
      return { elapsedMs };
    }
  );
  if (platform === "android")
    await scenario(
      "snapshot pixel dimensions at a second Android density",
      async () => {
        const original = await adb(["shell", "wm", "density"]);
        try {
          await adb(["shell", "wm", "density", "320"]);
          await delay(1500);
          const image = await action("snapshot", { width: 128, height: 80 });
          const pixels = imagePixels(image.uri);
          assert.equal(pixels.width, 128);
          assert.equal(pixels.height, 80);
          return { density: 320, ...pixels };
        } finally {
          const override = original.match(/Override density: (\d+)/);
          await adb(["shell", "wm", "density", override?.[1] ?? "reset"]);
        }
      }
    );
  await nativeOfflineScenarios();
};

const nativeOfflineScenarios = async () => {
  const id = `tf08-${engine}-${platform}-${Date.now()}`;
  await scenario(
    "bounded offline create, observe, pause and resume",
    async () => {
      const pack = await action("offline-create", { id });
      assert.equal(pack.id, id);
      await action("offline-subscribe", { id });
      await until(
        async () => !!(await action("offline-status", { id })).status,
        30000,
        "native pack registration before pause"
      );
      await action("offline-pause", { id });
      await action("offline-resume", { id });
      await until(
        async () =>
          (await action("offline-status", { id })).status.state === "complete",
        180000
      );
      const before = await action("offline-status", { id });
      assert(
        before.status.requiredResourceCount > 0,
        "A completed offline pack must contain downloaded resources."
      );
      assert.equal(before.errors, 0, JSON.stringify(before.errorMessages));
      await assert.rejects(action("offline-duplicate", { id }));
      const result = await action("offline-status", { id });
      assert(
        result.progress.some(
          (entry) => entry.label === "one" && entry.state === "complete"
        )
      );
      assert(
        result.progress.some(
          (entry) => entry.label === "two" && entry.state === "complete"
        )
      );
      assert.equal(result.errors, 0, JSON.stringify(result.errorMessages));
      return {
        pack: result.pack,
        status: result.status,
        subscriberEventsBeforeDuplicate: before.progress.length,
        subscriberEventsAfterDuplicate: result.progress.length,
        resourceRequests,
      };
    }
  );
  let lifecyclePassed = scenarios.at(-1).status === "passed";
  if (lifecyclePassed && scope === "pending-repair") {
    await scenario(
      "ambient cache clearing preserves the downloaded offline pack",
      async () => {
        const before = await action("offline-status", { id });
        const cleared = await action("named-offline", {
          operation: "ambient-clear",
        });
        assert.deepEqual(cleared.warnings, []);
        const after = await action("offline-status", { id });
        assert.equal(after.pack.id, id);
        assert.equal(after.status.state, "complete");
        assert.equal(
          after.status.completedResourceCount,
          before.status.completedResourceCount
        );
        return { before: before.status, after: after.status };
      }
    );
    lifecyclePassed = scenarios.at(-1).status === "passed";
  }
  if (lifecyclePassed)
    await scenario(
      "persisted offline pack after cold restart with fixture resources unavailable",
      async () => {
        resourcesAvailable = false;
        await restartNative();
        await until(
          async () => !!(await action("read")).loads,
          90000,
          "cold restart local map readiness"
        );
        const persisted = await action("offline-status", { id });
        assert.equal(persisted.pack.metadata.test, "tf08");
        assert.equal(persisted.status.state, "complete");
        if (engine === "mapbox")
          assert.equal(await action("network", { connected: false }), false);
        await configure("injected", persisted.pack.metadata.fixtureStyle);
        await action("camera", { longitude: 0, latitude: 0, zoom: 1 });
        await delay(1000);
        const image = await action("capture");
        const pixels = imagePixels(image.uri);
        assert(
          pixels.magenta > 1000,
          "The downloaded tiles did not render with resource delivery disabled."
        );
        return {
          pack: persisted.pack,
          status: persisted.status,
          pixels,
          blockedRequests,
          networking:
            engine === "mapbox"
              ? "Mapbox SDK network switch confirmed disconnected; fixture sockets closed; loopback command/Metro transport retained"
              : "fixture resource sockets closed; loopback command/Metro transport retained; downloaded fixture resources have a one-hour freshness lifetime",
        };
      }
    );
  else
    scenarios.push({
      name: "persisted offline pack after cold restart with fixture resources unavailable",
      status: "blocked",
      reason: "Offline creation/lifecycle prerequisite failed.",
    });
  resourcesAvailable = true;
  if (engine === "mapbox")
    assert.equal(await action("network", { connected: true }), true);
  // Invalidation expires existing resources. A completed byte count alone
  // does not prove that they were revalidated before disconnecting the app.
  // Exercise invalidation online after verifying the pristine completed pack.
  if (lifecyclePassed)
    await scenario(
      "offline invalidation preserves subscribed progress",
      async () => {
        await action("offline-subscribe", { id });
        const before = await action("offline-status", { id });
        await action("offline-invalidate", { id });
        await action("offline-resume", { id });
        await until(
          async () =>
            (await action("offline-status", { id })).progress.length >
            before.progress.length,
          15000,
          "post-invalidation subscriber delivery"
        );
        await until(
          async () =>
            (await action("offline-status", { id })).status.state ===
            "complete",
          180000,
          "post-invalidation SDK completion"
        );
        const result = await action("offline-status", { id });
        assert.equal(result.errors, 0, JSON.stringify(result.errorMessages));
        return {
          status: result.status,
          subscriberEventsBefore: before.progress.length,
          subscriberEventsAfter: result.progress.length,
        };
      }
    );
  await action("offline-delete", { id }).catch(() => undefined);
};

const scenario = async (name, operation) => {
  currentScenario = name;
  try {
    scenarios.push({ name, status: "passed", observation: await operation() });
  } catch (error) {
    scenarios.push({
      name,
      status: "failed",
      error: sanitize(error?.message ?? "Acceptance operation failed."),
      lastRendererObservation,
    });
  }
  console.error(`${engine}-${platform}: ${name}: ${scenarios.at(-1).status}`);
};

const action = async (name, value = {}) => {
  if (page)
    return page.evaluate(
      `window.__oneMapTf08.command(${JSON.stringify(name)},${JSON.stringify(value)})`,
      true
    );
  const id = randomUUID();
  currentCommand = {
    id,
    environment: `${engine}-${platform}`,
    action: name,
    value,
  };
  await until(
    () => Promise.resolve(replies.has(id)),
    name.startsWith("offline") ? 60000 : 45000
  );
  const reply = replies.get(id);
  replies.delete(id);
  if (!reply.ok) {
    if (name === "position") locationDiagnostic = reply.diagnostic;
    throw new Error(reply.message ?? reply.error);
  }
  if (name === "read")
    lastRendererObservation = {
      ...pickRead(reply.value),
      moves: reply.value.moves,
    };
  return reply.value;
};

const configure = async (mode, mapStyle) => {
  let before = await action("read").catch(() => undefined);
  if (!before) {
    // The storage shell must create its map before it can receive configuration.
    await action("configure", { mode: "injected" });
    await until(
      async () => (await action("read")).loads > 0,
      90000,
      "deferred map mount"
    );
    before = await action("read");
  }
  await action("configure", { mode, mapStyle });
  await until(
    async () => (await action("read")).loads > before.loads,
    90000,
    "replacement map load"
  );
  if (!mapStyle)
    await until(
      async () =>
        (await action("read")).features.some(
          (feature) => Number(feature.id) === 8008
        ),
      30000
    );
};

const serveFixtures = async () => {
  const png = new PNG({ width: 256, height: 256 });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = 255;
    png.data[offset + 1] = 0;
    png.data[offset + 2] = 255;
    png.data[offset + 3] = 255;
  }
  const tile = PNG.sync.write(png);
  server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.url === "/command") {
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(currentCommand));
      return;
    }
    if (request.url === "/result" && request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 20000000) request.destroy();
      });
      request.on("end", () => {
        try {
          const result = JSON.parse(body);
          if (
            result.environment === `${engine}-${platform}` &&
            result.id === currentCommand.id
          ) {
            replies.set(result.id, result);
          }
          response.writeHead(204).end();
        } catch {
          response.writeHead(400).end();
        }
      });
      return;
    }
    if (request.url === "/tap") {
      response.writeHead(200).end(currentTap);
      return;
    }
    resourceRequests += 1;
    if (resourceObservations.length < 80)
      resourceObservations.push({
        path: request.url,
        available: resourcesAvailable,
      });
    if (!resourcesAvailable) {
      blockedRequests += 1;
      // An unreachable transport models disconnection. HTTP 503 models a live
      // service error and can keep an SDK waiting for revalidation instead.
      request.socket.destroy();
      return;
    }
    // These immutable per-pack resources must be fresh after restart. Unique
    // URLs avoid passing through a previous acceptance pack's cache entries.
    response.setHeader("Cache-Control", "public, max-age=3600");
    if (request.url?.startsWith("/tile/")) {
      setTimeout(
        () =>
          response.writeHead(200, { "Content-Type": "image/png" }).end(tile),
        1000
      );
      return;
    }
    const fixtureRequest = new URL(request.url, fixtureUrl);
    if (
      ["/style.json", "/offline-style.json"].includes(fixtureRequest.pathname)
    ) {
      const offline = fixtureRequest.pathname === "/offline-style.json";
      const identity = encodeURIComponent(
        fixtureRequest.searchParams.get("id") ?? "shared"
      );
      // Mapbox tile regions only support hosted tilesets; MapLibre uses the
      // isolated raster fixture. Both draw magenta inside the bounded region.
      const offlineSources =
        engine === "mapbox"
          ? {
              basemap: {
                type: "vector",
                url: "mapbox://mapbox.mapbox-streets-v8",
              },
            }
          : {
              raster: {
                type: "raster",
                tiles: [`${fixtureUrl}/tile/${identity}/{z}/{x}/{y}.png`],
                tileSize: 256,
                maxzoom: 1,
              },
            };
      const offlineLayers =
        engine === "mapbox"
          ? [
              {
                id: "offline-water",
                type: "fill",
                source: "basemap",
                "source-layer": "water",
                paint: { "fill-color": "#ff00ff" },
              },
            ]
          : [{ id: "offline-raster", type: "raster", source: "raster" }];
      const style = {
        version: 8,
        sources: offline
          ? offlineSources
          : {
              point: {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: {},
                      geometry: { type: "Point", coordinates: [5, 0] },
                    },
                  ],
                },
              },
            },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0f1928" },
          },
          ...(offline
            ? offlineLayers
            : [
                {
                  id: "zoom-zero-point",
                  type: "circle",
                  source: "point",
                  paint: { "circle-radius": 8, "circle-color": "#ff0000" },
                },
              ]),
        ],
      };
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(style));
      return;
    }
    response.writeHead(404).end("invalid test style");
  });
  await new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(fixturePort, "127.0.0.1", resolveServer);
  });
};

const browserUrl = () =>
  `http://127.0.0.1:${Number(process.env.TF08_WEB_PORT ?? (engine === "mapbox" ? 4191 : 4192))}`;
const launchWeb = async () => {
  const port = new URL(browserUrl()).port;
  vite = start(
    "bun",
    ["run", "dev", "--", "--port", port, "--strictPort", "--host", "127.0.0.1"],
    { cwd: shell, env: { ...process.env, ONE_MAP_SMOKE_CACHE_ROOT: temporary } }
  );
  await until(async () => (await fetch(browserUrl())).ok, 30000);
  browser = start(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless=new",
      `--remote-debugging-port=${Number(port) + 1000}`,
      `--user-data-dir=${join(temporary, "profile")}`,
      "--window-size=1280,800",
      "--no-first-run",
      `${browserUrl()}/?tf08=services`,
    ]
  );
  let target;
  await until(async () => {
    const tabs = await fetch(
      `http://127.0.0.1:${Number(port) + 1000}/json/list`
    ).then((response) => response.json());
    target = tabs.find((tab) => tab.url.includes("tf08=services"));
    return !!target?.webSocketDebuggerUrl;
  }, 20000);
  page = await connect(target.webSocketDebuggerUrl);
  await until(async () => page.evaluate("!!window.__oneMapTf08"), 30000);
};

const launchNative = async () => {
  const metroListeners = await command("lsof", [
    "-nP",
    `-iTCP:${metroPort}`,
    "-sTCP:LISTEN",
    "-t",
  ]).catch(() => "");
  assert(
    !metroListeners.trim(),
    `Metro port ${metroPort} is already owned by another process.`
  );
  const binary = process.env.TF08_NATIVE_BINARY;
  const expected = process.env.TF08_NATIVE_SHA256;
  assert(
    binary && expected,
    "Set TF08_NATIVE_BINARY and TF08_NATIVE_SHA256 to the fresh built APK/app executable."
  );
  assert.equal(
    createHash("sha256").update(readFileSync(binary)).digest("hex"),
    expected
  );
  applicationId =
    process.env.TF08_APPLICATION_ID ??
    (platform === "android"
      ? `com.onemap${engine}`
      : `org.reactjs.native.example.OneMap${engine === "mapbox" ? "Mapbox" : "Maplibre"}`);
  if (platform === "android") {
    await adb(["install", "-r", binary]);
    const installed = (await adb(["shell", "pm", "path", applicationId]))
      .trim()
      .split("\n")
      .find((line) => line.endsWith("base.apk"));
    const copy = join(temporary, "installed.apk");
    await adb(["pull", installed.slice("package:".length), copy]);
    assert.equal(
      createHash("sha256").update(readFileSync(copy)).digest("hex"),
      expected
    );
    const prefs = `shared_prefs/${applicationId}_preferences.xml`;
    await adb(["shell", "am", "force-stop", applicationId]);
    if (scope === "pending-storage") {
      assert(
        applicationId.endsWith(".tf08remaining"),
        "Storage tests require their dedicated Android application ID."
      );
      await adb(["shell", "pm", "clear", applicationId]);
    }
    await adb([
      "shell",
      "run-as",
      applicationId,
      "mkdir",
      "-p",
      "shared_prefs",
    ]);
    const existing = await adb([
      "exec-out",
      "run-as",
      applicationId,
      "cat",
      prefs,
    ]).catch(() => "");
    const setting = `<string name="debug_http_host">127.0.0.1:${metroPort}</string>`;
    let updated = `<map>${setting}</map>`;
    if (existing.includes('name="debug_http_host"')) {
      updated = existing.replace(
        /<string name="debug_http_host">[^<]*<\/string>/,
        setting
      );
    } else if (existing.includes("</map>")) {
      updated = existing.replace("</map>", `${setting}</map>`);
    }
    await command(
      process.env.TF08_ADB ??
        "/Users/rob/Library/Android/sdk/platform-tools/adb",
      [
        "-s",
        process.env.ANDROID_SERIAL ?? "emulator-5556",
        "shell",
        `run-as ${applicationId} sh -c 'cat > ${prefs}'`,
      ],
      { input: updated }
    );
    await adb(["reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
    await adb(["reverse", `tcp:${fixturePort}`, `tcp:${fixturePort}`]);
    await adb([
      "shell",
      "pm",
      "grant",
      applicationId,
      "android.permission.ACCESS_FINE_LOCATION",
    ]);
    await adb([
      "shell",
      "pm",
      "grant",
      applicationId,
      "android.permission.ACCESS_COARSE_LOCATION",
    ]);
  } else {
    if (scope === "pending-storage") {
      assert(
        process.env.TF08_IOS_UDID &&
          simulator !== "8B7D7CE4-228E-409F-A156-A597D4E448A5",
        "Storage tests require a dedicated iOS simulator."
      );
      await command("xcrun", [
        "simctl",
        "uninstall",
        simulator,
        applicationId,
      ]).catch(() => undefined);
    }
    await command("xcrun", [
      "simctl",
      "install",
      simulator,
      process.env.TF08_NATIVE_APP,
    ]);
    const installed = (
      await command("xcrun", [
        "simctl",
        "get_app_container",
        simulator,
        applicationId,
        "app",
      ])
    ).trim();
    const executable = binary.split("/").at(-1);
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(installed, executable)))
        .digest("hex"),
      expected
    );
    nativeLibraries = Object.fromEntries(
      readdirSync(process.env.TF08_NATIVE_APP)
        .filter((name) => name.endsWith(".dylib"))
        .map((name) => {
          const expectedHash = createHash("sha256")
            .update(readFileSync(join(process.env.TF08_NATIVE_APP, name)))
            .digest("hex");
          assert.equal(
            createHash("sha256")
              .update(readFileSync(join(installed, name)))
              .digest("hex"),
            expectedHash
          );
          return [name, expectedHash];
        })
    );
    await command("xcrun", [
      "simctl",
      "privacy",
      simulator,
      "grant",
      "location",
      applicationId,
    ]);
  }
  if (scope === "pending-storage") await stageStorageFixtures();
  metro = start(
    "bun",
    ["run", "start", "--", "--port", String(metroPort), "--reset-cache"],
    {
      cwd: shell,
      env: {
        ...process.env,
        ONE_MAP_SMOKE: scope === "pending-storage" ? "tf08-storage" : "tf08",
      },
    }
  );
  await until(
    async () => (await fetch(`http://127.0.0.1:${metroPort}/status`)).ok,
    60000
  );
  await restartNative();
};

const restartNative = async () => {
  currentCommand = {};
  if (platform === "android") {
    await adb(["shell", "am", "force-stop", applicationId]);
    const launch = await adb([
      "shell",
      "am",
      "start",
      "-W",
      "-n",
      `${applicationId}/com.onemap${engine}.MainActivity`,
    ]);
    assert(
      !/Error:|Exception/.test(launch),
      `Android launch failed: ${launch}`
    );
  } else {
    await command("xcrun", [
      "simctl",
      "terminate",
      simulator,
      applicationId,
    ]).catch(() => undefined);
    await command("xcrun", [
      "simctl",
      "launch",
      simulator,
      applicationId,
      "-RCT_jsLocation",
      `127.0.0.1:${metroPort}`,
    ]);
  }
};

let currentTap = "";
const activateLocation = async () => {
  if (page) {
    const point = await page.evaluate(
      "(() => {const e=document.querySelector('button[aria-label=\"Locate me\"], button.mapboxgl-ctrl-geolocate, button.maplibregl-ctrl-geolocate');if(!e)throw new Error('Location button missing');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()"
    );
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point[0],
      y: point[1],
      button: "left",
      clickCount: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point[0],
      y: point[1],
      button: "left",
      clickCount: 1,
    });
  } else if (platform === "android") {
    await adb(["shell", "uiautomator", "dump", "/sdcard/tf08-ui.xml"]);
    const xml = await adb(["exec-out", "cat", "/sdcard/tf08-ui.xml"]);
    const node = xml.match(
      /<node[^>]*content-desc="Locate me"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/
    );
    assert(node, "Location button is absent from the native hierarchy.");
    await adb([
      "shell",
      "input",
      "tap",
      String((Number(node[1]) + Number(node[3])) / 2),
      String((Number(node[2]) + Number(node[4])) / 2),
    ]);
  } else {
    if (!tapDriver) {
      tapServer = createServer((_request, response) =>
        response.writeHead(200).end(currentTap)
      );
      await new Promise((done, reject) => {
        tapServer.once("error", reject);
        tapServer.listen(8799, "127.0.0.1", done);
      });
      let driverLog = "";
      tapDriver = spawn(
        "xcodebuild",
        [
          "test",
          "-project",
          join(root, "scripts/ios-tap/TapDriver.xcodeproj"),
          "-scheme",
          "TapDriver",
          "-destination",
          `platform=iOS Simulator,id=${simulator}`,
          "-parallel-testing-enabled",
          "NO",
          "-collect-test-diagnostics",
          "never",
          "-only-testing:TapDriverUITests/TapDriver/testDriveTaps",
        ],
        { detached: true, stdio: ["ignore", "pipe", "pipe"] }
      );
      const record = (chunk) => {
        driverLog = (driverLog + chunk.toString()).slice(-10000);
      };
      tapDriver.stdout.on("data", record);
      tapDriver.stderr.on("data", record);
      await until(
        () => Promise.resolve(driverLog.includes("testDriveTaps]' started")),
        180000
      );
    }
    currentTap = `locate ${applicationId} ${randomUUID()}`;
    await delay(1000);
  }
};
let tapServer;

const imagePixels = (uri) => {
  assert(uri.startsWith("data:image/png;base64,"), "Expected PNG data URL.");
  const bytes = Buffer.from(uri.split(",")[1], "base64");
  let decoded;
  try {
    decoded = PNG.sync.read(bytes);
  } catch (error) {
    imageObservations.push({
      scenario: currentScenario,
      error: sanitize(error.message),
      bytes: bytes.length,
    });
    if (process.env.TF08_INVALID_PNG_OUTPUT)
      writeFileSync(process.env.TF08_INVALID_PNG_OUTPUT, bytes);
    throw error;
  }
  const result = observeFixturePixels(decoded);
  imageObservations.push({ scenario: currentScenario, ...result });
  return result;
};

const near = (first, second) =>
  Math.abs(first[0] - second[0]) < 0.001 &&
  Math.abs(first[1] - second[1]) < 0.001;
const assertFreshPosition = (position) => {
  assert(near(position.lngLat, [-122.33, 47.62]));
  // Native timestamps and request time share the device clock. Host/emulator
  // skew must not turn a measured fresh native fix into a false failure.
  assert(position.timestamp >= position.requestedAt);
  assert(position.timestamp <= position.completedAt + 1000);
};
const pickRead = (value) => ({
  loads: value.loads,
  fixes: value.fixes,
  errors: value.errors,
  watches: value.watches,
  releases: value.releases,
  center: value.center,
  zoom: value.zoom,
  featureCount: value.features.length,
  moving: value.moving,
  moveEnds: value.moveEnds,
});
const sanitize = (message) =>
  String(message)
    .replace(/\b(?:pk|sk)\.[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/([?&](?:access_token|sku|key)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 500);
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (ready, timeout, description = "required observation") => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await ready().catch(() => false)) return;
    await delay(200);
  }
  throw new Error(`TF08 observation timed out: ${description}.`);
};
const start = (file, args, options = {}) => {
  const child = spawn(file, args, {
    ...options,
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => undefined);
  return child;
};
const command = (file, args, { binary = false, input } = {}) =>
  new Promise((done, reject) => {
    const child = spawn(file, args, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (input !== undefined) child.stdin.end(input);
    const chunks = [];
    let errorText = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${file} timed out.`));
    }, 60000);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      errorText += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const bytes = Buffer.concat(chunks);
      if (code === 0) done(binary ? bytes : bytes.toString());
      else reject(new Error(sanitize(errorText || `${file} exited ${code}.`)));
    });
  });
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
              sanitize(
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
        waiting.reject(new Error(sanitize(message.error.message)));
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

try {
  await main();
} catch (error) {
  scenarios.push({
    name: "acceptance setup",
    status: "failed",
    error: sanitize(error.message),
  });
} finally {
  page?.close();
  if (applicationId && engine === "mapbox")
    await action("network", { connected: true }).catch(() => undefined);
  if (applicationId) {
    if (platform === "android")
      await adb(["shell", "am", "force-stop", applicationId]).catch(
        () => undefined
      );
    else
      await command("xcrun", [
        "simctl",
        "terminate",
        simulator,
        applicationId,
      ]).catch(() => undefined);
  }
  for (const child of [browser, vite, metro, tapDriver])
    if (child) await stopOwnedProcess(child);
  await new Promise((done) => (server ? server.close(done) : done()));
  await new Promise((done) => (tapServer ? tapServer.close(done) : done()));
  if (platform === "android" && applicationId)
    await adb(["reverse", "--remove", `tcp:${fixturePort}`]).catch(
      () => undefined
    );
  const result = {
    environment: `${engine}-${platform}`,
    scope,
    startedAt,
    harnessSha256,
    libraryDistSha256: expectedLibrary,
    nativeBinarySha256: process.env.TF08_NATIVE_SHA256,
    nativeLibraries,
    scenarios,
    imageObservations,
    lastRendererObservation,
    locationDiagnostic,
    remaining:
      scope === "capture-coverage"
        ? ["Database import/migration results are recorded separately."]
        : scope === "pending-storage"
          ? ["Additional capture results are recorded separately."]
          : [],
    excludedByOwner: [
      "physical-device testing",
      "RNMapbox ambient invalidation and ambient-size controls",
    ],
    storageFixtures: storageManifest,
    resourceRequests,
    blockedRequests,
    resourceObservations,
  };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  rmSync(temporary, { recursive: true, force: true });
  if (scenarios.some((item) => item.status !== "passed")) process.exitCode = 1;
}
