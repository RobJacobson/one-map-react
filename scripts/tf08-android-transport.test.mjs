import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf08-services-smoke.mjs", import.meta.url),
  "utf8"
);
const start = source.indexOf("const grantAndroidTransportPermission = async");
const end = source.indexOf("\nconst launchNative", start);
assert(
  start >= 0 && end > start,
  "Android transport permission setup is missing."
);
for (const sdk of ["36", "37", "38"]) {
  const commands = [];
  const grant = runInNewContext(
    `${source.slice(start, end)}; grantAndroidTransportPermission;`,
    {
      assert,
      applicationId: "com.onemapmaplibre.test.tf08remaining",
      adb: async (args) => {
        commands.push(Array.from(args));
        return sdk;
      },
    }
  );
  await grant();
  assert.deepEqual(commands[0], ["shell", "getprop", "ro.build.version.sdk"]);
  assert.deepEqual(
    commands.slice(1),
    Number(sdk) >= 37
      ? [
          [
            "shell",
            "pm",
            "grant",
            "com.onemapmaplibre.test.tf08remaining",
            "android.permission.ACCESS_LOCAL_NETWORK",
          ],
        ]
      : []
  );
}
assert(
  source.indexOf("await grantAndroidTransportPermission();") >
    source.indexOf('await adb(["shell", "pm", "clear", applicationId]);')
);
console.log(
  "PASS Android local-network grant is restored after app-data reset on API 37+, with older APIs unchanged."
);

const nativeStart = source.indexOf("const nativeScenarios = async");
const nativeEnd = source.indexOf(
  "\nconst nativeOfflineScenarios =",
  nativeStart
);
const restartStart = source.indexOf("const restartNative = async");
const restartEnd = source.indexOf("\nlet currentTap =", restartStart);
assert(nativeStart >= 0 && nativeEnd > nativeStart);
assert(restartStart >= 0 && restartEnd > restartStart);

for (const snapshotFails of [false, true]) {
  for (const restoredDensity of ["420", "reset"]) {
    const events = [];
    const failures = [];
    let loadReads = 0;
    const context = {
      assert,
      platform: "android",
      engine: "maplibre",
      simulator: undefined,
      metroPort: 8081,
      fixturePort: 8798,
      currentCommand: { id: "previous-activity-command" },
      scenario: async (name, operation) => {
        if (name !== "snapshot pixel dimensions at a second Android density")
          return;
        try {
          await operation();
        } catch (error) {
          failures.push(error.message);
        }
      },
      adb: async (args) => {
        assert.deepEqual(Array.from(args.slice(0, 3)), [
          "shell",
          "wm",
          "density",
        ]);
        if (args.length === 3) {
          events.push("density-query");
          return restoredDensity === "reset"
            ? "Physical density: 420\n"
            : "Physical density: 420\nOverride density: 420\n";
        }
        events.push(`density-${args[3]}`);
        return "";
      },
      delay: async () => {},
      action: async (name) => {
        if (name === "snapshot") {
          events.push("snapshot");
          if (snapshotFails) throw new Error("Snapshot failed.");
          return { uri: "data:fixture" };
        }
        assert.equal(name, "observations");
        assert.equal(events.includes("fresh-launch"), true);
        loadReads += 1;
        events.push(loadReads === 1 ? "fresh-not-loaded" : "fresh-loaded");
        return { loads: loadReads === 1 ? 0 : 1 };
      },
      imagePixels: () => ({ width: 128, height: 80 }),
      launchNativeWorkspace: (options) => {
        assert.equal(Object.keys(context.currentCommand).length, 0);
        assert.equal(events.at(-1), `density-${restoredDensity}`);
        assert.equal(options.platform, "android");
        assert.equal(options.port, 8081);
        events.push("fresh-launch");
      },
      until: async (read) => {
        assert.equal(
          await read(),
          false,
          "Must wait through a fresh unloaded app."
        );
        assert.equal(
          await read(),
          true,
          "Must observe the fresh app's map load."
        );
      },
      nativeOfflineScenarios: async () => {
        events.push("offline");
      },
    };
    const nativeScenarios = runInNewContext(
      `${source.slice(restartStart, restartEnd)}; ${source.slice(nativeStart, nativeEnd)}; nativeScenarios;`,
      context
    );
    await nativeScenarios();
    assert.deepEqual(events, [
      "density-query",
      "density-320",
      "snapshot",
      `density-${restoredDensity}`,
      "fresh-launch",
      "fresh-not-loaded",
      "fresh-loaded",
      "offline",
    ]);
    assert.deepEqual(failures, snapshotFails ? ["Snapshot failed."] : []);
  }
}
console.log(
  "PASS Android density cleanup restores the original setting, clears stale commands, relaunches and awaits a fresh map before offline checks, including failed captures."
);

const freshnessStart = source.indexOf("const near =");
const freshnessEnd = source.indexOf("\nconst pickRead =", freshnessStart);
assert(freshnessStart >= 0 && freshnessEnd > freshnessStart);

