import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { stopOwnedProcess } from "./native-smoke-process.mjs";

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
};

const awaitGone = async (pid) => {
  const deadline = Date.now() + 5000;
  while (alive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(alive(pid), false, `Owned child ${pid} survived cleanup`);
};

// Run the real web finally blocks with tiny owned processes and a forced startup
// failure. The injected spawn never launches the requested server or browser.
for (const name of ["tf04-camera", "tf05-sources", "tf06-queries"]) {
  const source = readFileSync(
    new URL(`./${name}-smoke.mjs`, import.meta.url),
    "utf8"
  );
  const web = source.slice(
    source.indexOf("async function runWeb("),
    source.indexOf("async function attachPage(")
  );
  const children = [];
  let descendantPid;
  const spawnDummy = (_file, _args, options) => {
    assert.equal(
      options.detached,
      true,
      "Web acquisitions must own detached groups"
    );
    const isVite = children.length === 0;
    const child = spawn(
      process.execPath,
      [
        "-e",
        isVite
          ? `const {spawn}=require('node:child_process');
const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});
console.log(descendant.pid); setInterval(()=>{},1000);`
          : "setInterval(()=>{},1000)",
      ],
      { detached: true, stdio: isVite ? ["ignore", "pipe", "pipe"] : "ignore" }
    );
    children.push(child);
    return child;
  };
  const runWeb = runInNewContext(`(${web})`, {
    spawn: spawnDummy,
    Error,
    webShell: () => ({ cwd: tmpdir(), command: "unused", args: [] }),
    webScenarioUrl: () => "unused",
    join,
    root: tmpdir(),
    chromePath: "unused",
    webScenario: "unused",
    mkdtempSync,
    rmSync,
    tmpdir,
    stopOwnedProcess,
    waitFor: async () => {
      const [output] = await once(children[0].stdout, "data", {
        signal: AbortSignal.timeout(5000),
      });
      descendantPid = Number(output.toString().trim());
      throw new Error("Deliberate dummy startup failure");
    },
  });
  try {
    const result = await runWeb("unused", 0, name);
    assert.equal(result.status, "failed");
    assert.equal(result.error, "Deliberate dummy startup failure");
    await awaitGone(descendantPid);
    for (const child of children) {
      assert.ok(child.exitCode !== null || child.signalCode !== null);
    }
  } finally {
    for (const child of children) await stopOwnedProcess(child);
  }
}

const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
  detached: true,
  stdio: "ignore",
});
try {
  // These tiny local processes exercise cleanup only; they launch no renderer.
  for (const parentExits of [false, true]) {
    const child = spawn(
      process.execPath,
      [
        "-e",
        `const {spawn}=require('node:child_process');
const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});
console.log(descendant.pid);
${parentExits ? "descendant.unref();" : "setInterval(()=>{},1000);"}`,
      ],
      { detached: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    let closed = false;
    child.once("close", () => {
      closed = true;
    });
    try {
      const [output] = await once(child.stdout, "data", {
        signal: AbortSignal.timeout(5000),
      });
      const descendantPid = Number(output.toString().trim());
      assert.ok(Number.isSafeInteger(descendantPid) && descendantPid > 0);
      if (parentExits && child.exitCode === null && child.signalCode === null)
        await once(child, "exit", { signal: AbortSignal.timeout(5000) });
      if (parentExits)
        assert.equal(
          closed,
          false,
          "Descendant must retain the inherited pipes"
        );
      await stopOwnedProcess(child);
      await awaitGone(descendantPid);
      const deadline = Date.now() + 5000;
      while (!closed && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(
        closed,
        true,
        "Owned inherited pipes must close so the command can exit"
      );
      assert.equal(
        alive(unrelated.pid),
        true,
        "Unrelated process group must survive"
      );
      assert.ok(child.exitCode !== null || child.signalCode !== null);
    } finally {
      await stopOwnedProcess(child);
    }
  }
} finally {
  await stopOwnedProcess(unrelated);
}
console.log(
  "PASS smoke cleanup: detached web ownership, live/exited leaders, inherited pipes, unrelated survival, idempotent cleanup"
);
