import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./tf07-ui-smoke.mjs", import.meta.url),
  "utf8"
);
const start = source.indexOf("const nativeStatus =");
const end = source.indexOf("\nconst click =", start);
assert(start >= 0 && end > start);
let receive;
const nativeStatus = runInNewContext(
  `${source.slice(start, end)}; nativeStatus;`,
  {
    createServer: (handler) => {
      receive = handler;
      const server = {
        once: () => {},
        listen: (_port, _host, ready) => ready(),
        close: (done) => done(),
      };
      return server;
    },
  }
);
const status = await nativeStatus(() => {});
for (const sceneSequence of [7, 1]) {
  const request = Object.assign(new EventEmitter(), {
    method: "POST",
    url: "/tf07",
  });
  const response = { writeHead: () => response, end: () => {} };
  receive(request, response);
  request.emit("data", JSON.stringify({ readSequence: sceneSequence }));
  request.emit("end");
}
assert.equal(status.read().readSequence, 1);
assert.equal(status.read().readReceipt, 2);
await status.close();
console.log(
  "PASS renderer receipts increase when an activity restarts its scene counter."
);