// A cached pre-request fix is discarded. Some native providers emit another
// measurement only when the simulated coordinate actually changes.
for (const [platform, engine] of [
  ["ios", "maplibre"],
  ["ios", "mapbox"],
  ["android", "mapbox"],
]) {
  const events = [];
  let currentPosition = [-122.35, 47.6];
  let complete;
  let rejectPending;
  let targetInjections = 0;
  const inject = async (coordinates) => {
    const changed = coordinates.some(
      (value, index) => value !== currentPosition[index]
    );
    currentPosition = coordinates;
    events.push([...coordinates]);
    if (complete && changed) {
      complete({
        lngLat: [...coordinates],
        requestedAt: 10000,
        timestamp: 10001,
        completedAt: 10002,
      });
      complete = undefined;
      rejectPending = undefined;
      events.push("fresh-movement-fix");
    }
    if (coordinates[0] === -122.33) targetInjections += 1;
    return "";
  };
  const run = runInNewContext(
    `${source.slice(freshnessStart, freshnessEnd)};
     ${source.slice(nativeStart, nativeEnd)}; nativeScenarios;`,
    {
      assert,
      platform,
      engine,
      simulator: "assigned-simulator",
      scenario: async (name, operation) => {
        if (name === "fresh native position from simulator injection")
          await operation();
      },
      nativeOfflineScenarios: async () => {},
      delay: async () => {
        if (targetInjections >= 3 && rejectPending)
          rejectPending(
            new Error("No fresh fix: identical coordinates suppressed.")
          );
      },
      adb: async (args) => inject(args.slice(3).map(Number)),
      command: async (_file, args) => {
        const [latitude, longitude] = args[4].split(",").map(Number);
        return inject([longitude, latitude]);
      },
      action: async (name) => {
        assert.equal(name, "position");
        const cached = { lngLat: [...currentPosition], timestamp: 9999 };
        assert(
          cached.timestamp < 10000,
          "Cached fix must precede acquisition."
        );
        events.push("cached-fix-discarded");
        return new Promise((resolve, reject) => {
          complete = resolve;
          rejectPending = reject;
        });
      },
    }
  );
  await run();
  assert.deepEqual(events.slice(0, 3), [
    [-122.34, 47.61],
    [-122.3302, 47.6202],
    "cached-fix-discarded",
  ]);
  assert.equal(events.includes("fresh-movement-fix"), true);
  assert.equal(targetInjections, 3);
}
console.log(
  "PASS a stale nearby cached fix waits for actual post-request movement, including providers that suppress identical coordinates."
);

for (const [platform, engine] of [
  ["ios", "maplibre"],
  ["ios", "mapbox"],
  ["android", "mapbox"],
]) {
  for (const outcome of [
    "fresh",
    "stale",
    "future",
    "wrong-coordinate",
    "injection-error",
  ]) {
    const events = [];
    let currentPosition = [-122.35, 47.6];
    const inject = async (coordinates) => {
      const expected = coordinates[0] !== -122.34;
      events.push(
        coordinates[0] === -122.33 ? "target" : expected ? "nearby" : "old"
      );
      if (expected && outcome === "injection-error")
        throw new Error("OS injection failed.");
      if (!expected || outcome !== "wrong-coordinate")
        currentPosition = coordinates;
      return "";
    };
    const run = runInNewContext(
      `${source.slice(freshnessStart, freshnessEnd)};
       ${source.slice(nativeStart, nativeEnd)}; nativeScenarios;`,
      {
        assert,
        platform,
        engine,
        simulator: "assigned-simulator",
        scenario: async (name, operation) => {
          if (name === "fresh native position from simulator injection")
            await operation();
        },
        delay: async () => {},
        nativeOfflineScenarios: async () => {},
        adb: async (args) => {
          assert.deepEqual(Array.from(args.slice(0, 3)), ["emu", "geo", "fix"]);
          return inject(args.slice(3).map(Number));
        },
        command: async (file, args) => {
          assert.equal(file, "xcrun");
          assert.deepEqual(Array.from(args.slice(0, 4)), [
            "simctl",
            "location",
            "assigned-simulator",
            "set",
          ]);
          const [latitude, longitude] = args[4].split(",").map(Number);
          return inject([longitude, latitude]);
        },
        action: async (name) => {
          assert.equal(name, "position");
          events.push("request");
          // Starting a subscription can immediately deliver a NEW fix at the
          // simulator's CURRENT coordinate, before any later injection runs.
          return {
            lngLat: [...currentPosition],
            requestedAt: 10000,
            timestamp:
              outcome === "stale" ? 9999 : outcome === "future" ? 11001 : 10000,
            completedAt: 10000,
          };
        },
      }
    );
    if (outcome === "fresh") {
      await run();
      assert.deepEqual(events, [
        "old",
        "nearby",
        "request",
        "target",
        "target",
        "target",
      ]);
    } else {
      await assert.rejects(
        run(),
        outcome === "injection-error"
          ? /OS injection failed/
          : assert.AssertionError
      );
      if (outcome === "injection-error")
        assert.equal(events.includes("request"), false);
    }
  }
}
console.log(
  "PASS native current-position acquisition installs a nearby coordinate before subscribing, retains later injections, and rejects stale/future/wrong fixes or failed OS input."
);
