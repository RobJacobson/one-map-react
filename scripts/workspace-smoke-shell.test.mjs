import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import {
  nativeApplicationId,
  nativeEnvironment,
  nativeMetroArgs,
  webScenarioUrl,
  webShell,
} from "./workspace-smoke-shell.mjs";

const previous = {
  shell: process.env.ONE_MAP_WEB_SHELL,
  app: process.env.ONE_MAP_ACCEPTANCE_APP_ID,
};
try {
  for (const kind of ["vite", "expo"]) {
    process.env.ONE_MAP_WEB_SHELL = kind;
    const launch = webShell("/repo", 4173);
    assert.equal(
      launch.cwd,
      kind === "vite" ? "/repo/apps/web" : "/repo/apps/expo"
    );
    assert(launch.args.includes("4173"));
    const url = new URL(
      webScenarioUrl("/repo", 4173, "tf03=reuse&auto=1", "mapbox")
    );
    assert.equal(url.searchParams.get("engine"), "mapbox");
    assert.equal(url.searchParams.get("tf03"), "reuse");
    assert.equal(url.searchParams.get("auto"), "1");
    assert.equal(url.hostname, kind === "expo" ? "localhost" : "127.0.0.1");
  }
  process.env.ONE_MAP_WEB_SHELL = "other";
  assert.throws(() => webShell("/repo", 1));
  const environment = nativeEnvironment("mapbox", "tf09", {
    TF05_BASE: "http://127.0.0.1:8798",
  });
  assert.equal(environment.EXPO_PUBLIC_ONE_MAP_ENGINE, "mapbox");
  assert.equal(environment.EXPO_PUBLIC_ONE_MAP_SCENARIO, "tf09");
  assert.equal(environment.TF05_BASE, "http://127.0.0.1:8798");
  assert(nativeMetroArgs().includes("--dev-client"));
  process.env.ONE_MAP_ACCEPTANCE_APP_ID = "com.onemap.example";
  assert.throws(() => nativeApplicationId());
  process.env.ONE_MAP_ACCEPTANCE_APP_ID =
    "org.onemap.acceptance.migration.tf08remaining";
  assert.equal(nativeApplicationId(), process.env.ONE_MAP_ACCEPTANCE_APP_ID);
} finally {
  for (const [key, value] of [
    ["ONE_MAP_WEB_SHELL", previous.shell],
    ["ONE_MAP_ACCEPTANCE_APP_ID", previous.app],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
console.log(
  "PASS workspace launches: both maintained web shells preserve scenario/engine selection; native Metro uses explicit test scope and isolated application IDs."
);

const launchSource = readFileSync(
  new URL("./workspace-smoke-shell.mjs", import.meta.url),
  "utf8"
).split("export const launchNativeWorkspace = ")[1];
assert(launchSource, "Native workspace launcher is missing.");
const installedPath =
  "/data/app/~~assigned-1==/org.onemap.acceptance.fixture-2==/base.apk";
const expectedDigest = "a".repeat(64);

const checkInstalledApk = ({
  packagePath = `package:${installedPath}\n`,
  digestOutput = `${expectedDigest}  ${installedPath}\n`,
  pidResults = ["1234\n"],
} = {}) => {
  const commands = [];
  const queryTimeouts = [];
  const logs = [];
  let clock = 0;
  let pidReads = 0;
  const launch = runInNewContext(
    `const launchNativeWorkspace = ${launchSource}; launchNativeWorkspace;`,
    {
      assert,
      Date: { now: () => clock },
      Atomics: {
        wait: (_array, _index, _value, delay) => {
          clock += delay;
        },
      },
      console: { log: (message) => logs.push(message) },
      nativeApplicationId: () => "org.onemap.acceptance.fixture",
      process: {
        env: {
          ANDROID_SERIAL: "assigned-emulator",
          ONE_MAP_NATIVE_BINARY_SHA256: expectedDigest,
        },
      },
      execFileSync: (file, args, options) => {
        assert.equal(file, "adb");
        assert.deepEqual(Array.from(args.slice(0, 2)), [
          "-s",
          "assigned-emulator",
        ]);
        const command = Array.from(args.slice(2));
        commands.push(command);
        if (command[0] === "exec-out")
          throw new Error(
            "APK must be hashed on the device without buffering its bytes."
          );
        if (command[1] === "pm") return packagePath;
        if (command[1] === "sha256sum") {
          assert.deepEqual(command, ["shell", "sha256sum", installedPath]);
          return digestOutput;
        }
        if (command[1] === "pidof") {
          queryTimeouts.push(options.timeout);
          const reply = pidResults[Math.min(pidReads, pidResults.length - 1)];
          pidReads += 1;
          if (reply instanceof Error) throw reply;
          return reply;
        }
        if (command[1] === "am" && command[2] === "start")
          return "Status: ok\nActivity: org.onemap.acceptance.fixture/.MainActivity\n";
        return "";
      },
    }
  );
  try {
    const result = launch({ platform: "android", fixturePorts: [] });
    return { commands, result, queryTimeouts, logs, clock };
  } catch (error) {
    return { commands, error, queryTimeouts, logs, clock };
  }
};

const validApk = checkInstalledApk();
assert.ifError(validApk.error);
assert.equal(validApk.result.pid, 1234);
assert(validApk.commands.some((command) => command.includes("force-stop")));
for (const fault of [
  { digestOutput: `${"b".repeat(64)}  ${installedPath}\n` },
  { digestOutput: `not-a-digest  ${installedPath}\n` },
  { digestOutput: `${expectedDigest}  /data/app/other/base.apk\n` },
  { digestOutput: `${expectedDigest}  ${installedPath}\nextra-output\n` },
  { packagePath: "package:/data/app/unsafe;command/base.apk\n" },
  { packagePath: "package:/data/app/../base.apk\n" },
  { packagePath: "package:/other/base.apk\n" },
]) {
  const rejected = checkInstalledApk(fault);
  assert(rejected.error, "Invalid installed APK identity was accepted.");
  assert(
    rejected.commands.every(
      (command) => command[1] === "pm" || command[1] === "sha256sum"
    ),
    "Identity failure must reject before port changes, force-stop or app input."
  );
}
console.log(
  "PASS installed APK identity: device-side digest avoids binary buffers and rejects unsafe paths, malformed output and mismatches before launching."
);

const missingPid = Object.assign(new Error("No process yet"), {
  status: 1,
  stdout: "",
  stderr: "",
});
for (const pidResults of [
  ["", "1234\n"],
  [missingPid, "1234\n"],
  ["17492 18035\n", "1234\n"],
]) {
  const delayed = checkInstalledApk({ pidResults });
  assert.ifError(delayed.error);
  assert.equal(delayed.result.pid, 1234);
  assert.equal(delayed.queryTimeouts.length, 2);
  assert.equal(delayed.clock, 200);
  assert(
    delayed.queryTimeouts.every((timeout) => timeout > 0 && timeout <= 2000)
  );
  assert.equal(
    delayed.commands.filter((command) => command.includes("force-stop")).length,
    1
  );
  assert.equal(
    delayed.commands.filter((command) => command[2] === "start").length,
    1
  );
  assert.match(delayed.logs[0], /"attempts":2/);
}
for (const output of [
  "0",
  "-1",
  "1.5",
  "9007199254740992",
  "1234 unexpected",
  "01234",
]) {
  const rejected = checkInstalledApk({ pidResults: [output] });
  assert(rejected.error);
  assert.match(rejected.error.message, /Invalid launched app PID/);
  assert.equal(rejected.queryTimeouts.length, 1);
  assert(rejected.error.message.includes(output));
}
for (const output of ["", "17492 18035\n"]) {
  const rejected = checkInstalledApk({ pidResults: [output] });
  assert(rejected.error);
  assert.match(rejected.error.message, /readiness timed out/);
  assert(rejected.error.message.includes("Status: ok"));
  assert(rejected.error.message.includes('"stdout":'));
  assert(rejected.error.message.includes('"status":'));
  assert(rejected.error.message.includes('"stderr":'));
  assert.equal(rejected.clock, 10000);
  assert(
    rejected.queryTimeouts.length > 1 && rejected.queryTimeouts.length <= 50
  );
  assert(
    rejected.queryTimeouts.every((timeout) => timeout > 0 && timeout <= 2000)
  );
  assert(rejected.queryTimeouts.at(-1) < 2000);
}
for (const failure of [
  Object.assign(new Error("device offline"), {
    status: 1,
    stdout: "",
    stderr: "error: device offline",
  }),
  Object.assign(new Error("pid query timed out"), {
    status: null,
    signal: "SIGTERM",
    stdout: "",
    stderr: "",
  }),
]) {
  const adbFailure = checkInstalledApk({ pidResults: [failure] });
  assert(adbFailure.error);
  assert.match(adbFailure.error.message, /PID query failed/);
  assert(adbFailure.error.message.includes(failure.message));
  assert.equal(adbFailure.queryTimeouts.length, 1);
}
console.log(
  "PASS Android PID readiness: delayed and multiple processes settle without relaunch; malformed IDs and real ADB errors fail immediately; missing or ambiguous IDs time out with bounded diagnostics."
);

const checkInstalledIos = ({
  debug = true,
  mismatch = false,
  terminateError,
} = {}) => {
  const commands = [];
  const image = Buffer.from("reviewed installed test image");
  const reads = [];
  const launch = runInNewContext(
    `const launchNativeWorkspace = ${launchSource}; launchNativeWorkspace;`,
    {
      assert,
      createHash,
      join,
      existsSync: () => debug,
      readFileSync: (path) => {
        reads.push(path);
        return image;
      },
      nativeApplicationId: () => "org.onemap.acceptance.fixture",
      process: {
        env: {
          ONE_MAP_NATIVE_BINARY_SHA256: mismatch
            ? "0".repeat(64)
            : createHash("sha256").update(image).digest("hex"),
        },
      },
      execFileSync: (file, args) => {
        const command = [file, ...args];
        commands.push(command);
        if (args.includes("get_app_container")) return "/sim/app\n";
        if (file === "/usr/libexec/PlistBuddy") return "OneMap\n";
        if (args.includes("terminate") && terminateError) throw terminateError;
        return "";
      },
    }
  );
  try {
    launch({ platform: "ios", iosDevice: "dedicated-simulator" });
    return { commands, reads };
  } catch (error) {
    return { commands, reads, error };
  }
};
for (const debug of [true, false]) {
  const checked = checkInstalledIos({ debug });
  assert.ifError(checked.error);
  assert.deepEqual(checked.reads, [
    debug ? "/sim/app/OneMap.debug.dylib" : "/sim/app/OneMap",
  ]);
  assert.deepEqual(
    checked.commands.slice(2).map((command) => command.slice(0, 3)),
    [
      ["xcrun", "simctl", "terminate"],
      ["xcrun", "simctl", "launch"],
      ["xcrun", "simctl", "openurl"],
    ]
  );
  assert.deepEqual(checked.commands[3], [
    "xcrun",
    "simctl",
    "launch",
    "dedicated-simulator",
    "org.onemap.acceptance.fixture",
    "-EXDevMenuShowFloatingActionButton",
    "NO",
  ]);
}
const mismatchedIos = checkInstalledIos({ mismatch: true });
assert.match(mismatchedIos.error.message, /Installed iOS image changed/);
assert.equal(mismatchedIos.commands.length, 2);
const stoppedIos = checkInstalledIos({
  terminateError: Object.assign(new Error("not running"), {
    stderr: "found nothing to terminate",
  }),
});
assert.ifError(stoppedIos.error);
const failedIos = checkInstalledIos({
  terminateError: Object.assign(new Error("simulator unavailable"), {
    stderr: "device unavailable",
  }),
});
assert.match(failedIos.error.message, /simulator unavailable/);
assert.equal(failedIos.commands.length, 3);
console.log(
  "PASS iOS launch: verified installed image precedes restart with Expo tools disabled for the test process; identity and termination failures stop launch."
);
