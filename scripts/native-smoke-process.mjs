/**
 * Stops an owned detached process group, including children of an exited parent.
 *
 * @param {import("node:child_process").ChildProcess} child - Owned group leader.
 * @returns {Promise<void>} Resolves after parent exit or bounded termination.
 */
export const stopOwnedProcess = async (child) => {
  if (!child.pid) return;
  const exited =
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise((resolve) => child.once("close", resolve));
  const signalGroup = async (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code === "ESRCH") return;
      // macOS sandboxing can report EPERM for an already-absent group.
      // Confirm ownership and signal live members individually when group
      // signaling is restricted. Zombies have already stopped executing.
      if (error.code === "EPERM") {
        const { stdout } = await execute("ps", [
          "-ax",
          "-o",
          "pid=,pgid=,stat=",
        ]);
        const members = stdout.split("\n").flatMap((line) => {
          const [pid, group, state] = line.trim().split(/\s+/);
          return Number(group) === child.pid && !state?.startsWith("Z")
            ? [Number(pid)]
            : [];
        });
        for (const pid of members) {
          try {
            process.kill(pid, signal);
          } catch (memberError) {
            if (memberError.code !== "ESRCH") throw memberError;
          }
        }
        return;
      }
      throw error;
    }
  };
  await signalGroup("SIGTERM");
  let timer;
  try {
    await Promise.race([
      exited,
      new Promise((resolve) => {
        timer = setTimeout(resolve, 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    await signalGroup("SIGKILL");
  }
};

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
