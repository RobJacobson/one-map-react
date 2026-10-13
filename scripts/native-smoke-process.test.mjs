import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

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

// These tiny local processes exercise cleanup only; they launch no renderer.
for (const parentExits of [false, true]) {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const {spawn}=require('node:child_process');
const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
console.log(descendant.pid);
${parentExits ? "descendant.unref();" : "setInterval(()=>{},1000);"}`,
    ],
    { detached: true, stdio: ["ignore", "pipe", "ignore"] }
  );
  try {
    const [output] = await once(child.stdout, "data");
    const descendantPid = Number(output.toString().trim());
    assert.ok(Number.isSafeInteger(descendantPid) && descendantPid > 0);
    if (parentExits && child.exitCode === null && child.signalCode === null)
      await once(child, "close");
    await stopOwnedProcess(child);
    await awaitGone(descendantPid);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally {
    await stopOwnedProcess(child);
  }
}

console.log("PASS native smoke cleanup: live and exited group leaders");
