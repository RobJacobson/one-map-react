import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import {
  toRnmapboxControlledCamera,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "../packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts";

if (process.platform !== "darwin") {
  console.log("SKIP native camera mode regression: requires Xcode.");
  process.exit(0);
}

const peer = resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps");
const temporary = mkdtempSync(join(tmpdir(), "one-map-camera-mode-"));

/** Extracts upstream code, failing when a peer changes the tested boundary. */
const section = (file, start, end) => {
  const source = readFileSync(join(peer, file), "utf8");
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing camera boundary: ${file}`);
  return source.slice(first, last);
};

/** Executes actual Swift peer code with a small SDK dispatch recorder. */
const swift = (source) => {
  const file = join(temporary, "Camera.swift");
  writeFileSync(file, source);
  const result = spawnSync(
    "xcrun",
    ["swift", "-module-cache-path", join(temporary, "swift-cache"), file],
    { encoding: "utf8", timeout: 60000 }
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
};

try {
  const cameraFile = "ios/RNMBX/RNMBXCamera.swift";
  const modes = section(
    cameraFile,
    "enum CameraMode:",
    "enum UserTrackingMode:"
  );
  const constants = section(
    "ios/RNMBX/RNMBXModule.swift",
    '      "CameraModes":',
    '      "EventTypes":'
  )
    .replace(/^\s*"CameraModes":/, "")
    .trim()
    .replace(/,$/, "");
  const nativeModes = JSON.parse(
    swift(`import Foundation
${modes}
let constants = ${constants}
print(String(data: try! JSONSerialization.data(withJSONObject: constants), encoding: .utf8)!)
`)
  );
  const wrapperFile = "lib/module/components/Camera.js";
  const conversion = section(
    wrapperFile,
    "const nativeAnimationMode =",
    "// Native module types."
  );
  const build = section(
    wrapperFile,
    "  const buildNativeStop =",
    "  // since codegen"
  );
  const buildStop = runInNewContext(
    `${conversion}\n${build}\nbuildNativeStop`,
    {
      NativeModule: { CameraModes: nativeModes },
      props: {},
      useCallback: (callback) => callback,
      makePoint: (coordinates) => ({ type: "Point", coordinates }),
    }
  );
  const view = { longitude: 100, latitude: 50, zoom: 5, bearing: 0, pitch: 0 };
  const stops = [
    ["jumpTo", toRnmapboxStop({ center: [100, 50], zoom: 5 }, "none"), "set"],
    ["controlled camera", toRnmapboxControlledCamera(view), "set"],
    ["zero duration zoom", toRnmapboxZoomStop(5, { duration: 0 }), "set"],
    ["flyTo", toRnmapboxStop({ center: [100, 50] }, "flyTo"), "fly"],
    ["easeTo", toRnmapboxStop({ zoom: 5 }, "easeTo"), "ease"],
    ["moveTo alias", { animationMode: "moveTo" }, "set"],
  ];
  const wire = stops.map(([name, stop, expected]) => ({
    name,
    expected,
    stop: buildStop(stop),
  }));
  // JSON models the bridge omission of undefined numeric camera modes.
  writeFileSync(join(temporary, "stops.json"), JSON.stringify(wire));
  const selection = section(
    cameraFile,
    "    var mode: CameraMode = .flight",
    "    return CameraUpdateItem("
  );
  const update = section(
    cameraFile,
    "struct CameraUpdateItem {",
    "class CameraUpdateQueue {"
  );
  const result = swift(`import Foundation
${modes}
struct Center { func validate() throws {} }
struct CameraOptions { var center: Center? = Center() }
class BasicCameraAnimator {}
enum Curve { case easeInOut, linear }
var calls: [String] = []
class SDK { func setCamera(to camera: CameraOptions) { calls.append("set") } }
class Animator {
  func fly(to camera: CameraOptions, duration: TimeInterval?) { calls.append("fly") }
  func ease(to camera: CameraOptions, duration: TimeInterval, curve: Curve, completion: (() -> Void)?) { calls.append("ease") }
}
class View { var window: Bool? = true; let camera = Animator() }
class RNMBXMapView { let mapView = View(); let mapboxMap = SDK() }
func logged(_ name: String, _ body: () throws -> Void) { try! body() }
${update}
let rows = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: ${JSON.stringify(join(temporary, "stops.json"))}))) as! [[String: Any]]
var results: [[String: String]] = []
for row in rows {
  let stop = row["stop"] as! [String: Any]
  ${selection}
  var animator: BasicCameraAnimator?
  CameraUpdateItem(camera: CameraOptions(), mode: mode, duration: stop["duration"] as? Double).execute(map: RNMBXMapView(), cameraAnimator: &animator)
  results.append(["name": row["name"] as! String, "actual": calls.last!, "expected": row["expected"] as! String])
}
print(String(data: try! JSONSerialization.data(withJSONObject: results), encoding: .utf8)!)
`);
  for (const row of JSON.parse(result)) {
    assert.equal(row.actual, row.expected, `${row.name}: iOS SDK dispatch`);
  }
  assert.equal(
    nativeModes.None,
    nativeModes.Move,
    "Preserve the existing Move alias"
  );
  console.log(
    `PASS ${JSON.parse(readFileSync(join(peer, "package.json"))).version}: six actual wrapper-to-iOS camera dispatches`
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
