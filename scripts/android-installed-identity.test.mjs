import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./android-rendering.mjs", import.meta.url),
  "utf8"
);
const executeSource = source.slice(
  source.indexOf("  const redact ="),
  source.indexOf("  const android =")
);
const identitySource = source.slice(
  source.indexOf("  const identity ="),
  source.indexOf("  const isEmulatorRunning =")
);
const expected = "a".repeat(64);
const path = "/data/app/~~abc==/com.onemapmapbox-abc==/base.apk";
const receipt = {};
const execute = runInNewContext(`${executeSource}\nexecute`, {
  execFile,
  promisify,
  process,
  Date,
  receipt,
  record: () => {},
});

// Real local child processes exercise execFile failures without an Android tool.
for (const [script, timeout, code, signal, killed] of [
  [
    'process.stderr.write("adb: device offline\\n"); process.exit(7)',
    3000,
    7,
    null,
    false,
  ],
  ['process.kill(process.pid, "SIGTERM")', 3000, null, "SIGTERM", false],
  ["setInterval(() => {}, 1000)", 100, null, "SIGTERM", true],
]) {
  await assert.rejects(execute(process.execPath, ["-e", script], timeout));
  const failure = receipt.commandFailures?.at(-1);
  assert.ok(
    failure,
    "Command transport must retain structured failure evidence."
  );
  assert.equal(failure.code, code);
  assert.equal(failure.signal, signal);
  assert.equal(failure.killed, killed);
  assert.equal(failure.timeoutMs, timeout);
  assert.ok(failure.elapsedMs >= 0);
  if (code === 7) assert.match(failure.stderr, /device offline/);
}

for (const [output, succeeds] of [
  [`${expected}  ${path}\n`, true],
  ["", false],
  [`${expected}\n`, false],
  [`${expected}  /wrong/base.apk\n`, false],
  [`${expected}  ${path}\n${expected}  ${path}\n`, false],
  [`${"b".repeat(64)}  ${path}\n`, false],
]) {
  const calls = [];
  const identityReceipt = {};
  const identity = runInNewContext(`${identitySource}\nidentity`, {
    assert,
    join,
    output: "/attempt",
    apk: "/input.apk",
    apkSha256: expected,
    applicationId: "com.onemapmapbox",
    sha256: () => expected,
    receipt: identityReceipt,
    record: () => {},
    rmSync: () => {},
    adb: async (args) => {
      calls.push(args);
      if (args.join(" ") === "shell pm path com.onemapmapbox")
        return `package:${path}\n`;
      assert.equal(
        args.join(" "),
        `shell /system/bin/toybox sha256sum ${path}`
      );
      return execute(process.execPath, [
        "-e",
        "process.stdout.write(process.argv[1])",
        output,
      ]);
    },
  });
  if (succeeds) {
    await identity("before");
    assert.equal(identityReceipt.identityReads[0].sha256, expected);
    assert.equal(identityReceipt.identityReads[0].path, path);
  } else await assert.rejects(identity("before"));
  assert.equal(calls.length, 2);
  assert.ok(calls.every((args) => args[0] !== "pull"));
}
const secret = "private-mapbox-token";
const redactedReceipt = {};
const redactedExecute = runInNewContext(`${executeSource}\nexecute`, {
  execFile,
  promisify,
  Date,
  receipt: redactedReceipt,
  process: { env: { ...process.env, MAPBOX_ACCESS_TOKEN: secret } },
});
await assert.rejects(
  redactedExecute(process.execPath, [
    "-e",
    "process.stderr.write(process.argv[1]); process.exit(1)",
    secret,
  ])
);
assert.ok(!JSON.stringify(redactedReceipt).includes(secret));
assert.match(redactedReceipt.commandFailures[0].stderr, /<REDACTED>/);

for (const unsafe of [
  "/data/app/a;echo-secret/base.apk",
  "/data/app/a$(id)/base.apk",
  "/data/app/a'bad/base.apk",
]) {
  const identity = runInNewContext(`${identitySource}\nidentity`, {
    assert,
    apk: "/input.apk",
    apkSha256: expected,
    applicationId: "com.onemapmapbox",
    sha256: () => expected,
    adb: async (args) => {
      assert.equal(args.join(" "), "shell pm path com.onemapmapbox");
      return `package:${unsafe}\n`;
    },
  });
  await assert.rejects(identity("before"));
}
console.log(
  "Android installed APK identity and command transport regressions passed."
);
