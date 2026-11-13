import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Exercise runner ownership with fake Metro, SDK observations and host commands.
for (const name of ["tf04-camera", "tf05-sources", "tf06-queries"]) {
  const source = readFileSync(
    new URL(`${name}-smoke.mjs`, import.meta.url),
    "utf8"
  );
  const extract = (start, end) => {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a);
    assert(a >= 0 && b > a);
    return source.slice(a, b);
  };
  for (const mode of ["timeout", "nonzero", "abort"]) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const controller = new AbortController();
    let stopped = false;
    const command = runInNewContext(
      `(${extract("function command(", "async function freePort(")})`,
      {
        setTimeout,
        clearTimeout,
        spawn: (_file, _args, options) => {
          assert.equal(options.detached, true);
          assert.equal(options.signal, controller.signal);
          options.signal.addEventListener("abort", () =>
            child.emit("error", new Error("aborted"))
          );
          return child;
        },
        stopOwnedProcess: async (owned) => {
          assert.equal(owned, child);
          stopped = true;
          child.emit("close", null);
        },
      }
    );
    const pending = command(
      "fake-host-tool",
      [],
      { signal: controller.signal },
      5
    );
    if (mode === "abort") controller.abort();
    if (mode === "nonzero") child.emit("close", 2);
    await assert.rejects(pending);
    assert(stopped);
  }
  for (const mode of ["pass", "busy", "broken"]) {
    const freePort = runInNewContext(
      `(${extract("async function freePort(", "\n}") + "\n}"})`,
      {
        command: async () => {
          if (mode === "busy") return "123";
          throw new Error(mode === "pass" ? "lsof exited 1" : "lsof failed");
        },
      }
    );
    if (mode === "pass") await freePort(8081);
    else await assert.rejects(freePort(8081));
  }
  for (const platform of ["android", "ios"]) {
    for (const mode of [
      "pass",
      "port",
      "bind",
      "launch",
      "observe",
      "cleanup",
      "metro",
    ]) {
      const events = [];
      const metro = new EventEmitter();
      metro.stdout = new EventEmitter();
      metro.stderr = new EventEmitter();
      const run = runInNewContext(
        `(${extract("async function runNative(", "async function watchNative(")})`,
        {
          Error,
          console: { error: () => {} },
          root: "/prepared",
          join: (...parts) => parts.join("/"),
          process: { env: { ANDROID_SERIAL: "assigned-android" } },
          iosDevice: "assigned-ios",
          lifetimes: false,
          fixture: null,
          nativeApplicationId: () => "org.onemap.acceptance.test",
          nativeMetroArgs: () => ["expo-metro"],
          nativeEnvironment: (engine, scenario) => ({ engine, scenario }),
          freePort: async () => {
            if (mode === "port") throw new Error("port");
          },
          spawn: (file, args, options) => {
            assert.equal(file, "node");
            assert.equal(options.cwd, "/prepared/apps/expo");
            assert.equal(options.env.engine, "maplibre");
            events.push("metro");
            return metro;
          },
          openStatusPort: async () => {
            if (mode === "bind") throw new Error("bind");
            return {
              read: () => "status",
              close: async () => {
                events.push("status-close");
                if (mode === "cleanup") throw new Error("cleanup");
              },
            };
          },
          fetch: async () => ({
            ok: true,
            text: async () => "packager-status:running",
          }),
          waitFor: async (ready) => {
            if (mode === "metro") metro.emit("error", new Error("metro"));
            await ready();
          },
          launchNativeWorkspace: (options) => {
            assert.equal(options.platform, platform);
            assert.equal(options.iosDevice, "assigned-ios");
            events.push("launch");
            if (mode === "launch") throw new Error("launch");
            return { pid: 123 };
          },
          allowNearbyDevices: async () => {},
          readAndroidStatus: async () => "status",
          watchNative: async ({ readStatus }) => {
            if (mode === "observe") throw new Error("observe");
            await readStatus();
            return "done";
          },
          judge: () => ({ status: "passed" }),
          command: async (file, args) => {
            assert(args.includes("org.onemap.acceptance.test"));
            if (file === "adb") assert(args.includes("assigned-android"));
            else assert(args.includes("assigned-ios"));
            events.push("stop-app");
          },
          stopOwnedProcess: async (child) => {
            assert.equal(child, metro);
            events.push("stop-metro");
          },
        }
      );
      let result;
      try {
        result = await run({
          directory: "native-maplibre",
          platform,
          doubleTap: false,
        });
      } catch (error) {
        assert(
          mode === "port" || (mode === "cleanup" && platform === "ios"),
          String(error)
        );
      }
      if (mode === "port") assert.deepEqual(events, []);
      else {
        assert(events.includes("stop-metro"), `${name} ${platform} ${mode}`);
        if (events.includes("launch")) assert(events.includes("stop-app"));
        if (["launch", "observe", "metro"].includes(mode))
          assert.equal(result.status, "failed");
      }
    }
  }
}
console.log(
  "PASS workspace runner port failures, installed-app targeting, Metro failure, observation failure and owned cleanup; no host tools executed."
);
