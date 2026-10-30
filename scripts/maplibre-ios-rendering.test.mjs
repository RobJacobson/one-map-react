import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { run, verifyCode } from "./maplibre-ios-rendering.mjs";

const temporary = mkdtempSync(join(tmpdir(), "one-map-rendering-unit-"));
try {
  const expected = {};
  for (const file of ["loader", "debug.dylib"]) {
    writeFileSync(join(temporary, file), file);
    expected[file] = createHash("sha256").update(file).digest("hex");
  }
  verifyCode(temporary, expected);
  writeFileSync(join(temporary, "loader"), "stale");
  assert.throws(() => verifyCode(temporary, expected), /loader/);
  writeFileSync(join(temporary, "loader"), "loader");
  writeFileSync(join(temporary, "debug.dylib"), "stale");
  assert.throws(() => verifyCode(temporary, expected), /debug.dylib/);
  await assert.rejects(run(temporary), /EEXIST/);
  await assert.rejects(run(temporary, "other"), /Choose mapbox or maplibre/);

  const source = readFileSync(
    new URL("./ios-rendering.mjs", import.meta.url),
    "utf8"
  )
    .replace(/^import[\s\S]*?from "[^\n]+";\n/gm, "")
    .replaceAll("export const", "const")
    .replace('resolve(import.meta.dirname, "..")', '"/review"')
    .replace(/if \(\s*process.argv\[1\][\s\S]*$/, "");
  // Execute orchestration with fake host commands; no simulator or SDK is contacted.
  for (const engine of ["maplibre", "mapbox"])
    for (const failAt of [
      null,
      "unowned-boot",
      "launch",
      "driver",
      "identity",
      "busy-port",
      "app-metadata",
      "metro-zero-exit",
      "startup-timeout",
      "spawn-error",
      "partial-scene",
      "wrong-scene",
      "changed-runtime-input",
      "cleanup",
      "ipv6-listener",
      "transient-timeout",
      "terminal-timeout",
      "already-terminated",
      "malformed-scene",
      "driver-cleanup",
      "sdk-metadata",
      "sdk-pin",
      "code",
      ...(engine === "mapbox"
        ? ["missing-token", "whitespace-token", "pod-lock"]
        : []),
    ]) {
      const commands = [];
      const stopped = [];
      let receipt;
      let clock = 0;
      const children = [];
      let containers = 0;
      let requests = 0;
      const executable =
        engine === "mapbox" ? "OneMapMapbox" : "OneMapMaplibre";
      const installed = `/Users/rob/Library/Developer/CoreSimulator/Devices/8B7D7CE4-228E-409F-A156-A597D4E448A5/data/Containers/Bundle/Application/${engine === "mapbox" ? "4030A7F3-7E06-4170-96F5-ADE0A2FED943" : "2F6151E0-5FF8-48BA-A4C5-1EB7117C3011"}/${executable}.app`;
      const code =
        engine === "mapbox"
          ? {
              OneMapMapbox:
                "b967daf157aa88bafb08a545fdbd41c8ab91ba996694e95b6b9383127b4bd231",
              "OneMapMapbox.debug.dylib":
                "340888a46351e6f1bf05c056bc06757c815abfde1c3f44b4b6f799ef3bc30d46",
            }
          : {
              OneMapMaplibre:
                "d80f726009e71ff5d3c27d4eee23020d7eddb33b0b5a526b31177cb278d67ff3",
              "OneMapMaplibre.debug.dylib":
                "70e338d2f3101368f657d885319b904fb195639b8c232532c14e6ff6f71457ff",
            };
      const context = {
        assert,
        AbortSignal,
        existsSync: () => true,
        join,
        resolve: (value) => value,
        process: {
          env: {
            MAPBOX_ACCESS_TOKEN:
              engine === "maplibre" || failAt === "missing-token"
                ? ""
                : failAt === "whitespace-token"
                  ? "   "
                  : "redacted-test-token",
          },
          execPath: "/node",
          argv: [],
        },
        Date: { now: () => (clock += 1000) },
        setTimeout: (done) => {
          done();
        },
        mkdirSync: () => {},
        statfsSync: () => ({ bavail: 2 * 1024 ** 3, bsize: 1 }),
        createHash: () => {
          let content;
          return {
            update(value) {
              content = value;
              return this;
            },
            digest: () =>
              String(content).startsWith('{"files"')
                ? "freeze-hash"
                : (code[content] ?? content),
          };
        },
        readFileSync: (file) => {
          if (
            file === "/observer" &&
            failAt === "changed-runtime-input" &&
            containers >= 2
          )
            return "changed";
          if (file.endsWith("rendering-preparation.json"))
            return JSON.stringify({
              stagedSha256: { "/observer": "observer" },
              freeze: {
                path: "/post-restoration-freeze.json",
                sha256: "freeze-hash",
              },
            });
          if (file.endsWith("post-restoration-freeze.json"))
            return JSON.stringify({
              files: Object.fromEntries(
                Array.from({ length: 695 }, (_, index) => [
                  `/f${index}`,
                  `f${index}`,
                ])
              ),
            });
          if (file.endsWith("Podfile.lock") || file.endsWith("Manifest.lock"))
            return failAt === "pod-lock" || failAt === "sdk-pin"
              ? "wrong-lock"
              : "8fbf35cf242d154c372cb816f4e6c3f309072799ac95c40e2ef128dbdb073874";
          if (file.endsWith("Package.resolved"))
            return JSON.stringify({
              pins: [
                {
                  identity: "maplibre-gl-native-distribution",
                  state: {
                    version: failAt === "sdk-pin" ? "0.0.0" : "6.31.0",
                    revision: "13e41ab3d77ff5113e7e5d4ee87803b1f81f5683",
                  },
                },
              ],
            });
          if (file.endsWith("scene.json")) {
            if (failAt === "malformed-scene") return "{";
            return JSON.stringify({
              platform: failAt === "wrong-scene" ? "android" : "ios",
              engine,
              artifact:
                "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5",
              nativeIdentity: JSON.stringify(code),
              outcomes: [
                "known rendered feature and initial no-data",
                ...(engine === "mapbox"
                  ? [
                      "terrain enabled before delayed DEM attachment",
                      "explicit terrain clear and projection change",
                    ]
                  : []),
                "hillshade draws the fixture's slope patch",
                ...(engine === "mapbox"
                  ? [
                      "globe projection has independently different viewport output",
                    ]
                  : []),
                "rendered output contains the known orange feature",
              ]
                .slice(0, failAt === "partial-scene" ? 1 : undefined)
                .map((name) => ({ name, status: "passed" })),
            });
          }
          if (failAt === "code" && file.endsWith(executable))
            return "wrong-code";
          return file.split("/").at(-1);
        },
        writeFileSync: (_file, content) => {
          receipt = JSON.parse(content);
        },
        createRequire: () => () => ({}),
        execFile: null,
        promisify: () => async (file, args) => {
          if (file === "/usr/sbin/lsof") {
            if (["busy-port", "ipv6-listener"].includes(failAt))
              return { stdout: "unknown IPv6 listener" };
            throw Object.assign(new Error("No listener"), {
              code: 1,
              stdout: "",
              stderr: "",
            });
          }
          const command = args[1];
          if (command === "bootstatus") assert(!args.includes("-b"));
          commands.push(command);
          if (command === "terminate" && failAt === "already-terminated")
            throw Object.assign(new Error("already stopped"), {
              stderr: "no such process",
            });
          if (command === "launch" && failAt === "launch")
            throw new Error("launch rejected");
          let stdout = "";
          if (file === "plutil")
            stdout = JSON.stringify(
              args.at(-1).includes("Frameworks/")
                ? {
                    CFBundleShortVersionString:
                      failAt === "sdk-metadata"
                        ? "0.0.0"
                        : args.at(-1).includes("MapboxCoreMaps")
                          ? "11.23.1"
                          : args.at(-1).includes("MapboxCommon")
                            ? "24.23.1"
                            : "6.31.0",
                  }
                : {
                    CFBundlePackageType: "APPL",
                    CFBundleIdentifier: `org.reactjs.native.example.${executable}`,
                    CFBundleExecutable:
                      failAt === "app-metadata" ? "OtherApp" : executable,
                    CFBundleShortVersionString: "1.0",
                    CFBundleVersion: "1",
                  }
            );
          if (command === "list")
            stdout = JSON.stringify({
              devices: {
                runtime: [
                  {
                    udid: "8B7D7CE4-228E-409F-A156-A597D4E448A5",
                    isAvailable: true,
                    state: failAt === "unowned-boot" ? "Booted" : "Shutdown",
                  },
                ],
              },
            });
          if (command === "get_app_container")
            stdout =
              ++containers === 2 && failAt === "identity"
                ? "/wrong-app"
                : installed;
          return { stdout };
        },
        spawn: () => {
          const child = new EventEmitter();
          Object.assign(child, {
            pid: children.length + 1,
            exitCode: null,
            signalCode: null,
          });
          children.push(child);
          return child;
        },
        fetch: async (url) => {
          if (url.endsWith("8081/status")) {
            requests += 1;
            if (
              failAt === "terminal-timeout" ||
              (failAt === "transient-timeout" && requests === 1)
            )
              throw Object.assign(new Error("fetch timed out"), {
                name: "TimeoutError",
              });
            if (failAt === "metro-zero-exit") children[0].emit("exit", 0, null);
            if (failAt === "spawn-error")
              children[0].emit("error", new Error("spawn rejected"));
          }
          if (url.endsWith("8798/command")) {
            children[1].exitCode = [
              "driver",
              "malformed-scene",
              "driver-cleanup",
            ].includes(failAt)
              ? 1
              : 0;
            children[1].emit("exit", children[1].exitCode, null);
          }
          return {
            ok: true,
            text: async () =>
              failAt === "startup-timeout"
                ? "other-server"
                : "packager-status:running",
          };
        },
        stopOwnedProcess: async (child) => {
          stopped.push(child.pid);
          if (["cleanup", "driver-cleanup"].includes(failAt))
            throw new Error("cleanup rejected");
        },
      };
      await runInNewContext(`${source}\nrun("/attempt", "${engine}")`, context);
      assert.equal(
        receipt.result,
        failAt &&
          !["unowned-boot", "transient-timeout", "already-terminated"].includes(
            failAt
          )
          ? "failed"
          : "passed",
        failAt ?? "success"
      );
      if (["busy-port", "ipv6-listener"].includes(failAt))
        assert.equal(commands.length, 0);
      assert.deepEqual(stopped, children.map((child) => child.pid).reverse());
      assert.equal(
        commands.includes("shutdown"),
        ![
          "busy-port",
          "ipv6-listener",
          "unowned-boot",
          "missing-token",
          "whitespace-token",
          "code",
        ].includes(failAt)
      );
      assert(!commands.includes("-b"));
      if (
        [
          "driver",
          "malformed-scene",
          "driver-cleanup",
          "wrong-scene",
          "partial-scene",
        ].includes(failAt)
      )
        assert.equal(containers, 1, "No SDK queries after scene failure");
      assert(!JSON.stringify(receipt).includes("redacted-test-token"));
      assert.equal(
        commands.filter((command) => command === "terminate").length,
        commands.includes("launch")
          ? 2
          : commands.includes("bootstatus") &&
              !["app-metadata", "sdk-metadata", "sdk-pin", "pod-lock"].includes(
                failAt
              )
            ? 1
            : 0
      );
      if (["driver", "malformed-scene", "driver-cleanup"].includes(failAt))
        assert.match(receipt.error, /exited/);
      if (failAt === "changed-runtime-input")
        assert.match(receipt.error, /Staged runtime input changed/);
      if (failAt === "malformed-scene")
        assert.match(receipt.sceneReadError, /SyntaxError/);
      if (failAt === "driver-cleanup")
        assert(receipt.cleanup.some((item) => item.error));
      if (failAt === "metro-zero-exit")
        assert.match(receipt.error, /Metro exited/);
      if (["startup-timeout", "terminal-timeout"].includes(failAt))
        assert.match(receipt.error, /timed out/);
    }
  console.log(
    "PASS rendering preparation: stale debug code, exclusive output, successful single scene, launch/driver/identity failures and unknown-listener ownership."
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
