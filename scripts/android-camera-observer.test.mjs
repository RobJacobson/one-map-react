import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  observeCamera,
  parseStatus,
  statusReader,
} from "./android-camera-observer.mjs";

const waiting =
  "TF04 fit=ok click=pending clickAt=pending stop=pending held=pending command=pending doubletap=skip center=-122.32000,47.64000 note=none phase=await-click done=0";
const done =
  "TF04 fit=ok click=hit clickAt=-122.32000,47.64000 stop=rejected held=0 command=applied doubletap=skip center=-120.00000,45.00000 note=none phase=done done=1";
const xml = (text, packageName = "com.onemapmapbox", id = "tf04-status") =>
  `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy><node package="${packageName}" resource-id="${id}" text="${text}" /></hierarchy>`;
const read = (input) =>
  spawnSync("python3", ["-c", statusReader], { input, encoding: "utf8" });
assert.equal(JSON.parse(read(xml(waiting)).stdout), waiting);
assert.equal(JSON.parse(read(xml(done, "other.app")).stdout), null);
assert.equal(
  JSON.parse(read(xml(done, "com.onemapmapbox", "other-status")).stdout),
  null
);
assert.notEqual(read("<?xml version='1.0'?><hierarchy><node").status, 0);
assert.notEqual(
  read(
    `<hierarchy>${xml(done).split("<hierarchy>")[1].replace("</hierarchy>", "").repeat(2)}</hierarchy>`
  ).status,
  0
);
assert.equal(parseStatus(done).stop, "rejected");
for (const text of [
  "",
  done.replace(" done=1", ""),
  done + " done=1",
  done.replace("phase=done", "phase=unknown"),
  done.replace("done=1", "done=0"),
])
  assert.throws(() => parseStatus(text));

for (const [label, lines, passed, expectedTaps] of [
  ["pass", [null, waiting, waiting, done], true, 1],
  ["missing", [null, null], false, 0],
  ["disappeared", [waiting, null], false, 1],
  [
    "stale phase",
    [waiting, waiting.replace("phase=await-click", "phase=await-fit")],
    false,
    1,
  ],
  [
    "wrong fit center",
    [waiting.replace("-122.32000,47.64000", "0.00000,0.00000")],
    false,
    0,
  ],
  ["no input", [done], false, 0],
  ["combined cleanup failure", ["malformed"], false, 0],
  ...[
    "stop=resolved",
    "stop=stayed",
    "held=1",
    "command=missed",
    "note=getCenter-error",
    "center=0.00000,0.00000",
    "clickAt=0.00000,0.00000",
  ].map((change) => {
    const key = change.split("=")[0];
    return [
      change,
      [waiting, done.replace(new RegExp(`${key}=[^ ]+`), change)],
      false,
      1,
    ];
  }),
]) {
  let index = 0;
  const calls = [];
  let observation;
  const run = () =>
    observeCamera({
      adb: async (args) => {
        calls.push(args);
        if (
          label === "combined cleanup failure" &&
          calls.length > 3 &&
          args.includes("rm")
        )
          throw new Error("XML cleanup failure");
        if (args.includes("size")) return "Physical size: 1080x2400\n";
        if (args[0] === "exec-out") return "xml";
        return "";
      },
      execute: async () =>
        JSON.stringify(lines[Math.min(index++, lines.length - 1)]),
      until: async (observe) => {
        for (let attempt = 0; attempt < 5; attempt++)
          if (await observe()) return;
        throw new Error("bounded timeout");
      },
      record: (value) => {
        observation = value;
      },
    });
  if (passed) await run();
  else
    await assert.rejects(
      run,
      label === "combined cleanup failure"
        ? /Missing TF04 status prefix/
        : undefined,
      label
    );
  if (label === "combined cleanup failure")
    assert.match(observation.xmlCleanupError, /XML cleanup failure/);
  assert.equal(
    calls.filter((args) => args.includes("tap")).length,
    expectedTaps,
    label
  );
  const dumps = calls.filter((args) => args.includes("dump"));
  const owned = dumps[0]?.at(-1);
  assert.match(owned, /^\/sdcard\/one-map-tf04-[a-f0-9-]+\.xml$/);
  for (const args of dumps) {
    const before = calls[calls.indexOf(args) - 1];
    assert.deepEqual(before, ["shell", "rm", "-f", owned]);
  }
  assert.deepEqual(calls.at(-1), ["shell", "rm", "-f", owned]);
  if (passed) assert.deepEqual(observation.tap, ["540", "1488"]);
}
console.log(
  "Camera XML/status parsing, phase-gated input and failure bounds passed."
);
