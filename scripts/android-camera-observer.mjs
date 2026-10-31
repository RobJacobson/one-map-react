import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// ElementTree rejects malformed XML and ignores declarations when selecting nodes.
export const statusReader = `import json, sys, xml.etree.ElementTree as ET
root = ET.fromstring(sys.stdin.read())
nodes = [node for node in root.iter('node') if node.get('package') == 'com.onemapmapbox' and node.get('resource-id') in ('tf04-status', 'com.onemapmapbox:id/tf04-status')]
assert len(nodes) <= 1, 'Ambiguous TF04 status'
print(json.dumps(nodes[0].get('text', '') if nodes else None))
`;

/** Observes only this attempt's selected Android Text and sends one phase-gated tap. */
export const observeCamera = async ({
  adb,
  execute,
  until,
  record,
  engine = "mapbox",
}) => {
  const devicePath = `/sdcard/one-map-tf04-${randomUUID()}.xml`;
  const observations = [];
  assert(["mapbox", "maplibre"].includes(engine));
  const doubleTap = engine === "maplibre";
  let doubleTapped = false;
  let tapped = false;
  let seen = false;
  let previousPhase = -1;
  let result;
  let failure;
  let fittedCenter;
  const phases = [
    "await-load",
    "await-fit",
    "await-click",
    "await-stop",
    "await-hold",
    "await-double-tap",
    "done",
  ];
  const size = await adb(["shell", "wm", "size"]);
  const dimensions = [
    ...size.matchAll(/^(?:Physical|Override) size: (\d+)x(\d+)\s*$/gm),
  ];
  assert(
    dimensions.length > 0 && dimensions.length <= 2,
    "Missing exact display size."
  );
  const [, width, height] = dimensions.at(-1);
  assert(Number(width) > 0 && Number(height) > 0, "Invalid display size.");
  const tap = [
    String(Math.round(Number(width) / 2)),
    String(Math.round(Number(height) * 0.62)),
  ];
  try {
    await until(async () => {
      await adb(["shell", "rm", "-f", devicePath]);
      await adb(["shell", "uiautomator", "dump", devicePath]);
      const xml = await adb(["exec-out", "cat", devicePath]);
      const text = JSON.parse(
        await execute(
          "python3",
          [
            "-c",
            statusReader.replaceAll("com.onemapmapbox", `com.onemap${engine}`),
          ],
          30000,
          xml
        )
      );
      if (text === null) {
        assert(!seen, "Selected TF04 status disappeared.");
        return false;
      }
      const fields = parseStatus(text);
      seen = true;
      const phase = phases.indexOf(fields.phase);
      assert(phase >= previousPhase, "TF04 status regressed or became stale.");
      previousPhase = phase;
      if (observations.at(-1)?.text !== text)
        observations.push({ text, fields });
      result = {
        observations,
        display: { width: Number(width), height: Number(height) },
        tap: tapped ? tap : null,
      };
      record(result);
      for (const [key, allowed] of Object.entries({
        fit: ["pending", "ok"],
        click: ["pending", "hit"],
        stop: ["pending", "rejected"],
        held: ["pending", "0"],
        command: ["pending", "applied"],
        doubletap: doubleTap ? ["pending", "timeout"] : ["skip"],
      }))
        assert(allowed.includes(fields[key]), `Failed ${key}: ${text}`);
      assert.equal(fields.note, "none", `Scene error: ${text}`);
      if (fields.phase === "await-click" && !tapped) {
        assert.equal(fields.fit, "ok");
        assertFitted(fields.center);
        fittedCenter = coordinates(fields.center);
        tapped = true; // Never retry a physical input, even if dispatch fails.
        result.tap = tap;
        record(result);
        await adb(["shell", "input", "tap", ...tap]);
      }
      if (fields.phase === "await-double-tap" && !doubleTapped) {
        assert(doubleTap, "Unexpected double-tap phase.");
        doubleTapped = true;
        result.doubleTap = tap;
        record(result);
        await adb([
          "shell",
          "sh",
          "-c",
          `input tap ${tap.join(" ")}; sleep 0.1; input tap ${tap.join(" ")}`,
        ]);
      }
      if (fields.phase !== "done") return false;
      assert(
        !doubleTap || doubleTapped,
        "Completion without double-tap input."
      );
      assert(tapped, "Completion without owned input.");
      for (const [key, value] of Object.entries({
        fit: "ok",
        click: "hit",
        stop: "rejected",
        held: "0",
        command: "applied",
        doubletap: doubleTap ? "timeout" : "skip",
        done: "1",
      }))
        assert.equal(fields[key], value, `Unexpected ${key}: ${text}`);
      const click = coordinates(fields.clickAt);
      assert(
        Math.abs(click[0] - fittedCenter[0]) < 0.08 &&
          Math.abs(click[1] - fittedCenter[1]) < 0.08,
        "Click coordinates missed fitted center."
      );
      const center = coordinates(fields.center);
      assert(
        Math.hypot(center[0] + 120, center[1] - 45) < 0.5,
        "Explicit camera target missed."
      );
      return true;
    }, 90000);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await adb(["shell", "rm", "-f", devicePath]);
    } catch (cleanupError) {
      failure ??= cleanupError;
      try {
        record({ ...result, xmlCleanupError: String(cleanupError) });
      } catch {
        // Preserve the first scene failure when the cleanup receipt also fails.
      }
    }
  }
  if (failure) throw failure;
  return result;
};

/** Parses the complete frozen fixture status schema, rejecting truncated/duplicate fields. */
export const parseStatus = (text) => {
  assert.equal(typeof text, "string");
  assert(text.startsWith("TF04 "), "Missing TF04 status prefix.");
  const fields = Object.fromEntries(
    text
      .slice(5)
      .split(" ")
      .map((part) => {
        const pair = part.split("=");
        assert(
          pair.length === 2 && pair.every(Boolean),
          "Malformed TF04 field."
        );
        return pair;
      })
  );
  const keys = [
    "fit",
    "click",
    "clickAt",
    "stop",
    "held",
    "command",
    "doubletap",
    "center",
    "note",
    "phase",
    "done",
  ];
  assert.deepEqual(
    Object.keys(fields),
    keys,
    "Incomplete or duplicate TF04 status."
  );
  assert.equal(text.slice(5).split(" ").length, keys.length);
  assert(
    [
      "await-load",
      "await-fit",
      "await-click",
      "await-stop",
      "await-hold",
      "await-double-tap",
      "done",
    ].includes(fields.phase),
    "Unknown TF04 phase."
  );
  assert.equal(fields.done, fields.phase === "done" ? "1" : "0");
  return fields;
};

const coordinates = (value) => {
  assert.match(value, /^-?\d+\.\d+,-?\d+\.\d+$/);
  return value.split(",").map(Number);
};

const assertFitted = (value) => {
  const [longitude, latitude] = coordinates(value);
  assert(
    longitude >= -122.335 &&
      longitude <= -122.305 &&
      latitude >= 47.625 &&
      latitude <= 47.655,
    "Observed center lies outside fitted bounds."
  );
};
