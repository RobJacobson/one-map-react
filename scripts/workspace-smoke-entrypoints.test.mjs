import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { transformSync } from "@babel/core";

for (const [file, names] of [
  ["tf04-camera-smoke.mjs", ["runWebCorrections", "runWeb", "runNative"]],
  [
    "tf05-sources-smoke.mjs",
    ["main", "runWebCorrections", "runWeb", "runNative"],
  ],
  ["tf06-queries-smoke.mjs", ["runWeb", "runNative"]],
]) {
  transformSync(readFileSync(new URL(file, import.meta.url), "utf8"), {
    babelrc: false,
    configFile: false,
    code: false,
    plugins: [
      () => ({
        visitor: {
          Program: (path) => {
            for (const name of names)
              assert(
                path.scope.getBinding(name),
                `${file} lost executable ${name}`
              );
            for (const name of Object.keys(path.scope.globals))
              assert(!names.includes(name), `${file} invokes missing ${name}`);
          },
        },
      }),
    ],
  });
}
console.log(
  "PASS maintained camera/source/query runners retain their executable correction and native flows."
);

const rendering = readFileSync(
  new URL("tf09-rendering-smoke.mjs", import.meta.url),
  "utf8"
);
const startupStart = rendering.indexOf("  await serve();");
const startupEnd = rendering.indexOf(
  '  if (executionScope === "model") {',
  startupStart
);
assert(startupStart >= 0 && startupEnd > startupStart);
const { runInNewContext } = await import("node:vm");
for (const platform of ["web", "android", "ios"]) {
  const calls = [];
  await runInNewContext(
    `(async () => {${rendering.slice(startupStart, startupEnd)}})()`,
    {
      platform,
      serve: async () => {
        calls.push("fixture");
      },
      launchWeb: async () => {
        calls.push("web");
      },
      launchNative: async () => {
        calls.push("native");
      },
    }
  );
  assert.deepEqual(calls, ["fixture", platform === "web" ? "web" : "native"]);
}

const nativeStart = rendering.indexOf("const launchNative = async");
const nativeEnd = rendering.indexOf("\nconst connect =", nativeStart);
assert(nativeStart >= 0 && nativeEnd > nativeStart);
for (const executionScope of ["rendering", "camera", "model"]) {
  for (const busy of [false, true]) {
    const events = [];
    let fail;
    const launchNative = runInNewContext(
      `${rendering.slice(nativeStart, nativeEnd)}; launchNative;`,
      {
        assert,
        platform: "android",
        engine: "mapbox",
        executionScope,
        root: "/prepared",
        join: (...parts) => parts.join("/"),
        process: {
          env: {
            TF09_METRO_PORT: "8081",
            TF09_FIXTURE_PORT: "12798",
            TF09_IOS_UDID: "assigned-simulator",
          },
        },
        createServer: () => ({
          once: (_event, handler) => {
            fail = handler;
          },
          listen: (port, ready) => {
            assert.equal(port, 8081);
            events.push("port-probe");
            if (busy) fail(new Error("EADDRINUSE"));
            else ready();
          },
          close: (ready) => {
            events.push("port-released");
            ready();
          },
        }),
        nativeMetroArgs: (port) => ["expo-metro", String(port)],
        nativeEnvironment: (engine, scenario) => ({ engine, scenario }),
        start: (file, args, cwd, env) => {
          assert.equal(file, "node");
          assert.deepEqual(Array.from(args), ["expo-metro", "8081"]);
          assert.equal(cwd, "/prepared/apps/expo");
          assert.equal(env.engine, "mapbox");
          assert.equal(
            env.scenario,
            executionScope === "model" ? "tf09-model" : "tf09"
          );
          events.push("owned-metro");
        },
        AbortSignal,
        fetch: async (url) => {
          assert.equal(url, "http://127.0.0.1:8081/status");
          events.push("metro-ready");
          return { ok: true, text: async () => "packager-status:running" };
        },
        until: async (observe, timeout) => {
          assert.equal(timeout, 60000);
          assert.equal(await observe(), true);
        },
        launchNativeWorkspace: (options) => {
          assert.equal(options.platform, "android");
          assert.equal(options.iosDevice, "assigned-simulator");
          assert.equal(options.port, 8081);
          assert.deepEqual(Array.from(options.fixturePorts), [12798]);
          events.push("verified-app");
        },
      }
    );
    if (busy) {
      await assert.rejects(launchNative, /EADDRINUSE/);
      assert.deepEqual(events, ["port-probe"]);
    } else {
      await launchNative();
      assert.deepEqual(events, [
        "port-probe",
        "port-released",
        "owned-metro",
        "metro-ready",
        "verified-app",
      ]);
    }
  }
}
console.log(
  "PASS TF09 startup executes one platform launch, awaits owned Metro, selects the correct native scene, and rejects occupied ports before starting or touching an app."
);
